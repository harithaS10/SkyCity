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
      const response = await api.tasks.getUserTasks(parseInt(employeeId));
      if (response.success && response.data) {
        setTasks(response.data);
      }
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
      const response = await api.tasks.delete(taskId);
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

  const dailyTasks = tasks.filter(task => !task.isRecurring);
  const monthlyTasks = tasks.filter(task => task.isRecurring);

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
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/employees')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Employees
            </Button>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Task Assignment - {employeeName}
              </h1>
              <p className="text-sm text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">Employee ID: EMP-{employeeId?.padStart(3, '0')}</p>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <CardTitle>Daily Task Assignment</CardTitle>
                </div>
                <Button
                  onClick={() => {
                    setActiveTab('daily');
                    setIsCreateDialogOpen(true);
                  }}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Daily Task
                </Button>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-purple-600" />
                  <CardTitle>Monthly Task Assignment</CardTitle>
                </div>
                <Button
                  onClick={() => {
                    setActiveTab('monthly');
                    setIsCreateDialogOpen(true);
                  }}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Monthly Task
                </Button>
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
                            <Badge className={statusColors[task.status]}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.dueDate), 'MMM dd, yyyy HH:mm')}
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
                </TabsContent>

                <TabsContent value="monthly" className="mt-6">
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
                            <Badge className={statusColors[task.status]}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.dueDate), 'MMM dd, yyyy')}
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
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EmployeeTaskAssignment;