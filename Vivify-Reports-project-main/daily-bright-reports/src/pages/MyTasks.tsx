import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';
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
  Trash2,
  FileText
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
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const canView = user?.role === 'staff' ? hasPermission('work_orders', 'view') : true;
  const canCreate = user?.role === 'staff' ? hasPermission('work_orders', 'create') : true;

  // Redirect if no view permission
  React.useEffect(() => {
    if (!canView) {
      navigate('/dashboard');
    }
  }, [canView, navigate]);
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
  const [mobileTab, setMobileTab] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [selfAssignData, setSelfAssignData] = useState({
    title: '',
    description: '',
    workId: '',
    clientId: '',
    priority: 'medium',
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isSubmittingNewWork, setIsSubmittingNewWork] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, clientsRes, worksRes, adminTasksRes] = await Promise.all([
        api.allocations.getMyTasks().catch(() => ({ success: true, data: [] })),
        api.clients.getAll().catch(() => ({ success: true, data: [] })),
        api.works.getActive().catch(() => ({ success: true, data: [] })),
        api.tasks.getMyTasks().catch(() => ({ success: true, data: [] }))
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

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonth = format(today, 'yyyy-MM');

  // Apply daily/monthly filter (only affects admin tasks; allocations are always shown)
  const filteredItems = allItems.filter((item) => {
    if (taskTypeFilter === 'all') return true;
    // When filtering by daily/monthly, only show admin tasks (not work allocations)
    if (item._source !== 'task') return false;
    if (taskTypeFilter === 'daily') {
      // Daily tasks: show only if due today (or pending/in-progress for today)
      if (item.taskType !== 'daily') return false;
      const dueDate = item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : '';
      return dueDate === todayStr || item.status === 'pending' || item.status === 'in_progress';
    }
    if (taskTypeFilter === 'monthly') {
      // Monthly tasks: show only if due in current month
      if (item.taskType !== 'monthly') return false;
      const dueDate = item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM') : '';
      return dueDate === currentMonth || item.status === 'pending' || item.status === 'in_progress';
    }
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
    const targetTask = selectedTask || null;
    if (!targetTask) { toast.error('Please select a task first'); return; }
    if (!progressNote.trim() || targetTask._source === 'task') return;

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
    if (!canCreate) { toast.error("You don't have permission to create work"); return; }
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
        // Upload attachments if any
        if (attachments.length > 0 && response.data?.id) {
          await api.allocations.uploadAttachmentsBase64(response.data.id, attachments).catch(() => { });
          setAttachments([]);
        }
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

  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const parseAttachments = (raw: string): Array<{ name: string; src: string; isImage: boolean }> => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((f: any) => ({
          name: f.Name || f.name || 'File',
          src: f.Data || f.data || '',
          isImage: (f.Type || f.type || '').startsWith('image/'),
        }));
      }
    } catch { }
    // fallback: comma-separated URLs
    return raw.split(',').filter(Boolean).map(url => ({
      name: url.split('/').pop() || 'File',
      src: `https://api.vivifysoft.in/SkyCity${url}`,
      isImage: /\.(jpg|jpeg|png|gif|webp)$/i.test(url),
    }));
  };

  const TaskCard = ({ task, index }: { task: any; index: number }) => (
    <Card
      className={cn(
        "transition-all duration-200 cursor-pointer border hover:shadow-md hover:border-primary/30",
        statusColors[task.status]
      )}
      onClick={() => {
        setSelectedTask(task);
        setIsDetailDialogOpen(true);
      }}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Top row: badges */}
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <Badge className={cn("capitalize px-1.5 py-0 h-4 text-[10px] font-semibold", priorityColors[task.priority])} variant="outline">
                {task.priority || 'medium'}
              </Badge>
              {isOverdue(task.dueDate || task.DueDate, task.status) && (
                <Badge variant="destructive" className="gap-0.5 px-1.5 py-0 h-4 text-[10px]">
                  <AlertCircle className="h-2.5 w-2.5" /> Overdue
                </Badge>
              )}
              {task.requestStatus === 'pending' && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 px-1.5 py-0 h-4 text-[10px]">Pending Request</Badge>
              )}
            </div>
            {/* Title */}
            <h3 className="font-semibold text-sm truncate text-slate-900">{task.title || task.workTitle || task.taskName}</h3>
            {/* Description */}
            {task.description && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{task.description}</p>
            )}
            {/* Due date + attachments */}
            <div className="flex items-center gap-3 mt-1.5">
              <div className={cn("flex items-center gap-1 text-xs", isOverdue(task.dueDate || task.DueDate, task.status) ? 'text-rose-600 font-medium' : 'text-slate-500')}>
                <Calendar className="h-3 w-3" />
                {task.dueDate ? format(new Date(task.dueDate || task.DueDate), 'MMM dd, yyyy') : '—'}
              </div>
              {task.attachmentUrls && (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {parseAttachments(task.attachmentUrls).slice(0, 3).map((att, i) => (
                    att.isImage ? (
                      <img key={i} src={att.src} alt={att.name}
                        className="h-6 w-6 rounded object-cover border hover:opacity-80 cursor-zoom-in"
                        onClick={e => { e.stopPropagation(); setPreviewSrc(att.src); }} />
                    ) : (
                      <a key={i} href={att.src} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="text-[10px] bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">📎</a>
                    )
                  ))}
                </div>
              )}
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
      {/* ===== DESKTOP VIEW ===== */}
      <div className="hidden lg:block space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight">My Tasks</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Manage your assigned work, log progress, and track your completion milestones.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-2 h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 font-bold hidden sm:flex">
              {completionRate}% Done
            </Badge>
            <Button
              size="sm"
              className="gap-1.5 bg-primary hover:bg-primary/90 shadow-md h-9 px-3 rounded-xl border-none text-xs"
              onClick={() => {
                if (!canCreate) { toast.error("You don't have permission to create work"); return; }
                setIsSelfAssignDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="font-semibold">Start Work</span>
            </Button>
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
            <TabsList className="grid w-full grid-cols-3 h-10 rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="pending"
                className="rounded-lg text-xs font-semibold data-[state=active]:bg-rose-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
                <span className="flex items-center gap-1">
                  <span className="hidden sm:inline">To Do</span>
                  <span className="sm:hidden">Open</span>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold data-[state=active]:bg-white/20 data-[state=active]:text-white">
                    {pendingTasks.length}
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger value="in-progress"
                className="rounded-lg text-xs font-semibold data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
                <span className="flex items-center gap-1">
                  <span className="hidden sm:inline">In Progress</span>
                  <span className="sm:hidden">Active</span>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">
                    {inProgressTasks.length}
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger value="completed"
                className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
                <span className="flex items-center gap-1">
                  Done
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                    {completedTasks.length}
                  </span>
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                  <p className="text-muted-foreground">No tasks to do. Great job!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingTasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} index={index} />
                  ))}
                </div>
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
                          <option value="" disabled>Select a task...</option>
                          {inProgressTasks.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={handleQuickProgressUpdate}
                        disabled={!progressNote.trim() || isUpdatingProgress || !selectedTask}
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
                <div className="divide-y rounded-lg border overflow-hidden">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => { setSelectedTask(task); setIsDetailDialogOpen(true); }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{task.title || task.workTitle || task.taskName || '—'}</p>
                          <p className="text-xs text-muted-foreground">{task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant="outline" className={`text-[10px] ${task.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' : task.priority === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {task.priority}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ===== MOBILE VIEW ===== */}
      <div className="block lg:hidden min-h-screen bg-slate-50 dark:bg-slate-950 -mx-3 -mt-4 pb-[80px]">
        {/* Premium Header */}
        <div className="bg-primary/95 pt-10 pb-16 px-6 rounded-b-[2.5rem] shadow-lg text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />

          <div className="relative z-10 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">My Tasks</h1>
              <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Staff Portal · Task Center</p>
            </div>
            {canCreate && (
              <Button
                onClick={() => setIsSelfAssignDialogOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white rounded-2xl h-11 w-11 p-0 flex items-center justify-center shrink-0 active:scale-90 transition-all border border-white/10 backdrop-blur-md shadow-xl"
              >
                <Plus className="h-6 w-6 text-white" strokeWidth={3} />
              </Button>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex-1 mr-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Completion Progress</span>
                <span className="text-[10px] font-black text-white/90">{completionRate}%</span>
              </div>
              <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-white">{allItems.length}</span>
              <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">Total</span>
            </div>
          </div>
        </div>

        {/* 3-Stat Summary Row */}
        <div className="px-5 -mt-7 relative z-20 flex gap-2">
          {[
            { label: 'Pending', count: pendingTasks.length, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30', icon: AlertCircle, tab: 'pending' },
            { label: 'Active', count: inProgressTasks.length, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', icon: Clock, tab: 'in-progress' },
            { label: 'Done', count: completedTasks.length, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: CheckCircle2, tab: 'completed' },
          ].map((stat) => (
            <div
              key={stat.label}
              onClick={() => setMobileTab(stat.tab as any)}
              className={cn(
                "flex-1 bg-white dark:bg-card rounded-3xl p-3 shadow-lg ring-1 transition-all active:scale-95 cursor-pointer",
                mobileTab === stat.tab ? "ring-primary/40 shadow-primary/10" : "ring-black/5"
              )}
            >
              <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center mb-2", stat.bg)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
              <div>
                <p className={cn("text-lg font-black tracking-tight leading-none", stat.color)}>{stat.count}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Task Type Filters */}
        {adminTasks.length > 0 && (
          <div className="px-5 mt-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {(['all', 'daily', 'monthly'] as TaskTypeFilter[]).map(type => (
                <button
                  key={type}
                  onClick={() => setTaskTypeFilter(type)}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-95",
                    taskTypeFilter === type
                      ? type === 'daily' ? 'bg-blue-500 text-white shadow-md' : type === 'monthly' ? 'bg-purple-500 text-white shadow-md' : 'bg-primary text-white shadow-md'
                      : 'bg-white dark:bg-slate-800 text-slate-500 ring-1 ring-slate-100'
                  )}
                >
                  {type === 'all' ? 'All Tasks' : type === 'daily' ? 'Daily' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="px-5 mt-4 space-y-4 pb-12">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Syncing...</p>
            </div>
          ) : (
            <>
              {(mobileTab === 'pending' ? pendingTasks : mobileTab === 'in-progress' ? inProgressTasks : completedTasks).map(task => {
                const isDone = task.status === 'completed';
                const isActive = task.status === 'in-progress' || task.status === 'in_progress';
                const overdue = isOverdue(task.dueDate || task.DueDate, task.status);

                return (
                  <div
                    key={`${task._source}-${task.id}`}
                    className={cn(
                      "bg-white dark:bg-card rounded-[1.8rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] ring-1 transition-all active:scale-[0.98]",
                      overdue ? "ring-rose-100 bg-rose-50/10" : isActive ? "ring-blue-100 bg-blue-50/10" : "ring-black/5"
                    )}
                    onClick={() => { setSelectedTask(task); setIsDetailDialogOpen(true); }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className={cn("text-[8px] font-black uppercase tracking-wider h-5 px-2 rounded-full border", priorityColors[task.priority] || 'bg-slate-50 text-slate-500 border-slate-200')}>
                          {task.priority || 'medium'}
                        </Badge>
                        {overdue && <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider h-5 px-2 rounded-full bg-rose-500 text-white border-none">Overdue</Badge>}
                        {task._source === 'task' && <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider h-5 px-2 rounded-full bg-slate-900 text-white border-none">Admin</Badge>}
                      </div>
                      <div className="text-[10px] font-black text-slate-300">#{task.id}</div>
                    </div>

                    <h3 className={cn("text-base font-black tracking-tight leading-tight mb-2", isDone && "line-through opacity-50")}>
                      {task.title || task.workTitle || task.taskName}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 font-medium leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-800">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Due Date</span>
                        <div className={cn("flex items-center gap-1 text-[11px] font-black", overdue ? "text-rose-500" : "text-slate-700 dark:text-slate-300")}>
                          <Calendar className="h-3 w-3" />
                          {task.dueDate ? format(new Date(task.dueDate || task.DueDate), 'MMM dd, yyyy') : 'No date'}
                        </div>
                      </div>

                      {!isDone && (
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          {task.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(task.id, task._source === 'task' ? 'in_progress' : 'in-progress')}
                              className="h-9 px-4 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-blue-200"
                            >
                              <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Start
                            </Button>
                          )}
                          {isActive && (
                            <Button
                              size="sm"
                              onClick={() => { setSelectedTask(task); setCompletionDuration({ hours: '0', minutes: '0' }); setIsDurationDialogOpen(true); }}
                              className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-200"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Finish
                            </Button>
                          )}
                        </div>
                      )}

                      {isDone && (
                        <div className="flex items-center gap-1.5 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                          <CheckCircle2 className="h-4 w-4" />
                          Completed
                        </div>
                      )}
                    </div>

                    {!isDone && (
                      <p className={cn("text-[9px] font-black uppercase tracking-widest mt-2", overdue ? 'text-rose-500' : 'text-slate-400')}>
                        {getDaysRemaining(task.dueDate || task.DueDate)}
                      </p>
                    )}
                  </div>
                );
              })}

              {(mobileTab === 'pending' ? pendingTasks : mobileTab === 'in-progress' ? inProgressTasks : completedTasks).length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center px-8">
                  <div className="h-20 w-20 rounded-[2.5rem] bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
                    <ClipboardList className="h-10 w-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Empty List</h3>
                  <p className="text-xs text-slate-400 mt-2 font-medium">No tasks found in the "{mobileTab}" category. Great job keeping up!</p>
                </div>
              )}
            </>
          )}
        </div>
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
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Start New Work</DialogTitle>
            <DialogDescription>
              Notify the administrator about work you are starting independently.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sa-work">Work Category *</Label>
                <Select
                  value={selfAssignData.workId}
                  onValueChange={(val) => setSelfAssignData({ ...selfAssignData, workId: val })}
                >
                  <SelectTrigger id="sa-work" className="focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none border-slate-200">
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 overflow-y-auto">
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
                  <SelectTrigger id="sa-client" className="focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none border-slate-200">
                    <SelectValue placeholder="No client..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 overflow-y-auto">
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
                className="flex min-h-[56px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                placeholder="Add more details if needed..."
                rows={2}
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
          <div className="grid gap-2 px-6 pb-2">
            <label className="text-sm font-medium text-slate-700">
              Attachment <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div
              className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById('self-assign-file-input')?.click()}
            >
              <input id="self-assign-file-input" type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden"
                onChange={e => { setAttachments(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Click to upload images or documents</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5 text-xs">
                      <span className="truncate max-w-[100px]">{f.name}</span>
                      <button type="button" onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter((_, idx) => idx !== i)); }} className="text-muted-foreground hover:text-destructive">×</button>
                    </div>
                  ))}
                  <span className="text-xs text-primary">+ Add more</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t">
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
                <Label>Hours</Label>
                <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                  {Array.from({ length: 25 }, (_, i) => (
                    <button key={i} type="button"
                      onClick={() => setCompletionDuration({ ...completionDuration, hours: i.toString() })}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-accent ${completionDuration.hours === i.toString() ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}>
                      {i}h
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Minutes</Label>
                <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                  {['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                    <button key={m} type="button"
                      onClick={() => setCompletionDuration({ ...completionDuration, minutes: m })}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-accent ${completionDuration.minutes === m ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}>
                      {m}m
                    </button>
                  ))}
                </div>
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

      {/* Task Detail Dialog — full screen on mobile (Screen 3) */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl sm:rounded-2xl rounded-none sm:max-h-[90vh] h-full sm:h-auto max-h-full flex flex-col">
          {selectedTask && (
            <div className="flex flex-col h-full">
              {/* Mobile header with back button */}
              <div className={`flex items-center gap-3 px-4 py-3 text-white ${selectedTask.priority === 'high' ? 'bg-rose-500' :
                  selectedTask.priority === 'medium' ? 'bg-amber-500' : 'bg-[#1E5FA8]'
                }`}>
                <button onClick={() => setIsDetailDialogOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Task Detail</p>
                  <p className="text-sm font-bold truncate">{selectedTask.title || selectedTask.taskName || '—'}</p>
                </div>
                <Badge className="bg-white/20 text-white border-0 text-[10px] capitalize shrink-0">
                  {selectedTask.status?.replace('_', ' ').replace('-', ' ')}
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Status badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-xs font-semibold ${selectedTask.priority === 'high' ? 'border-rose-300 text-rose-600 bg-rose-50' :
                      selectedTask.priority === 'medium' ? 'border-amber-300 text-amber-600 bg-amber-50' :
                        'border-emerald-300 text-emerald-600 bg-emerald-50'
                    }`}>
                    {selectedTask.priority?.toUpperCase()} PRIORITY
                  </Badge>
                  {selectedTask._source === 'task' && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Admin Assigned</Badge>
                  )}
                  {selectedTask.requestStatus === 'pending' && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">Request Pending</Badge>
                  )}
                </div>

                {/* Description */}
                {selectedTask.description && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-foreground leading-relaxed">{selectedTask.description}</p>
                  </div>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Due Date</p>
                    <p className={`text-sm font-bold mt-0.5 ${isOverdue(selectedTask.dueDate, selectedTask.status) ? 'text-rose-600' : 'text-foreground'}`}>
                      {selectedTask.dueDate ? format(new Date(selectedTask.dueDate), 'MMM dd, yyyy') : '—'}
                    </p>
                    {isOverdue(selectedTask.dueDate, selectedTask.status) && (
                      <p className="text-[10px] text-rose-500 font-medium mt-0.5">⚠ Overdue</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Work Type</p>
                    <p className="text-sm font-bold mt-0.5 text-foreground">{selectedTask.workTitle || selectedTask.workCode || '—'}</p>
                  </div>
                  {selectedTask.duration && (
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Duration</p>
                      <p className="text-sm font-bold mt-0.5">{selectedTask.duration}</p>
                    </div>
                  )}
                  {(selectedTask.completedAt || selectedTask.CompletedAt) && (
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Completed</p>
                      <p className="text-sm font-bold mt-0.5 text-emerald-700">
                        {format(new Date(selectedTask.completedAt || selectedTask.CompletedAt), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Progress note */}
                {selectedTask.progressNote && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                    <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Latest Update</p>
                    <p className="text-sm text-blue-900 italic">"{selectedTask.progressNote}"</p>
                  </div>
                )}

                {/* Attachments */}
                {selectedTask.attachmentUrls && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {parseAttachments(selectedTask.attachmentUrls).map((att, i) => (
                        att.isImage ? (
                          <img key={i} src={att.src} alt={att.name}
                            className="h-20 w-20 rounded-xl object-cover border hover:opacity-80 transition-opacity cursor-zoom-in"
                            onClick={() => setPreviewSrc(att.src)} />
                        ) : (
                          <a key={i} href={att.src} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 text-slate-700 transition-colors">
                            📎 <span className="truncate max-w-[120px]">{att.name}</span>
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Request pending info */}
                {selectedTask.requestStatus === 'pending' && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-1">
                    <p className="font-semibold text-xs uppercase tracking-wide">Change Request Pending</p>
                    {selectedTask.requestedDueDate && <p>New Date: {format(new Date(selectedTask.requestedDueDate), 'MMM dd, yyyy')}</p>}
                    {selectedTask.requestedDescription && <p>Note: {selectedTask.requestedDescription}</p>}
                  </div>
                )}
              </div>

              {/* Bottom action buttons — Mark Complete + Escalate */}
              <div className="shrink-0 border-t bg-background p-4 space-y-2">
                {(selectedTask.status === 'in-progress' || selectedTask.status === 'in_progress') && (
                  <Button className="w-full h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
                    onClick={() => {
                      setCompletionDuration({ hours: "0", minutes: "0" });
                      setIsDurationDialogOpen(true);
                    }}>
                    <CheckCircle2 className="h-4 w-4" /> Mark Complete
                  </Button>
                )}
                {selectedTask.status === 'pending' && (
                  <Button className="w-full h-11 gap-2 bg-[#1E5FA8] hover:bg-blue-700 text-white font-semibold rounded-xl"
                    onClick={() => handleStatusChange(selectedTask.id, selectedTask._source === 'task' ? 'in_progress' : 'in-progress')}>
                    <PlayCircle className="h-4 w-4" /> Start Task
                  </Button>
                )}
                {(selectedTask.status === 'pending' || selectedTask.status === 'in-progress' || selectedTask.status === 'in_progress') && (
                  <Button variant="outline" className="w-full h-10 gap-2 border-dashed text-sm rounded-xl"
                    onClick={() => {
                      setRequestData({ dueDate: selectedTask.dueDate ? format(new Date(selectedTask.dueDate), 'yyyy-MM-dd') : '', description: '' });
                      setIsRequestDialogOpen(true);
                    }}>
                    Escalate / Request Change
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      {previewSrc && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
            onClick={() => setPreviewSrc(null)}
          >
            ✕
          </button>
          <img
            src={previewSrc}
            alt="Preview"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </DashboardLayout>
  );
};

export default MyTasks;