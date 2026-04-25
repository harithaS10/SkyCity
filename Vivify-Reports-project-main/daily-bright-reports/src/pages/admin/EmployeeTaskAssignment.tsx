import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Save,
  Loader2,
  CalendarDays,
  Target,
  Edit,
  Trash2
} from "lucide-react";
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TaskFormData {
  taskName: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  dueTime?: string;
  month?: string;
  taskType: 'daily' | 'monthly';
}

interface Task {
  id: number;
  taskName: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  assigneeName: string;
  isRecurring: boolean;
  groupId?: number | null;
  createdAt: string;
  _source: 'allocation' | 'stafftask';
}

const EmployeeTaskAssignment: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const employeeName = location.state?.employeeName || 'Employee';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

  const [dailyTaskForm, setDailyTaskForm] = useState<TaskFormData>({
    taskName: '',
    description: '',
    priority: 'medium',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueTime: '17:00',
    taskType: 'daily'
  });

  const [monthlyTaskForm, setMonthlyTaskForm] = useState<TaskFormData>({
    taskName: '',
    description: '',
    priority: 'medium',
    dueDate: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
    month: format(new Date(), 'yyyy-MM'),
    taskType: 'monthly'
  });

  const fetchEmployeeTasks = async () => {
    if (!employeeId) return;

    setIsLoading(true);
    try {
      // Fetch both work allocations AND admin-assigned tasks (daily + monthly)
      const [allocRes, tasksRes] = await Promise.all([
        api.allocations.getAll().catch(() => ({ success: false, data: [] })),
        api.tasks.getUserTasks(parseInt(employeeId)).catch(() => ({ success: false, data: [] })),
      ]);

      const allocs: any[] = allocRes.success ? (allocRes.data || []) : [];
      const empAllocs = allocs.filter((a: any) => a.assignedTo === parseInt(employeeId));

      // Map work allocations → daily tasks
      const allocTasks: Task[] = empAllocs.map((a: any) => ({
        id: a.id,
        taskName: a.workTitle || a.title || 'Work Task',
        description: a.description || '',
        priority: a.priority || 'medium',
        status: a.status === 'in-progress' ? 'in_progress' : (a.status || 'pending'),
        dueDate: a.dueDate,
        assigneeName: '',
        isRecurring: false,
        groupId: null,
        createdAt: a.createdAt,
        _source: 'allocation' as const,
      }));

      // Map admin-assigned StaffTasks (daily + monthly) — getUserTasks already filters by employee
      const adminTaskList: any[] = tasksRes.success ? (tasksRes.data || []) : [];
      const adminTasksMapped: Task[] = adminTaskList.map((t: any) => ({
        id: t.id,
        taskName: t.taskName || t.title || 'Task',
        description: t.description || '',
        priority: (t.priority || 'medium').toLowerCase(),
        status: (t.status || 'pending').toLowerCase().replace('-', '_'),
        dueDate: t.dueDate,
        assigneeName: t.assigneeName || '',
        isRecurring: t.isRecurring === true,
        groupId: t.groupId || null,
        createdAt: t.createdAt,
        _source: 'stafftask' as const,
      }));

      setTasks([...allocTasks, ...adminTasksMapped]);
    } catch (error) {
      console.error("Error fetching employee tasks:", error);
      toast.error("Failed to load employee tasks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeTasks();
  }, [employeeId]);

  const handleCreateTask = async (taskType: 'daily' | 'monthly') => {
    const formData = taskType === 'daily' ? dailyTaskForm : monthlyTaskForm;

    if (!formData.taskName || !employeeId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const dueDateTime = taskType === 'daily' && formData.dueTime
        ? `${formData.dueDate}T${formData.dueTime}:00`
        : `${formData.dueDate}T23:59:59`;

      const payload = {
        taskName: formData.taskName,
        description: formData.description,
        assignedTo: parseInt(employeeId),
        assignedToIds: [parseInt(employeeId)],
        startDate: new Date().toISOString(),
        dueDate: new Date(dueDateTime).toISOString(),
        priority: formData.priority,
        isRecurring: taskType === 'monthly',
        recurrenceType: taskType === 'monthly' ? 'monthly' : null,
        taskType: taskType
      };

      const response = await api.tasks.create(payload);
      if (response.success) {
        toast.success(`${taskType === 'daily' ? 'Daily' : 'Monthly'} task created successfully`);
        // Open chatbox with the assigned user so they can see the task message
        window.dispatchEvent(new CustomEvent('open-chat-with', { detail: { userId: parseInt(employeeId) } }));

        // Reset form
        if (taskType === 'daily') {
          setDailyTaskForm({
            taskName: '',
            description: '',
            priority: 'medium',
            dueDate: format(new Date(), 'yyyy-MM-dd'),
            dueTime: '17:00',
            taskType: 'daily'
          });
        } else {
          setMonthlyTaskForm({
            taskName: '',
            description: '',
            priority: 'medium',
            dueDate: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
            month: format(new Date(), 'yyyy-MM'),
            taskType: 'monthly'
          });
        }

        setIsCreateDialogOpen(false);
        fetchEmployeeTasks();
      } else {
        toast.error(response.message || "Failed to create task");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const task = tasks.find(t => t.id === taskId);
      const response = task?._source === 'stafftask'
        ? await api.tasks.delete(taskId).catch(() => api.allocations.delete(taskId))
        : await api.allocations.delete(taskId).catch(() => api.tasks.delete(taskId));
      if (response.success) {
        toast.success("Task deleted successfully");
        fetchEmployeeTasks();
      } else {
        toast.error(response.message || "Failed to delete task");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: string, source?: 'allocation' | 'stafftask') => {
    try {
      const task = source
        ? tasks.find(t => t.id === taskId && t._source === source)
        : tasks.find(t => t.id === taskId);
      const isStaffTask = (source ?? task?._source) === 'stafftask';
      let res;
      if (isStaffTask) {
        res = await api.tasks.updateStatus(taskId, newStatus);
      } else {
        const allocStatus = newStatus === 'in_progress' ? 'in-progress' : newStatus;
        res = await api.allocations.updateStatus(taskId, allocStatus);
      }
      if (res.success) {
        setTasks(prev => prev.map(t =>
          t.id === taskId && t._source === (source ?? task?._source) ? { ...t, status: newStatus } : t
        ));
        toast.success('Status updated');
      } else toast.error(res.message || 'Failed to update status');
    } catch (e: any) { toast.error(e.message); }
  };
  const monthlyTasks = tasks.filter(task => task.isRecurring);
  const dailyTasks = tasks.filter(task => !task.isRecurring);

  const priorityColors: Record<string, string> = {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700 border-slate-200',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-500 relative">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block space-y-8 mb-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/employees')}
                className="gap-2 w-fit"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Employees
              </Button>
              <div className="space-y-0.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                  Task Assignment - {employeeName}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Assign and manage daily and monthly tasks for this employee
                </p>
              </div>
            </div>
          </div>

          {/* Employee Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{employeeName}</CardTitle>
                  <p className="text-sm text-muted-foreground">Employee ID: EMP-{employeeId ? employeeId.padStart(3, '0') : '000'}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">{tasks.length}</div>
                  <div className="text-sm text-muted-foreground">Total Tasks</div>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">
                    {tasks.filter(t => t.status === 'completed').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">
                    {tasks.filter(t => t.status === 'pending').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {tasks.filter(t => t.status === 'in_progress').length}
                  </div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Assignment Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Daily Task Section */}
            <Card id="daily-task-section">
              <CardHeader>
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                  <CardTitle className="text-base">Daily Task Assignment</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="daily-task">Task Title</Label>
                  <Input
                    id="daily-task"
                    placeholder="Enter daily task title"
                    value={dailyTaskForm.taskName}
                    onChange={(e) => setDailyTaskForm({ ...dailyTaskForm, taskName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily-desc">Description</Label>
                  <Textarea
                    id="daily-desc"
                    placeholder="Task description"
                    rows={3}
                    value={dailyTaskForm.description}
                    onChange={(e) => setDailyTaskForm({ ...dailyTaskForm, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily-priority">Priority</Label>
                    <Select
                      value={dailyTaskForm.priority}
                      onValueChange={(value: 'low' | 'medium' | 'high') =>
                        setDailyTaskForm({ ...dailyTaskForm, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daily-time">Due Time</Label>
                    <Input
                      id="daily-time"
                      type="time"
                      value={dailyTaskForm.dueTime}
                      onChange={(e) => setDailyTaskForm({ ...dailyTaskForm, dueTime: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleCreateTask('daily')}
                  disabled={isSubmitting || !dailyTaskForm.taskName}
                  className="w-full gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Daily Task
                </Button>
              </CardContent>
            </Card>

            {/* Monthly Task Section */}
            <Card id="monthly-task-section">
              <CardHeader>
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays className="h-5 w-5 text-purple-600 shrink-0" />
                  <CardTitle className="text-base">Monthly Task Assignment</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly-task">Task Title</Label>
                  <Input
                    id="monthly-task"
                    placeholder="Enter monthly task title"
                    value={monthlyTaskForm.taskName}
                    onChange={(e) => setMonthlyTaskForm({ ...monthlyTaskForm, taskName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-desc">Description</Label>
                  <Textarea
                    id="monthly-desc"
                    placeholder="Task description"
                    rows={3}
                    value={monthlyTaskForm.description}
                    onChange={(e) => setMonthlyTaskForm({ ...monthlyTaskForm, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthly-month">Month</Label>
                    <Input
                      id="monthly-month"
                      type="month"
                      value={monthlyTaskForm.month}
                      onChange={(e) => setMonthlyTaskForm({ ...monthlyTaskForm, month: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly-due">Due Date</Label>
                    <Input
                      id="monthly-due"
                      type="date"
                      value={monthlyTaskForm.dueDate}
                      onChange={(e) => setMonthlyTaskForm({ ...monthlyTaskForm, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleCreateTask('monthly')}
                  disabled={isSubmitting || !monthlyTaskForm.taskName}
                  className="w-full gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Monthly Task
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Tasks List */}
          <Card>
            <CardHeader>
              <CardTitle>Assigned Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Tabs defaultValue="daily" className="w-full">
                  <TabsList>
                    <TabsTrigger value="daily">Daily Tasks ({dailyTasks.length})</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly Tasks ({monthlyTasks.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="daily" className="mt-6">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task Name</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dailyTasks.map((task) => (
                            <TableRow key={task.id}>
                              <TableCell className="font-medium">
                                {task.taskName}
                                {task.groupId && (
                                  <Badge className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200 h-5">Group</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={priorityColors[task.priority]}>
                                  {task.priority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v, task._source)}>
                                  <SelectTrigger className={`h-7 text-xs w-32 ${statusColors[task.status]}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">To Do</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Done</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy HH:mm') : '-'}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTask(task.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="monthly" className="mt-6">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task Name</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlyTasks.map((task) => (
                            <TableRow key={task.id}>
                              <TableCell className="font-medium">
                                {task.taskName}
                                {task.groupId && (
                                  <Badge className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200 h-5">Group</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={priorityColors[task.priority]}>
                                  {task.priority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v, task._source)}>
                                  <SelectTrigger className={`h-7 text-xs w-32 ${statusColors[task.status]}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">To Do</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Done</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : '-'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                  <Target className="h-3 w-3 mr-1" />
                                  Recurring
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTask(task.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 -mx-4 -mt-4 min-h-screen pb-20">
          <div className="bg-primary pt-6 pb-12 px-5 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <button onClick={() => navigate('/admin/employees')} className="flex items-center gap-2 text-white/80 hover:text-white mb-6 text-[10px] font-bold tracking-widest uppercase bg-white/10 px-3 py-1.5 rounded-full w-fit backdrop-blur-md">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-white font-black text-2xl shadow-inner border border-white/20 shrink-0">
                {employeeName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black tracking-tight truncate">{employeeName}</h1>
                <p className="text-[10px] text-white/90 font-bold uppercase mt-1 tracking-widest bg-black/20 w-fit px-2.5 py-1 rounded-md border border-white/10 shadow-sm">
                  EMP-{employeeId?.padStart(3, '0') || '000'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex flex-col items-center justify-center text-center">
                <p className="text-[8px] uppercase font-bold tracking-widest opacity-80 mb-0.5">Total</p>
                <p className="text-lg font-black">{tasks.length}</p>
              </div>
              <div className="bg-emerald-500/20 backdrop-blur-md rounded-2xl p-2.5 border border-emerald-400/20 flex flex-col items-center justify-center text-center">
                <p className="text-[8px] uppercase font-bold tracking-widest text-emerald-200 mb-0.5">Done</p>
                <p className="text-lg font-black text-emerald-300">{tasks.filter(t => t.status === 'completed').length}</p>
              </div>
              <div className="bg-amber-500/20 backdrop-blur-md rounded-2xl p-2.5 border border-amber-400/20 flex flex-col items-center justify-center text-center">
                <p className="text-[8px] uppercase font-bold tracking-widest text-amber-200 mb-0.5">Wait</p>
                <p className="text-lg font-black text-amber-300">{tasks.filter(t => t.status === 'pending').length}</p>
              </div>
              <div className="bg-blue-500/20 backdrop-blur-md rounded-2xl p-2.5 border border-blue-400/20 flex flex-col items-center justify-center text-center">
                <p className="text-[8px] uppercase font-bold tracking-widest text-blue-200 mb-0.5">Prog</p>
                <p className="text-lg font-black text-blue-300">{tasks.filter(t => t.status === 'in_progress').length}</p>
              </div>
            </div>
          </div>

          <div className="px-4 -mt-6 relative z-20 space-y-4">
            {/* Create Task Tab/Forms */}
            <Tabs defaultValue="assign" className="w-full">
              <TabsList className="w-full bg-white shadow-sm ring-1 ring-black/5 rounded-2xl h-12 p-1 border-0">
                <TabsTrigger value="assign" className="flex-1 rounded-xl text-xs font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white">Assign Task</TabsTrigger>
                <TabsTrigger value="daily" className="flex-1 rounded-xl text-xs font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white">Daily ({dailyTasks.length})</TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1 rounded-xl text-xs font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white">Monthly ({monthlyTasks.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="assign" className="mt-4 space-y-4">
                <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-black/5">
                  <div className="flex items-center gap-3 border-b border-slate-50 pb-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm shrink-0">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">New Task</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Assign immediately</p>
                    </div>
                  </div>

                  <Tabs defaultValue="daily-form" className="w-full">
                    <TabsList className="w-full grid grid-cols-2 bg-slate-50 rounded-xl h-10 p-1 mb-4">
                      <TabsTrigger value="daily-form" className="rounded-lg text-[10px] uppercase tracking-wider font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Daily</TabsTrigger>
                      <TabsTrigger value="monthly-form" className="rounded-lg text-[10px] uppercase tracking-wider font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Monthly</TabsTrigger>
                    </TabsList>

                    <TabsContent value="daily-form" className="space-y-4 outline-none">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Task Title</Label>
                        <Input
                          placeholder="e.g. Check generators"
                          value={dailyTaskForm.taskName}
                          onChange={(e) => setDailyTaskForm({ ...dailyTaskForm, taskName: e.target.value })}
                          className="rounded-xl h-11 bg-slate-50/50 border-slate-200"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</Label>
                        <Textarea
                          placeholder="Details..."
                          rows={2}
                          value={dailyTaskForm.description}
                          onChange={(e) => setDailyTaskForm({ ...dailyTaskForm, description: e.target.value })}
                          className="rounded-xl bg-slate-50/50 border-slate-200 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</Label>
                          <Select value={dailyTaskForm.priority} onValueChange={(v: any) => setDailyTaskForm({ ...dailyTaskForm, priority: v })}>
                            <SelectTrigger className="rounded-xl h-11 bg-slate-50/50 border-slate-200 text-xs font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low" className="text-xs font-bold text-emerald-700">Low</SelectItem>
                              <SelectItem value="medium" className="text-xs font-bold text-amber-700">Medium</SelectItem>
                              <SelectItem value="high" className="text-xs font-bold text-rose-700">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Time</Label>
                          <Input
                            type="time"
                            value={dailyTaskForm.dueTime}
                            onChange={(e) => setDailyTaskForm({ ...dailyTaskForm, dueTime: e.target.value })}
                            className="rounded-xl h-11 bg-slate-50/50 border-slate-200 text-xs font-bold"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={() => handleCreateTask('daily')}
                        disabled={isSubmitting || !dailyTaskForm.taskName}
                        className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20 mt-2"
                      >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Assign Daily Task"}
                      </Button>
                    </TabsContent>

                    <TabsContent value="monthly-form" className="space-y-4 outline-none">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Task Title</Label>
                        <Input
                          placeholder="e.g. Monthly safety check"
                          value={monthlyTaskForm.taskName}
                          onChange={(e) => setMonthlyTaskForm({ ...monthlyTaskForm, taskName: e.target.value })}
                          className="rounded-xl h-11 bg-slate-50/50 border-slate-200"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</Label>
                        <Textarea
                          placeholder="Details..."
                          rows={2}
                          value={monthlyTaskForm.description}
                          onChange={(e) => setMonthlyTaskForm({ ...monthlyTaskForm, description: e.target.value })}
                          className="rounded-xl bg-slate-50/50 border-slate-200 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Month</Label>
                          <Input
                            type="month"
                            value={monthlyTaskForm.month}
                            onChange={(e) => setMonthlyTaskForm({ ...monthlyTaskForm, month: e.target.value })}
                            className="rounded-xl h-11 bg-slate-50/50 border-slate-200 text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</Label>
                          <Input
                            type="date"
                            value={monthlyTaskForm.dueDate}
                            onChange={(e) => setMonthlyTaskForm({ ...monthlyTaskForm, dueDate: e.target.value })}
                            className="rounded-xl h-11 bg-slate-50/50 border-slate-200 text-xs font-bold"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={() => handleCreateTask('monthly')}
                        disabled={isSubmitting || !monthlyTaskForm.taskName}
                        className="w-full h-12 rounded-xl font-bold shadow-lg shadow-purple-500/20 bg-purple-600 hover:bg-purple-700 mt-2"
                      >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Assign Monthly Task"}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>

              <TabsContent value="daily" className="mt-4 space-y-3">
                {dailyTasks.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-sm ring-1 ring-black/5 opacity-60">
                    <CheckCircle2 className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-sm font-black text-slate-600">No Daily Tasks</p>
                    <p className="text-xs font-bold text-slate-400">All caught up!</p>
                  </div>
                ) : (
                  dailyTasks.map(task => (
                    <div key={task.id} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-black/5">
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-slate-800 line-clamp-2 leading-tight">{task.taskName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-bold h-5 ${priorityColors[task.priority]}`}>
                              {task.priority}
                            </Badge>
                            {task.groupId && <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold h-5 bg-indigo-50 text-indigo-700 border-indigo-200">Group</Badge>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 -mr-2 -mt-2">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {task.dueDate ? format(new Date(task.dueDate), 'HH:mm') : '-'}
                        </div>
                        <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v, task._source)}>
                          <SelectTrigger className={`h-8 rounded-lg text-xs font-bold w-[120px] border-0 focus:ring-0 ${statusColors[task.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending" className="text-xs font-bold">To Do</SelectItem>
                            <SelectItem value="in_progress" className="text-xs font-bold text-blue-700">In Progress</SelectItem>
                            <SelectItem value="completed" className="text-xs font-bold text-emerald-700">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="monthly" className="mt-4 space-y-3">
                {monthlyTasks.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-sm ring-1 ring-black/5 opacity-60">
                    <CheckCircle2 className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-sm font-black text-slate-600">No Monthly Tasks</p>
                    <p className="text-xs font-bold text-slate-400">All clear!</p>
                  </div>
                ) : (
                  monthlyTasks.map(task => (
                    <div key={task.id} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-black/5">
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-slate-800 line-clamp-2 leading-tight">{task.taskName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-bold h-5 ${priorityColors[task.priority]}`}>
                              {task.priority}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold h-5 bg-purple-50 text-purple-700 border-purple-200">
                              Recurring
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 -mr-2 -mt-2">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {task.dueDate ? format(new Date(task.dueDate), 'MMM dd') : '-'}
                        </div>
                        <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v, task._source)}>
                          <SelectTrigger className={`h-8 rounded-lg text-xs font-bold w-[120px] border-0 focus:ring-0 ${statusColors[task.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending" className="text-xs font-bold">To Do</SelectItem>
                            <SelectItem value="in_progress" className="text-xs font-bold text-blue-700">In Progress</SelectItem>
                            <SelectItem value="completed" className="text-xs font-bold text-emerald-700">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployeeTaskAssignment;