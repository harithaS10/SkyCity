import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  ChevronRight,
  Loader2,
  MessageSquare,
  HelpCircle,
  Plus,
  Building2,
  PlayCircle,
  Trash2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInDays } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const priorityColors: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200',
};

const statusColors: Record<string, string> = {
  pending: 'border-slate-200 bg-white',
  'in-progress': 'border-blue-200 bg-blue-50/30',
  'in_progress': 'border-blue-200 bg-blue-50/30',
  completed: 'border-emerald-200 bg-emerald-50/30',
};

// Task type filter for admin-assigned tasks
type TaskTypeFilter = 'all' | 'daily' | 'monthly';

const MyTasks: React.FC = () => {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<any[]>([]);
  const [adminTasks, setAdminTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [availableWorks, setAvailableWorks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [isDurationDialogOpen, setIsDurationDialogOpen] = useState(false);
  const [completionDuration, setCompletionDuration] = useState({ hours: "0", minutes: "0" });
  const [progressNote, setProgressNote] = useState("");
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [isSelfAssignDialogOpen, setIsSelfAssignDialogOpen] = useState(false);
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>('all');
  const [selfAssignData, setSelfAssignData] = useState({
    title: '',
    description: '',
    workId: '',
    clientId: '',
    priority: 'medium',
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isSubmittingNewWork, setIsSubmittingNewWork] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, clientsRes, worksRes, adminTasksRes] = await Promise.all([
        api.allocations.getMyTasks(),
        api.clients.getAll(),
        api.works.getActive(),
        api.tasks.getMyTasks()
      ]);

      if (tasksRes.success) setAllocations(tasksRes.data || []);
      if (clientsRes.success) setClients(clientsRes.data || []);
      if (worksRes.success) setAvailableWorks(worksRes.data || []);
      if (adminTasksRes.success) {
        // Normalize admin tasks to match allocation shape for unified rendering
        const normalized = (adminTasksRes.data || []).map((t: any) => ({
          ...t,
          _source: 'task',                          // mark origin for status update routing
          title: t.taskName,                        // unify field name
          dueDate: t.dueDate,
          status: t.status?.toLowerCase() ?? 'pending',
          taskType: t.isRecurring ? 'monthly' : 'daily',
        }));
        setAdminTasks(normalized);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Merge allocations + admin tasks into one list
  const allItems = [
    ...allocations,
    ...adminTasks,
  ];

  // Apply daily/monthly filter (only affects admin tasks; allocations are always shown)
  const filteredItems = allItems.filter((item) => {
    if (item._source !== 'task') return true; // allocations always pass
    if (taskTypeFilter === 'all') return true;
    return item.taskType === taskTypeFilter;
  });

  const pendingTasks = filteredItems.filter((a) => a.status === 'pending');
  const inProgressTasks = filteredItems.filter((a) => a.status === 'in-progress' || a.status === 'in_progress');

  // Filter completed tasks to only show those from the last 7 days
  const completedTasks = filteredItems.filter((task) => {
    if (task.status !== 'completed') return false;
    if (!task.completedAt) return true;
    const completedDate = new Date(task.completedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return completedDate >= sevenDaysAgo;
  });

  const getClient = (clientId?: number) =>
    clientId ? clients.find((c) => c.id === clientId) : null;

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'completed') return false;
    return new Date(dueDate) < new Date();
  };

  const getDaysRemaining = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day remaining';
    return `${days} days remaining`;
  };

  const handleStatusChange = async (taskId: number, newStatus: string, duration?: string) => {
    try {
      // Route to correct API based on task source
      const task = allItems.find(t => t.id === taskId);
      const isAdminTask = task?._source === 'task';

      const response = isAdminTask
        ? await api.tasks.updateStatus(taskId, newStatus)
        : await api.allocations.updateStatus(taskId, newStatus, duration);

      if (response.success) {
        if (isAdminTask) {
          setAdminTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, status: newStatus, completedAt: newStatus === 'completed' ? new Date().toISOString() : t.completedAt }
                : t
            )
          );
        } else {
          setAllocations((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, status: newStatus, duration: duration || t.duration, completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined }
                : t
            )
          );
        }

        const statusMessages: Record<string, string> = {
          'in-progress': 'Task started! Good luck!',
          'in_progress': 'Task started! Good luck!',
          completed: 'Great job! Task marked as completed!',
          pending: 'Task moved back to to do',
        };

        toast.success(statusMessages[newStatus] || 'Status updated');
        setIsDetailDialogOpen(false);
        setIsDurationDialogOpen(false);
      } else {
        toast.error(response.message || 'Failed to update status');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const completionRate = allItems.length > 0
    ? Math.round((allItems.filter(t => t.status === 'completed').length / allItems.length) * 100)
    : 0;

  /* Existing state */
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestData, setRequestData] = useState({ dueDate: '', description: '' });

  const handleRequestChange = async () => {
    if (!selectedTask) return;
    try {
      const response = await api.allocations.requestChange(selectedTask.id, requestData);
      if (response.success) {
        toast.success("Request submitted to administrator");
        setIsRequestDialogOpen(false);
        // Optimistically update or refetch
        fetchData();
        // Also close detail dialog?
        setIsDetailDialogOpen(false);
      } else {
        toast.error(response.message || "Failed to submit request");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const handleProgressUpdate = async () => {
    if (!selectedTask || !progressNote.trim() || selectedTask._source === 'task') return;
    setIsUpdatingProgress(true);
    try {
      const response = await api.allocations.updateProgress(selectedTask.id, progressNote);
      if (response.success) {
        toast.success("Progress updated successfully");
        setIsProgressDialogOpen(false);
        setProgressNote("");
        fetchData();
      } else {
        toast.error(response.message || "Failed to update progress");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const handleQuickProgressUpdate = async () => {
    const targetTask = selectedTask || inProgressTasks.find(t => t._source !== 'task');
    if (!targetTask || !progressNote.trim() || targetTask._source === 'task') return;

    setIsUpdatingProgress(true);
    try {
      const response = await api.allocations.updateProgress(targetTask.id, progressNote);
      if (response.success) {
        toast.success("Current activity updated");
        setProgressNote("");
        fetchData();
      } else {
        toast.error(response.message || "Failed to update progress");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const clearCompletedTasks = async () => {
    // Only clear work allocations (not admin-assigned tasks)
    const completedAllocationIds = completedTasks
      .filter(t => t._source !== 'task')
      .map(t => t.id);
    if (completedAllocationIds.length === 0) {
      toast.info('No completed work tasks to clear');
      return;
    }
    try {
      await Promise.all(completedAllocationIds.map(id => api.allocations.delete(id)));
      setAllocations((prev) => prev.filter((task) => !completedAllocationIds.includes(task.id)));
      toast.success(`Cleared ${completedAllocationIds.length} completed task(s)`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear completed tasks');
    }
  };


  const handleSelfAssign = async () => {
    if (!selfAssignData.title || !selfAssignData.workId) {
      toast.error("Please fill in the required fields");
      return;
    }
    setIsSubmittingNewWork(true);
    try {
      const payload = {
        ...selfAssignData,
        workId: parseInt(selfAssignData.workId),
        clientId: selfAssignData.clientId ? parseInt(selfAssignData.clientId) : null,
        dueDate: new Date(selfAssignData.dueDate).toISOString()
      };
      const response = await api.allocations.selfAssign(payload);
      if (response.success) {
        toast.success("Work started and admin notified");
        setIsSelfAssignDialogOpen(false);
        setSelfAssignData({
          title: '',
          description: '',
          workId: '',
          clientId: '',
          priority: 'medium',
          dueDate: format(new Date(), 'yyyy-MM-dd')
        });
        fetchData();
      } else {
        toast.error(response.message || "Failed to start work");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsSubmittingNewWork(false);
    }
  };

  const TaskCard = ({ task, index }: { task: any; index: number }) => (
    <Card
      className={cn(
        "transition-all duration-200 cursor-pointer border shadow-sm hover:shadow-md",
        statusColors[task.status]
      )}
      onClick={() => {
        setSelectedTask(task);
        setIsDetailDialogOpen(true);
      }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn("capitalize px-2 py-0 h-5 text-[10px] font-semibold", priorityColors[task.priority])} variant="outline">
                {task.priority || 'medium'}
              </Badge>
              {task._source === 'task' && (
                <Badge className={cn(
                  "px-2 py-0 h-5 text-[10px] font-semibold",
                  task.taskType === 'monthly'
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
                )} variant="outline">
                  {task.taskType === 'monthly' ? 'Monthly' : 'Daily'}
                </Badge>
              )}
              {task.groupId && (
                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 px-2 py-0 h-5 text-[10px] font-semibold" variant="outline">
                  Group Task
                </Badge>
              )}
              {task.requestStatus === 'pending' && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 px-2 py-0 h-5 text-[10px]">Request Pending</Badge>
              )}
              {isOverdue(task.dueDate || task.DueDate, task.status) && (
                <Badge variant="destructive" className="gap-1 px-2 py-0 h-5 text-[10px]">
                  <AlertCircle className="h-3 w-3" />
                  Overdue
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-base mb-1 truncate text-slate-900">{task.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2 mb-4">{task.description}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              {getClient(task.clientId) && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  {getClient(task.clientId).logoUrl ? (
                    <img src={getClient(task.clientId).logoUrl} alt={getClient(task.clientId).name} className="h-3.5 w-3.5 object-contain" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5" />
                  )}
                  {getClient(task.clientId).name}
                </div>
              )}
              <div className={cn(
                "flex items-center gap-1.5",
                isOverdue(task.dueDate || task.DueDate, task.status) ? 'text-rose-600 font-medium' : 'text-slate-600'
              )}>
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(task.dueDate || task.DueDate), 'MMM dd, yyyy')}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {task.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(task.id, task._source === 'task' ? 'in_progress' : 'in-progress');
                }}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Start Task
              </Button>
            )}
            {(task.status === 'in-progress' || task.status === 'in_progress') && (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTask(task);
                    setCompletionDuration({ hours: "0", minutes: "0" });
                    setIsDurationDialogOpen(true);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Complete
                </Button>
                {task._source !== 'task' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(task);
                      setProgressNote(task.progressNote || "");
                      setIsProgressDialogOpen(true);
                    }}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Update Progress
                  </Button>
                )}
              </div>
            )}
            {task.status === 'completed' && (task.completedAt || task.CompletedAt) && (
              <div className="text-right">
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0 h-5 text-[10px]" variant="outline">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
                <p className="text-[10px] text-slate-400 mt-1">
                  {format(new Date(task.completedAt || task.CompletedAt), 'MMM dd, HH:mm')}
                </p>
              </div>
            )}
          </div>
        </div>

        {task.status !== 'completed' && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
            <p className={cn(
              "text-xs",
              isOverdue(task.dueDate || task.DueDate, task.status) ? 'text-rose-600 font-medium' : 'text-slate-500'
            )}>
              {getDaysRemaining(task.dueDate || task.DueDate)}
            </p>
            {task.progressNote && (
              <div className="bg-slate-50 p-2 rounded border border-slate-100 italic text-[11px] text-slate-600 line-clamp-2">
                <span className="font-semibold not-italic">Recent update:</span> "{task.progressNote}"
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Tasks</h1>
            <p className="text-sm text-muted-foreground max-w-[500px]">
              Manage your assigned work, log progress, and track your completion milestones.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md h-10 px-5 rounded-xl border-none"
              onClick={() => setIsSelfAssignDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span className="font-semibold">Start New Work</span>
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-3 h-8 bg-white dark:bg-slate-700 dark:text-slate-100 shadow-sm font-bold border-slate-200 dark:border-slate-600">
                {allItems.length} Total
              </Badge>
              <Badge variant="outline" className="px-3 h-8 bg-emerald-50 text-emerald-700 border-emerald-200 font-bold shadow-sm">
                {completionRate}% Complete
              </Badge>
            </div>
          </div>
        </div>

        {/* Task Type Filter — only affects admin-assigned tasks */}
        {adminTasks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Task Type:</span>
            {(['all', 'daily', 'monthly'] as TaskTypeFilter[]).map((type) => (
              <button
                key={type}
                onClick={() => setTaskTypeFilter(type)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                  taskTypeFilter === type
                    ? type === 'daily'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : type === 'monthly'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400'
                )}
              >
                {type === 'all' ? 'All Tasks' : type === 'daily' ? 'Daily Tasks' : 'Monthly Tasks'}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
              <TabsTrigger value="pending">To Do ({pendingTasks.length})</TabsTrigger>
              <TabsTrigger value="in-progress">In Progress ({inProgressTasks.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6 space-y-4">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                  <p className="text-muted-foreground">No tasks to do. Great job!</p>
                </div>
              ) : (
                pendingTasks.map((task, index) => (
                  <TaskCard key={task.id} task={task} index={index} />
                ))
              )}
            </TabsContent>

            <TabsContent value="in-progress" className="space-y-6 pt-4 mt-0">
              {inProgressTasks.length > 0 && (
                <Card className="border-blue-100 bg-blue-50/20 shadow-sm overflow-hidden text-slate-900">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-end gap-3">
                      <div className="flex-1 w-full space-y-1.5">
                        <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="h-3 w-3 animate-pulse" /> Live Status Update
                        </label>
                        <input
                          className="w-full bg-white border-blue-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                          placeholder="What are you doing right now? (e.g. Starting the client meeting...)"
                          value={progressNote}
                          onChange={(e) => setProgressNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && progressNote.trim() && !isUpdatingProgress) {
                              handleQuickProgressUpdate();
                            }
                          }}
                        />
                      </div>
                      <div className="w-full sm:w-auto space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Task</label>
                        <select
                          className="w-full bg-white border-slate-200 rounded-md px-3 py-2 text-sm outline-none"
                          value={selectedTask?.id || ''}
                          onChange={(e) => {
                            const task = inProgressTasks.find(t => t.id === parseInt(e.target.value));
                            setSelectedTask(task || null);
                          }}
                        >
                          {inProgressTasks.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={handleQuickProgressUpdate}
                        disabled={!progressNote.trim() || isUpdatingProgress}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                      >
                        {isUpdatingProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {inProgressTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inProgressTasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} index={index} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-muted-foreground">No tasks currently in progress.</p>
                  <p className="text-sm text-slate-400 mt-1">Start a task from the pending tab to see it here.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-6 space-y-4">
              {completedTasks.length > 0 && (
                <div className="flex justify-end mb-4">
                  <Button
                    variant="outline"
                    onClick={clearCompletedTasks}
                    className="gap-2 border-dashed text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All Completed ({completedTasks.length})
                  </Button>
                </div>
              )}
              {completedTasks.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-success opacity-20" />
                  <p className="text-muted-foreground">No completed tasks in the last 7 days.</p>
                  <p className="text-sm text-slate-400 mt-1">Tasks older than 7 days are automatically hidden.</p>
                </div>
              ) : (
                completedTasks.map((task, index) => (
                  <TaskCard key={task.id} task={task} index={index} />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Request Change Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Change</DialogTitle>
            <DialogDescription>
              Request a due date extension or changes to the task description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="dueDate" className="text-sm font-medium">Requested Due Date</label>
              <input
                id="dueDate"
                type="date"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={requestData.dueDate}
                onChange={(e) => setRequestData({ ...requestData, dueDate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium">Description Change / Reason</label>
              <textarea
                id="description"
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Explain why you need changes..."
                value={requestData.description}
                onChange={(e) => setRequestData({ ...requestData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRequestChange}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start New Work Dialog */}
      <Dialog open={isSelfAssignDialogOpen} onOpenChange={setIsSelfAssignDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Start New Work</DialogTitle>
            <DialogDescription>
              Notify the administrator about work you are starting independently.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sa-work">Work Category *</Label>
                <Select
                  value={selfAssignData.workId}
                  onValueChange={(val) => setSelfAssignData({ ...selfAssignData, workId: val })}
                >
                  <SelectTrigger id="sa-work">
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWorks.map(work => (
                      <SelectItem key={work.id} value={work.id.toString()}>
                        {work.workTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sa-client">Client (Optional)</Label>
                <Select
                  value={selfAssignData.clientId || undefined}
                  onValueChange={(val) => setSelfAssignData({ ...selfAssignData, clientId: val })}
                >
                  <SelectTrigger id="sa-client">
                    <SelectValue placeholder="No client selected" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="self-title" className="text-sm font-medium text-slate-700">Title / Brief Summary *</label>
              <input
                id="self-title"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                placeholder="What exactly are you starting?"
                value={selfAssignData.title}
                onChange={(e) => setSelfAssignData({ ...selfAssignData, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="self-description" className="text-sm font-medium text-slate-700">Description / Details</label>
              <textarea
                id="self-description"
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                placeholder="Add more details if needed..."
                value={selfAssignData.description}
                onChange={(e) => setSelfAssignData({ ...selfAssignData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="self-priority" className="text-sm font-medium text-slate-700">Priority</label>
                <select
                  id="self-priority"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  value={selfAssignData.priority}
                  onChange={(e) => setSelfAssignData({ ...selfAssignData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="self-dueDate" className="text-sm font-medium text-slate-700">Estimated Due Date</label>
                <input
                  id="self-dueDate"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  value={selfAssignData.dueDate}
                  onChange={(e) => setSelfAssignData({ ...selfAssignData, dueDate: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSelfAssignDialogOpen(false)} disabled={isSubmittingNewWork}>Cancel</Button>
            <Button
              onClick={handleSelfAssign}
              disabled={isSubmittingNewWork || !selfAssignData.title || !selfAssignData.workId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmittingNewWork ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Start Working
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Update Dialog */}
      <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Progress</DialogTitle>
            <DialogDescription>
              Let the administrator know what you are currently working on for this task.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="progressNote" className="text-sm font-medium">Ongoing Status / Progress Note</label>
              <textarea
                id="progressNote"
                className="flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Briefly describe your current progress..."
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                maxLength={500}
              />
              <p className="text-[10px] text-right text-slate-400">{progressNote.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProgressDialogOpen(false)} disabled={isUpdatingProgress}>Cancel</Button>
            <Button onClick={handleProgressUpdate} disabled={isUpdatingProgress || !progressNote.trim()}>
              {isUpdatingProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Completion Duration Dialog */}
      <Dialog open={isDurationDialogOpen} onOpenChange={setIsDurationDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>
              Please enter the total time you spent on this task.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hours">Hours</Label>
                <Select
                  value={completionDuration.hours}
                  onValueChange={(val) => setCompletionDuration({ ...completionDuration, hours: val })}
                >
                  <SelectTrigger id="hours">
                    <SelectValue placeholder="Hours" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 25 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>{i}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutes">Minutes</Label>
                <Select
                  value={completionDuration.minutes}
                  onValueChange={(val) => setCompletionDuration({ ...completionDuration, minutes: val })}
                >
                  <SelectTrigger id="minutes">
                    <SelectValue placeholder="Minutes" />
                  </SelectTrigger>
                  <SelectContent>
                    {['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                      <SelectItem key={m} value={m}>{m}m</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDurationDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                const duration = `${completionDuration.hours}h ${completionDuration.minutes}m`;
                handleStatusChange(selectedTask.id, 'completed', duration);
              }}
            >
              Finish & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing Detail Dialog Update */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-none shadow-2xl">
          {selectedTask && (
            <div className="flex flex-col">
              {/* ... existing header ... */}
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {/* ... badges ... */}
                    {selectedTask.groupId && (
                      <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-500/50">Group Task</Badge>
                    )}
                    {selectedTask.requestStatus === 'pending' && (
                      <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/50">Request Pending</Badge>
                    )}
                  </div>
                </div>
                {/* ... title and desc ... */}
              </div>

              <div className="p-6 space-y-4">
                {/* ... client info ... */}
                {/* ... due date ... */}

                {/* Add Request Info if exists */}
                {selectedTask.requestStatus === 'pending' && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1">Your Request is Pending</p>
                    {selectedTask.requestedDueDate && <p className="text-sm">New Date: {format(new Date(selectedTask.requestedDueDate), 'MMM dd, yyyy')}</p>}
                    {selectedTask.requestedDescription && <p className="text-sm mt-1">Note: {selectedTask.requestedDescription}</p>}
                  </div>
                )}

                {/* ... description ... */}
                {/* ... completed at ... */}

                <div className="pt-4 flex flex-col gap-2">
                  {/* ... actions ... */}
                  {(selectedTask.status === 'pending' || selectedTask.status === 'in-progress') && (
                    <Button
                      variant="outline"
                      className="w-full h-11 border-dashed"
                      onClick={() => {
                        setRequestData({
                          dueDate: selectedTask.dueDate ? format(new Date(selectedTask.dueDate), 'yyyy-MM-dd') : '',
                          description: ''
                        });
                        setIsRequestDialogOpen(true);
                        // Keep detail dialog open or close it? Let's keep it open behind or close it.
                        // If we close it, user experience might be disjointed. Dialogstacking works in Radix.
                      }}
                    >
                      Request Change / Extension
                    </Button>
                  )}

                  <Button variant="ghost" className="w-full h-11 text-slate-500 font-medium" onClick={() => setIsDetailDialogOpen(false)}>
                    Close Details
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyTasks;

