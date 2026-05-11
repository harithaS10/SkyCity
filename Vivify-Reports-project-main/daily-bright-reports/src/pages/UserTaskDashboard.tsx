import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Calendar,
  Loader2,
  Target,
  AlertCircle,
  Play,
  Pause,
  Check,
  CalendarDays,
  Timer,
  Award
} from "lucide-react";
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Task {
  id: number;
  taskName: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  isRecurring: boolean;
  createdAt: string;
  isOverdue: boolean;
  _source?: 'task' | 'allocation';
}

interface TaskReminderDto {
  id: number;
  taskId: number;
  taskName: string;
  description?: string;
  dueDate: string;
  priority: string;
  reminderDate: string;
  isSent: boolean;
}

const UserTaskDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchMyTasks = async () => {
    setIsLoading(true);
    try {
      const [adminTasksRes, allocationsRes] = await Promise.all([
        api.tasks.getMyTasks(),
        api.allocations.getMyTasks(),
      ]);

      const adminTasks: Task[] = (adminTasksRes.success && adminTasksRes.data)
        ? adminTasksRes.data.map((t: any) => ({ ...t, _source: 'task' as const }))
        : [];

      // Normalize allocations to match Task shape; treat as daily (non-recurring) user tasks
      const allocationTasks: Task[] = (allocationsRes.success && allocationsRes.data)
        ? allocationsRes.data.map((a: any) => ({
            id: a.id,
            taskName: a.title || a.taskName || 'Untitled',
            description: a.description || '',
            priority: a.priority || 'medium',
            status: (a.status || 'pending').toLowerCase().replace('-', '_'),
            dueDate: a.dueDate || a.DueDate,
            isRecurring: false, // user-created work allocations are daily tasks
            createdAt: a.createdAt || new Date().toISOString(),
            isOverdue: a.dueDate ? new Date(a.dueDate) < new Date() && a.status !== 'completed' : false,
            _source: 'allocation' as const,
          }))
        : [];

      setTasks([...adminTasks, ...allocationTasks]);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const handleStatusUpdate = async (taskId: number, newStatus: string) => {
    setIsUpdating(true);
    try {
      const task = tasks.find(t => t.id === taskId);
      const isAllocation = task?._source === 'allocation';

      // Allocations use 'in-progress', admin tasks use 'in_progress'
      const normalizedStatus = isAllocation
        ? newStatus.replace('in_progress', 'in-progress')
        : newStatus;

      const response = isAllocation
        ? await api.allocations.updateStatus(taskId, normalizedStatus)
        : await api.tasks.updateStatus(taskId, newStatus);

      if (response.success) {
        toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
        fetchMyTasks();
        setIsStatusDialogOpen(false);
        setSelectedTask(null);
      } else {
        toast.error(response.message || "Failed to update task status");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsUpdating(false);
    }
  };

  const getTaskUrgency = (task: Task) => {
    const dueDate = new Date(task.dueDate);
    if (task.status === 'completed') return 'completed';
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    if (isToday(dueDate)) return 'due-today';
    if (isTomorrow(dueDate)) return 'due-tomorrow';
    return 'normal';
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'due-today': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'due-tomorrow': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

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

  const dailyTasks = tasks.filter(task => !task.isRecurring);
  const monthlyTasks = tasks.filter(task => task.isRecurring);
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
  const overdueTasks = tasks.filter(task => task.isOverdue && task.status !== 'completed');

  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pt-2">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Tasks</h1>
            <p className="text-sm text-muted-foreground max-w-[500px]">
              Manage your daily and monthly tasks. Track your progress and stay organized.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
              <p className="text-xs text-muted-foreground">Assigned to you</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{completedTasks.length}</div>
              <p className="text-xs text-muted-foreground">Successfully finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Play className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{inProgressTasks.length}</div>
              <p className="text-xs text-muted-foreground">Currently working</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">To Do</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{pendingTasks.length}</div>
              <p className="text-xs text-muted-foreground">Not started</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <Award className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{completionRate}%</div>
              <p className="text-xs text-muted-foreground">Your performance</p>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Tasks Alert */}
        {overdueTasks.length > 0 && (
          <Card className="border-rose-200 bg-rose-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                <CardTitle className="text-rose-800">Overdue Tasks ({overdueTasks.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <p className="font-medium text-sm">{task.taskName}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task);
                        setIsStatusDialogOpen(true);
                      }}
                    >
                      Update Status
                    </Button>
                  </div>
                ))}
                {overdueTasks.length > 3 && (
                  <p className="text-xs text-rose-600">
                    And {overdueTasks.length - 3} more overdue tasks...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tasks List */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Tasks ({tasks.length})</TabsTrigger>
              <TabsTrigger value="daily">Daily Tasks ({dailyTasks.length})</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Tasks ({monthlyTasks.length})</TabsTrigger>
              <TabsTrigger value="pending">To Do ({pendingTasks.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
            </TabsList>

            {['all', 'daily', 'monthly', 'pending', 'completed'].map(tab => (
              <TabsContent key={tab} value={tab} className="mt-6">
                <Card>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Urgency</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tab === 'all' ? tasks :
                        tab === 'daily' ? dailyTasks :
                        tab === 'monthly' ? monthlyTasks :
                        tab === 'pending' ? pendingTasks :
                        completedTasks
                      ).map((task) => {
                        const urgency = getTaskUrgency(task);
                        return (
                          <TableRow key={task.id} className="hover:bg-slate-50/50">
                            <TableCell>
                              <div>
                                <p className="font-medium">{task.taskName}</p>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {task.description.length > 50 
                                      ? `${task.description.substring(0, 50)}...` 
                                      : task.description
                                    }
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {task.isRecurring ? (
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                  <CalendarDays className="h-3 w-3 mr-1" />
                                  Monthly
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                  <Timer className="h-3 w-3 mr-1" />
                                  Daily
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("capitalize", priorityColors[task.priority])}>
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("capitalize", statusColors[task.status])}>
                                {task.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className={cn(
                                  "text-sm",
                                  urgency === 'overdue' && 'text-rose-600 font-medium'
                                )}>
                                  {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getUrgencyColor(urgency)}>
                                {urgency === 'overdue' ? 'Overdue' :
                                 urgency === 'due-today' ? 'Due Today' :
                                 urgency === 'due-tomorrow' ? 'Due Tomorrow' :
                                 urgency === 'completed' ? 'Completed' :
                                 'Normal'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {task.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setIsStatusDialogOpen(true);
                                  }}
                                  className="gap-1"
                                >
                                  {task.status === 'pending' ? (
                                    <>
                                      <Play className="h-3 w-3" />
                                      Start
                                    </>
                                  ) : (
                                    <>
                                      <Check className="h-3 w-3" />
                                      Complete
                                    </>
                                  )}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Status Update Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Task Status</DialogTitle>
            <DialogDescription>
              Update the status of "{selectedTask?.taskName}"
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => selectedTask && handleStatusUpdate(selectedTask.id, 'in_progress')}
                disabled={isUpdating || selectedTask?.status === 'in_progress'}
              >
                <Play className="h-4 w-4" />
                Mark as In Progress
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => selectedTask && handleStatusUpdate(selectedTask.id, 'completed')}
                disabled={isUpdating || selectedTask?.status === 'completed'}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Completed
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => selectedTask && handleStatusUpdate(selectedTask.id, 'pending')}
                disabled={isUpdating || selectedTask?.status === 'pending'}
              >
                <Pause className="h-4 w-4" />
                Mark as To Do
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UserTaskDashboard;