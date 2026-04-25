import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { mockClientsData } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Users,
  User,
  CheckCircle2,
  Clock,
  ArrowRight,
  Calendar,
  TrendingUp,
  ClipboardList,
  Building2,
  Briefcase,
  AlertCircle,
  ListTodo,
  Plus,
  BarChart3,
  RefreshCw,
  Zap,
  MessageSquare,
  Filter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
import {
  Target,
  Play,
  Pause,
  Check,
  CalendarDays,
  Timer,
  Award,
  Bell
} from 'lucide-react';

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [adminTasks, setAdminTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'today' | 'overdue'>('all');
  const [quickUpdatingId, setQuickUpdatingId] = useState<number | null>(null);
  // Consumed once on mount — true only when coming directly from login
  const shouldShowPopup = React.useRef(
    sessionStorage.getItem('show_task_popup') === '1'
  );

  // Clear the flag immediately so navigate-back never re-triggers
  React.useEffect(() => {
    if (shouldShowPopup.current) {
      sessionStorage.removeItem('show_task_popup');
    }
  }, []);

  const fetchData = async () => {
    try {
      const [reportsRes, allocationsRes, adminTasksRes] = await Promise.all([
        api.reports.getMyReports({}),
        api.allocations.getMyTasks(),
        api.tasks.getMyTasks()
      ]);

      if (reportsRes.success) setReports(reportsRes.data || []);
      if (allocationsRes.success) setAllocations(allocationsRes.data || []);
      if (adminTasksRes.success) {
        const normalized = (adminTasksRes.data || []).map((t: any) => ({
          ...t,
          _source: 'task',
          title: t.taskName,
          dueDate: t.dueDate,
          status: (t.status || 'pending').toLowerCase(),
        }));
        setAdminTasks(normalized);
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  // Quick status update directly from task row (no dialog)
  const handleQuickStatus = async (e: React.MouseEvent, task: any, newStatus: string) => {
    e.stopPropagation();
    setQuickUpdatingId(task.id);
    try {
      const isAdminTask = task._source === 'task';
      const statusForApi = isAdminTask ? newStatus : newStatus.replace('in_progress', 'in-progress');
      const response = isAdminTask
        ? await api.tasks.updateStatus(task.id, statusForApi)
        : await api.allocations.updateStatus(task.id, statusForApi);
      if (response.success) {
        toast.success(`Marked as ${newStatus.replace('_', ' ')}`);
        await fetchData();
      } else {
        toast.error('Failed to update');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setQuickUpdatingId(null);
    }
  };

  // Show popup only on login redirect, once data has loaded
  useEffect(() => {
    if (!shouldShowPopup.current) return;
    if (!isLoading && (allocations.length > 0 || adminTasks.length > 0)) {
      shouldShowPopup.current = false; // prevent re-fire on subsequent re-renders
      const hasPending = [...allocations, ...adminTasks].some(
        t => t.status === 'pending' || t.status === 'in-progress' || t.status === 'in_progress'
      );
      if (hasPending) setShowLoginPopup(true);
    }
  }, [isLoading, allocations, adminTasks]);

  // Unified task list: allocations (user-created) + admin-assigned tasks
  const allTasks = [
    ...allocations,
    ...adminTasks,
  ];

  const handleStatusUpdate = async (taskId: number, newStatus: string) => {
    setIsUpdating(true);
    try {
      const task = allTasks.find(t => t.id === taskId);
      const isAdminTask = task?._source === 'task';

      // Allocations use 'in-progress', admin tasks use 'in_progress'
      const statusForApi = isAdminTask
        ? newStatus
        : newStatus.replace('in_progress', 'in-progress');

      const response = isAdminTask
        ? await api.tasks.updateStatus(taskId, statusForApi)
        : await api.allocations.updateStatus(taskId, statusForApi);

      if (response.success) {
        toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
        await fetchData();
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

  const getTaskUrgency = (task: any) => {
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

  const pendingTasks = allTasks.filter((t: any) => t.status === 'pending');
  const inProgressTasks = allTasks.filter((t: any) => t.status === 'in-progress' || t.status === 'in_progress');
  const completedTasks = allTasks.filter((t: any) => t.status === 'completed');
  const overdueTasks = allTasks.filter((t: any) =>
    t.status !== 'completed' && new Date(t.dueDate || t.DueDate) < new Date()
  );

  const completionRate = allTasks.length > 0
    ? Math.round((completedTasks.length / allTasks.length) * 100)
    : 0;

  const today = new Date().toISOString().split('T')[0];
  const todayReport = reports.find((r: any) => {
    const d = r.date || r.Date;
    if (!d) return false;
    try { return format(parseISO(d), 'yyyy-MM-dd') === today; } catch { return false; }
  });

  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const report = reports.find((r: any) => {
      const d = r.date || r.Date;
      if (!d) return false;
      try { return format(parseISO(d), 'yyyy-MM-dd') === dateStr; } catch { return false; }
    });
    weeklyData.push({
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      entries: report?.entries?.length || 0,
    });
  }

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayTasks = allTasks.filter((t: any) => {
    if (!t.dueDate && !t.DueDate) return false;
    try { return isToday(new Date(t.dueDate || t.DueDate)); } catch { return false; }
  });

  return (
    <div className="w-full">
      {/* ===== DESKTOP VIEW ===== */}
      <div className="hidden lg:block space-y-5 animate-in fade-in duration-500">

      {/* Greeting Header */}
      <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-sky-400 px-6 py-6 text-white shadow-xl shadow-sky-500/15 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div>
            <p className="text-sm font-medium text-white/70">{getGreeting()},</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">
              {user?.fullName?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="text-xs text-white/60 mt-1">{format(new Date(), 'EEEE, MMMM dd yyyy')}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex gap-2">
              <Button size="icon" variant="ghost"
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/20 rounded-full"
                onClick={handleRefresh} disabled={isRefreshing}
                title="Refresh dashboard">
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/my-tasks')}
                className="gap-1.5 text-xs h-8 bg-white/20 hover:bg-white/30 text-white border-0">
                <ListTodo className="h-3.5 w-3.5" />
                My Tasks
              </Button>
              <Button size="sm" onClick={() => navigate('/daily-report')}
                className="gap-1.5 text-xs h-9 bg-white text-sky-600 hover:bg-white/90 font-bold px-4 shadow-sm border-none">
                <FileText className="h-4 w-4" />
                {todayReport ? 'Update Report' : 'Create Report'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'My Tasks', icon: ListTodo, path: '/my-tasks', color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Daily Report', icon: FileText, path: '/daily-report', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'Complaints', icon: MessageSquare, path: '/complaints', color: 'text-amber-600 bg-amber-50 border-amber-100' },
          { label: 'Community', icon: Users, path: '/chat', color: 'text-violet-600 bg-violet-50 border-violet-100' },
        ].map(({ label, icon: Icon, path, color }) => (
          <button key={path} onClick={() => navigate(path)}
            className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all hover:shadow-md active:scale-95", color)}>
            <Icon className="h-5 w-5" />
            <span className="text-[11px] font-semibold leading-tight">{label}</span>
          </button>
        ))}
      </div>



      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/my-tasks')}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <ListTodo className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Open</span>
          </div>
          <p className="text-3xl font-bold">{pendingTasks.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Open Tasks</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/my-tasks')}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">Active</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{inProgressTasks.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">In Progress</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/my-tasks')}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Done</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{completedTasks.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
        </div>

        <div className={cn("rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
          !todayReport ? 'bg-amber-50 border-amber-200' : 'bg-card')}
          onClick={() => navigate('/daily-report')}>
          <div className="flex items-center justify-between mb-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl",
              !todayReport ? 'bg-amber-200' : 'bg-emerald-100')}>
              <FileText className={cn("h-4 w-4", !todayReport ? 'text-amber-700' : 'text-emerald-600')} />
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              !todayReport ? 'text-amber-700 bg-amber-100 border-amber-300' : 'text-emerald-600 bg-emerald-50 border-emerald-200')}>
              {!todayReport ? 'Pending' : 'Filed'}
            </span>
          </div>
          <p className={cn("text-sm font-bold leading-tight", !todayReport ? 'text-amber-700' : 'text-emerald-600')}>
            {!todayReport ? 'Pending Report' : 'Report Filed'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Today's status</p>
        </div>
      </div>

      {/* Main Content — Today's Tasks + Activity */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Today's Tasks */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Tasks
                  {overdueTasks.length > 0 && (
                    <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                      {overdueTasks.length} overdue
                    </span>
                  )}
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate('/my-tasks')}>
                  All Tasks <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
              {/* Filter tabs */}
              <div className="flex gap-1 mt-2">
                {(['all', 'today', 'overdue'] as const).map(f => (
                  <button key={f} onClick={() => setTaskFilter(f)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-semibold transition-colors capitalize",
                      taskFilter === f
                        ? f === 'overdue' ? 'bg-rose-500 text-white' : 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}>
                    {f === 'all' ? `All (${[...pendingTasks, ...inProgressTasks].length})` :
                     f === 'today' ? `Today (${allTasks.filter(t => { try { return isToday(new Date(t.dueDate || t.DueDate)); } catch { return false; } }).length})` :
                     `Overdue (${overdueTasks.length})`}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[340px] overflow-y-auto">
              {(() => {
                let displayTasks: any[] = [];
                if (taskFilter === 'today') {
                  displayTasks = allTasks.filter(t => { try { return isToday(new Date(t.dueDate || t.DueDate)); } catch { return false; } });
                } else if (taskFilter === 'overdue') {
                  displayTasks = overdueTasks;
                } else {
                  // 'all' — show active tasks, today first
                  const todayT = allTasks.filter(t => { try { return isToday(new Date(t.dueDate || t.DueDate)) && t.status !== 'completed'; } catch { return false; } });
                  const rest = [...pendingTasks, ...inProgressTasks].filter(t => !todayT.find(x => x.id === t.id));
                  displayTasks = [...todayT, ...rest];
                }

                if (displayTasks.length === 0) {
                  return (
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 text-emerald-400 opacity-60" />
                      <p className="text-sm font-medium">
                        {taskFilter === 'today' ? 'No tasks due today!' :
                         taskFilter === 'overdue' ? 'No overdue tasks! 🎉' :
                         'All tasks completed!'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y">
                    {displayTasks.slice(0, 10).map((task: any) => {
                      const isOverdueTask = isPast(new Date(task.dueDate || task.DueDate)) && !isToday(new Date(task.dueDate || task.DueDate));
                      const isBusy = quickUpdatingId === task.id;
                      return (
                        <div key={`${task._source}-${task.id}`}
                          className="flex items-center gap-2.5 px-4 py-1.5 group">
                          {/* Status dot */}
                          <div className={cn("h-2 w-2 rounded-full shrink-0",
                            task.status === 'completed' ? 'bg-emerald-500' :
                            task.status === 'in-progress' || task.status === 'in_progress' ? 'bg-blue-500' :
                            isOverdueTask ? 'bg-rose-500' : 'bg-amber-400'
                          )} />

                          {/* Task info */}
                          <div className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => { setSelectedTask(task); setIsStatusDialogOpen(true); }}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-medium truncate leading-tight">{task.title || task.taskName}</p>
                              <span className={cn("text-xs shrink-0", isOverdueTask ? 'text-rose-500 font-semibold' : 'text-muted-foreground')}>
                                · {isOverdueTask ? '⚠ ' : ''}{format(new Date(task.dueDate || task.DueDate), 'MMM dd')}
                              </span>
                              {task._source === 'task' && <span className="text-xs text-blue-400 shrink-0">· Admin</span>}
                              {task.priority && (
                                <span className={cn("text-xs font-semibold capitalize shrink-0",
                                  task.priority === 'high' ? 'text-rose-500' :
                                  task.priority === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                                )}>· {task.priority}</span>
                              )}
                            </div>
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {task.status !== 'in-progress' && task.status !== 'in_progress' && task.status !== 'completed' && (
                              <button onClick={e => handleQuickStatus(e, task, 'in_progress')} disabled={isBusy} title="Start"
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors disabled:opacity-50">
                                {isBusy ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />}
                              </button>
                            )}
                            {task.status !== 'completed' && (
                              <button onClick={e => handleQuickStatus(e, task, 'completed')} disabled={isBusy} title="Done"
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors disabled:opacity-50">
                                {isBusy ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                              </button>
                            )}
                          </div>

                          {/* Status badge */}
                          <Badge className={cn("text-[10px] px-1.5 py-0 h-4 capitalize shrink-0 pointer-events-none",
                            task.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            task.status === 'in-progress' || task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            isOverdueTask ? 'bg-rose-100 text-rose-700 border-rose-200' :
                            'bg-amber-100 text-amber-700 border-amber-200'
                          )}>
                            {task.status === 'in-progress' || task.status === 'in_progress' ? 'Active' :
                             task.status === 'completed' ? 'Done' :
                             isOverdueTask ? 'Overdue' : 'Pending'}
                          </Badge>
                        </div>
                      );
                    })}
                    {displayTasks.length > 10 && (
                      <div className="px-4 py-2 text-center">
                        <button onClick={() => navigate('/my-tasks')}
                          className="text-xs text-primary font-semibold hover:underline">
                          +{displayTasks.length - 10} more — View all
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
              </div>
            </CardContent>
          </Card>

          {/* Admin Updates Alert */}
          {reports.flatMap(r =>
            (r.entries || [])
              .filter((e: any) => e.status === 'pending' && e.adminDueDate)
              .map((e: any) => ({ ...e, reportDate: r.date || r.Date }))
          ).length > 0 && (
            <Card className="border-primary/20 bg-primary/5 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-primary">
                  <AlertCircle className="h-4 w-4" />
                  Admin Updates Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reports.flatMap(r =>
                  (r.entries || [])
                    .filter((e: any) => e.status === 'pending' && e.adminDueDate)
                    .map((e: any) => ({ ...e, reportDate: r.date || r.Date }))
                ).map((update, idx) => {
                  const isOverdue = new Date(update.adminDueDate) < new Date();
                  return (
                    <div key={idx} className={cn("p-3 rounded-xl border", isOverdue ? 'bg-destructive/5 border-destructive/20' : 'bg-background border-primary/10')}>
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-sm">{update.workTitle}</p>
                        <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px]">
                          {isOverdue ? "Overdue" : "Updated"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        New due: <span className={cn("font-medium", isOverdue ? 'text-destructive' : 'text-primary')}>
                          {format(new Date(update.adminDueDate), 'MMM dd, yyyy')}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — Performance + Stats + Chart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Completion ring / performance */}
          <Card className="shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-600" />
                My Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                      strokeDasharray={`${completionRate} ${100 - completionRate}`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-lg font-bold">{completionRate}%</span>
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{allTasks.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-600">Completed</span>
                    <span className="font-semibold text-emerald-600">{completedTasks.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-600">In Progress</span>
                    <span className="font-semibold text-blue-600">{inProgressTasks.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-600">Pending</span>
                    <span className="font-semibold text-amber-600">{pendingTasks.length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today's report status */}
          <Card className="shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Today's Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayReport ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-xs font-medium text-emerald-600">Filed at {format(parseISO(todayReport.date || todayReport.Date), 'HH:mm')}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Entries</span>
                    <span className="font-semibold text-foreground">{todayReport.entries?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pending items</span>
                    <span className="font-semibold text-amber-600">
                      {(todayReport.entries || []).filter((e: any) => e.status === 'pending').length}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1" onClick={() => navigate('/daily-report')}>
                    Update Report
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-medium text-amber-600">Not submitted yet</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Submit your daily report to track your work progress.</p>
                  <Button size="sm" className="w-full h-7 text-xs mt-1" onClick={() => navigate('/daily-report')}>
                    Create Report
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Overdue summary */}
          {overdueTasks.length > 0 && (
            <Card className="shadow-sm rounded-2xl border-rose-200 bg-rose-50/50 cursor-pointer" onClick={() => setShowAllOverdue(true)}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-rose-700">{overdueTasks.length} Overdue Task{overdueTasks.length > 1 ? 's' : ''}</p>
                      <p className="text-[10px] text-rose-500">Tap to view all</p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-rose-400" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity chart */}
          <Card className="shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Activity Overview</CardTitle>
              <CardDescription className="text-xs">Report entries — last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={6} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={20} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: 12 }} />
                    <Area type="monotone" dataKey="entries" stroke="hsl(var(--primary))" strokeWidth={2}
                      fillOpacity={1} fill="url(#colorEntries)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div> {/* END DESKTOP VIEW */}

      {/* ===== MOBILE VIEW (App-Like) ===== */}
      <div className="block lg:hidden min-h-screen bg-slate-50 dark:bg-slate-950 -mt-5 pb-[80px] -mx-3">
        {/* Mobile App Header (Curved Bottom) */}
        <div className="bg-primary pt-10 pb-24 px-6 rounded-b-[3rem] shadow-xl relative z-0">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm text-primary-foreground/90 font-medium">{getGreeting()},</p>
              <h1 className="text-2xl font-black tracking-tight text-white">{user?.fullName?.split(' ')[0] || 'there'}</h1>
              <p className="text-xs text-primary-foreground/70 mt-1 font-semibold tracking-wide uppercase">{format(new Date(), 'EEEE, MMM dd')}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-[42px] w-[42px] text-white rounded-full bg-white/10 hover:bg-white/20 ring-1 ring-white/20" onClick={handleRefresh}>
                 <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
          
          <div className="flex flex-col items-center justify-center mt-2">
            <p className="text-[10px] text-white/60 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Award className="h-3.5 w-3.5" /> Performance Score
            </p>
            <div className="text-6xl font-black tracking-tighter text-white">
              {completionRate}<span className="text-3xl opacity-50 font-bold">%</span>
            </div>
          </div>
        </div>

        {/* Floating Quick Action Cards */}
        <div className="px-5 -mt-10 relative z-10">
          <div className="bg-card rounded-[1.5rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-black/5 flex justify-between items-center bg-white dark:bg-card">
            <div className="flex flex-col items-center gap-2 flex-1 border-r border-slate-100 last:border-0 cursor-pointer group" onClick={() => navigate('/my-tasks')}>
               <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center group-active:scale-95 transition-transform">
                 <ListTodo className="h-5 w-5" />
               </div>
               <div className="text-center">
                 <span className="block text-sm font-black text-slate-800">{pendingTasks.length}</span>
                 <span className="block text-[9px] font-bold text-amber-600 uppercase tracking-wider">Pending</span>
               </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 flex-1 border-r border-slate-100 last:border-0 cursor-pointer group" onClick={() => navigate('/my-tasks')}>
               <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center group-active:scale-95 transition-transform">
                 <Clock className="h-5 w-5" />
               </div>
               <div className="text-center">
                 <span className="block text-sm font-black text-slate-800">{inProgressTasks.length}</span>
                 <span className="block text-[9px] font-bold text-blue-600 uppercase tracking-wider">Active</span>
               </div>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1 cursor-pointer group" onClick={() => navigate('/my-tasks')}>
               <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-active:scale-95 transition-transform">
                 <CheckCircle2 className="h-5 w-5" />
               </div>
               <div className="text-center">
                 <span className="block text-sm font-black text-slate-800">{completedTasks.length}</span>
                 <span className="block text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Done</span>
               </div>
            </div>
          </div>
        </div>

        {/* Main Interface Grid */}
        <div className="px-5 mt-8 space-y-7">
          {/* Action Menu */}
          <div>
            <div className="flex justify-between items-end mb-3.5">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">Quick Tools</h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Tasks', icon: ListTodo, path: '/my-tasks', color: 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/20' },
                { label: 'Report', icon: FileText, path: '/daily-report', color: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20' },
                { label: 'Chat', icon: MessageSquare, path: '/chat', color: 'bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-indigo-500/20' },
                { label: 'Issues', icon: AlertCircle, path: '/complaints', color: 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/20' }
              ].map(({ label, icon: Icon, path, color }) => (
                <button key={path} onClick={() => navigate(path)} className="flex flex-col items-center gap-2.5">
                   <div className={cn("h-14 w-14 rounded-[1.25rem] flex items-center justify-center text-white shadow-lg transition-transform active:scale-90", color)}>
                     <Icon className="h-6 w-6" strokeWidth={2.5} />
                   </div>
                   <span className="text-[11px] font-bold text-slate-600">{label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Overdue Warning */}
          {overdueTasks.length > 0 && (
            <div className="bg-rose-500 shadow-lg shadow-rose-500/20 rounded-[1.5rem] p-4 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-transform text-white" onClick={() => setShowAllOverdue(true)}>
               <div className="flex items-center gap-3.5">
                 <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                   <AlertCircle className="h-6 w-6" />
                 </div>
                 <div>
                   <p className="text-sm font-black tracking-tight">Overdue Tasks Detected</p>
                   <p className="text-[11px] font-medium text-rose-100">Action required on {overdueTasks.length} items</p>
                 </div>
               </div>
               <ArrowRight className="h-5 w-5 text-rose-200" />
            </div>
          )}

          {/* Today's Tasks */}
          <div>
            <div className="flex justify-between items-end mb-3.5">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">Today's Focus</h3>
              <button 
                className="text-xs font-bold text-primary active:opacity-50"
                onClick={() => navigate('/my-tasks')}
              >
                See all
              </button>
            </div>
            
            <div className="bg-white dark:bg-card rounded-[1.5rem] shadow-[0_4px_20px_rgb(0,0,0,0.05)] ring-1 ring-slate-100 dark:ring-slate-800 p-2 space-y-1">
              {(() => {
                const todayTasksMobile = allTasks.filter(t => { try { return isToday(new Date(t.dueDate || t.DueDate)); } catch { return false; } });
                const toShow = todayTasksMobile.length > 0 ? todayTasksMobile.slice(0, 5) : [...pendingTasks, ...inProgressTasks].slice(0, 5);
                
                if (toShow.length === 0) {
                  return (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <div className="h-16 w-16 mb-3 rounded-full bg-slate-50 flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-black text-slate-500 tracking-tight">You're all caught up!</p>
                      <p className="text-xs font-medium text-slate-400 mt-0.5">No immediate tasks pending.</p>
                    </div>
                  );
                }

                return toShow.map((task: any) => {
                  const isBusy = quickUpdatingId === task.id;
                  const isTaskDone = task.status === 'completed';
                  return (
                    <div key={`${task._source}-${task.id}`} className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 transition-colors active:bg-slate-100" onClick={() => { setSelectedTask(task); setIsStatusDialogOpen(true); }}>
                       <div className="flex items-center gap-3.5 min-w-0">
                          <button 
                             onClick={(e) => { 
                               e.stopPropagation();
                               handleQuickStatus(e, task, isTaskDone ? 'pending' : 'completed');
                             }}
                             disabled={isBusy}
                             className={cn("h-7 w-7 rounded-full border-[2.5px] flex items-center justify-center shrink-0 transition-all", 
                               isTaskDone ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'border-slate-300 text-transparent'
                             )}
                          >
                             {isBusy ? <RefreshCw className="h-3 w-3 animate-spin text-primary" /> : <Check className="h-4 w-4" strokeWidth={3} />}
                          </button>
                          
                          <div className="min-w-0">
                            <p className={cn("text-[13px] font-black truncate transition-colors tracking-tight", isTaskDone ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200')}>
                              {task.title || task.taskName}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 tracking-wide uppercase mt-0.5">
                              {task._source === 'task' ? 'Admin' : 'Me'} {task.priority && ` • ${task.priority}`}
                            </p>
                          </div>
                       </div>
                       <div className={cn("h-2 w-2 rounded-full shrink-0", 
                         isTaskDone && 'bg-emerald-500',
                         (task.status === 'in_progress' || task.status === 'in-progress') && 'bg-blue-500',
                         (!isTaskDone && task.status !== 'in_progress' && task.status !== 'in-progress') && 'bg-amber-400'
                       )} />
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Login Popup — pending tasks reminder on first visit per session */}
      <Dialog open={showLoginPopup} onOpenChange={setShowLoginPopup}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold !text-white">Welcome back, {user?.fullName?.split(' ')[0]} 👋</h2>
                <p className="text-xs text-white/80 mt-0.5">
                  You have pending tasks that need your attention.
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4 pb-2">
            <Tabs defaultValue="daily">
              <TabsList className="w-full">
                <TabsTrigger value="daily" className="flex-1 gap-1.5">
                  <Timer className="h-3.5 w-3.5" />
                  Daily Tasks
                  {(() => {
                    const count = [
                      ...allocations.filter(t => t.status !== 'completed'),
                      ...adminTasks.filter(t => t.status !== 'completed' && !t.isRecurring),
                    ].length;
                    return count > 0 ? (
                      <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                        {count}
                      </span>
                    ) : null;
                  })()}
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1 gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Monthly Tasks
                  {(() => {
                    const count = adminTasks.filter(t => t.status !== 'completed' && t.isRecurring).length;
                    return count > 0 ? (
                      <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                        {count}
                      </span>
                    ) : null;
                  })()}
                </TabsTrigger>
              </TabsList>

              {/* Daily Tasks Tab */}
              <TabsContent value="daily" className="mt-3">
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {[
                    ...allocations.filter(t => t.status !== 'completed'),
                    ...adminTasks.filter(t => t.status !== 'completed' && !t.isRecurring),
                  ].length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                      <p className="text-sm">All daily tasks completed!</p>
                    </div>
                  ) : (
                    [
                      ...allocations.filter(t => t.status !== 'completed').map(t => ({ ...t, _type: 'allocation' })),
                      ...adminTasks.filter(t => t.status !== 'completed' && !t.isRecurring).map(t => ({ ...t, _type: 'admin' })),
                    ].map((t: any) => (
                      <div key={`${t._type}-${t.id}`} className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn("h-2 w-2 rounded-full shrink-0",
                            t.status === 'in_progress' || t.status === 'in-progress' ? 'bg-blue-500' : 'bg-amber-400'
                          )} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{t.title || t.taskName}</p>
                            <p className="text-xs text-muted-foreground">
                              Due: {t.dueDate ? format(new Date(t.dueDate), 'MMM dd, yyyy') : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Badge className={cn("capitalize text-[10px] px-1.5",
                            t.priority === 'high' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                            t.priority === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-emerald-100 text-emerald-700 border-emerald-200'
                          )}>
                            {t.priority}
                          </Badge>
                          <Badge className={cn("capitalize text-[10px] px-1.5",
                            t.status === 'in_progress' || t.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          )}>
                            {(t.status || 'pending').replace('_', ' ').replace('-', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Monthly Tasks Tab */}
              <TabsContent value="monthly" className="mt-3">
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {adminTasks.filter(t => t.status !== 'completed' && t.isRecurring).length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                      <p className="text-sm">All monthly tasks completed!</p>
                    </div>
                  ) : (
                    adminTasks
                      .filter(t => t.status !== 'completed' && t.isRecurring)
                      .map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn("h-2 w-2 rounded-full shrink-0",
                              t.status === 'in_progress' ? 'bg-blue-500' : 'bg-purple-400'
                            )} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{t.title || t.taskName}</p>
                              <p className="text-xs text-muted-foreground">
                                Due: {t.dueDate ? format(new Date(t.dueDate), 'MMM dd, yyyy') : '—'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <Badge className={cn("capitalize text-[10px] px-1.5",
                              t.priority === 'high' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                              t.priority === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              'bg-emerald-100 text-emerald-700 border-emerald-200'
                            )}>
                              {t.priority}
                            </Badge>
                            <Badge className={cn("capitalize text-[10px] px-1.5",
                              t.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            )}>
                              {(t.status || 'pending').replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-xs text-muted-foreground">
              {[...allocations, ...adminTasks].filter(t => t.status !== 'completed').length} task(s) pending
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowLoginPopup(false)}>
                Dismiss
              </Button>
              <Button size="sm" onClick={() => { setShowLoginPopup(false); navigate('/my-tasks'); }}>
                <ListTodo className="h-3.5 w-3.5 mr-1" />
                View All Tasks
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Task Status</DialogTitle>
            <DialogDescription>
              Update the status of "{selectedTask?.title || selectedTask?.taskName}"
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

      {/* All Overdue Tasks Popup */}
      {showAllOverdue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowAllOverdue(false)}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b bg-rose-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                <h2 className="font-bold text-rose-800">All Overdue Tasks ({overdueTasks.length})</h2>
              </div>
              <button onClick={() => setShowAllOverdue(false)}
                className="h-7 w-7 rounded-full bg-rose-100 hover:bg-rose-200 flex items-center justify-center text-rose-700">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {overdueTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-rose-200">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{task.title || task.taskName}</p>
                    <p className="text-xs text-rose-600 font-medium">
                      Due: {format(new Date(task.dueDate || task.DueDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <Button size="sm" className="shrink-0 ml-2" onClick={() => {
                    setSelectedTask(task);
                    setIsStatusDialogOpen(true);
                    setShowAllOverdue(false);
                  }}>
                    Update
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [pendingWork, setPendingWork] = useState<any[]>([]);
  const [adminTasks, setAdminTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [assistanceRequests, setAssistanceRequests] = useState<any[]>([]);
  // Task Dashboard Integration
  const [taskStats, setTaskStats] = useState<any>(null);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [taskPerformance, setTaskPerformance] = useState<any[]>([]);
  const [allAllocations, setAllAllocations] = useState<any[]>([]);

  useEffect(() => {
    const fetchAdminData = async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const [statsRes, reportsRes, tasksRes, liveRes, taskStatsRes, allTasksRes, taskPerfRes, allAllocRes] = await Promise.all([
          api.admin.getDashboardStats(),
          api.admin.getAllReports({}),
          api.allocations.getMyTasks(),
          api.allocations.getLiveActivities(),
          // Task Dashboard Integration
          api.tasks.getStats(),          api.tasks.getAll(),
          api.tasks.getPerformance(),
          // User-created allocations (all users)
          api.allocations.getAll()
        ]);

        if (statsRes.success) setStats(statsRes.data);
        if (tasksRes.success) setAdminTasks(tasksRes.data || []);
        if (liveRes.success) setLiveActivities(liveRes.data || []);

        // Fetch assistance requests
        try {
          const assistRes = await api.assistance.getAll();
          if (assistRes.success) setAssistanceRequests(assistRes.data || []);
        } catch { /* ignore */ }

        // Task Dashboard Integration
        if (taskStatsRes.success) setTaskStats(taskStatsRes.data);
        if (taskPerfRes.success) setTaskPerformance(taskPerfRes.data || []);

        // Merge admin tasks + user allocations for Recent Tasks list
        const adminTaskList = allTasksRes.success ? (allTasksRes.data || []).map((t: any) => ({
          ...t,
          _source: 'task',
          title: t.taskName,
        })) : [];
        const userAllocList = allAllocRes.success ? (allAllocRes.data || []).map((a: any) => ({
          ...a,
          _source: 'allocation',
          taskName: a.title,
          isRecurring: false,
          status: (a.status || 'pending').toLowerCase(),
        })) : [];
        if (allAllocRes.success) setAllAllocations(allAllocRes.data || []);

        // Sort combined list by createdAt descending, take top 5
        const combined = [...adminTaskList, ...userAllocList]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecentTasks(combined.slice(0, 5));

        if (reportsRes.success && reportsRes.data) {
          setAllReports(reportsRes.data);
          const pending = reportsRes.data.filter((r: any) =>
            r.entries && r.entries.some((e: any) => e.status === 'pending')
          );
          setPendingWork(pending);
        }
      } catch (error) {
        console.error("Admin dashboard error:", error);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    };

    fetchAdminData(true);

    const intervalId = setInterval(() => {
      fetchAdminData(false);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const totalUsers = stats?.totalUsers || 0;
  const totalReports = stats?.totalReports || 0;

  // Calculate real weekly volume from all reports
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = format(date, 'yyyy-MM-dd');

    // Count total entries across all reports for this day
    const dayReports = allReports.filter((r: any) => {
      const d = r.date || r.Date;
      if (!d) return false;
      try { return format(parseISO(d), 'yyyy-MM-dd') === dateStr; } catch { return false; }
    });
    const dailyEntries = dayReports.reduce((acc, r) => acc + (r.entries?.length || 0), 0);

    weeklyData.push({
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      entries: dailyEntries,
    });
  }

  return (
    <div className="w-full">
      {/* ===== DESKTOP VIEW ===== */}
      <div className="hidden lg:flex flex-col space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Terminal</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Overview of system activity and personnel</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/work-allocation')} className="gap-2">
            <ListTodo className="h-4 w-4" />
            Allocate Work
          </Button>
          <Button onClick={() => navigate('/admin/analytics')} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
            <TrendingUp className="h-4 w-4" />
            Advanced Analytics
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="hover-lift border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Personnel</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Active system users</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Reports</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalReports}</div>
            <p className="text-xs text-muted-foreground mt-1">Total submissions</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{taskStats?.totalTasks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All assigned tasks</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{taskStats?.completedTasks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully finished</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ongoing Tasks</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{(taskStats?.pendingTasks || 0) + (taskStats?.inProgressTasks || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Active task allocations</p>
          </CardContent>
        </Card>

        <Card className={`hover-lift border-none shadow-md ${(pendingWork.length > 0 || (taskStats?.overdueTasks || 0) > 0) ? 'bg-destructive/5' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
            <AlertCircle className={`h-4 w-4 ${(pendingWork.length > 0 || (taskStats?.overdueTasks || 0) > 0) ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${(pendingWork.length > 0 || (taskStats?.overdueTasks || 0) > 0) ? 'text-destructive' : ''}`}>
              {pendingWork.length + (taskStats?.overdueTasks || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Reports + Tasks overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Task Management Quick Access */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/employees')}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">Employee Tasks</CardTitle>
                <p className="text-sm text-muted-foreground">Manage individual assignments</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                View and assign employee tasks
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/analytics')}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                <BarChart3 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">Task Analytics</CardTitle>
                <p className="text-sm text-muted-foreground">Performance insights & reports</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                View completion rates and metrics
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <Plus className="h-6 w-6 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">Quick Task Creation</CardTitle>
                <p className="text-sm text-muted-foreground">Create and assign new tasks</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Assign tasks to multiple employees
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-xl border-destructive/20 bg-destructive/[0.02]">
            <CardHeader className="pb-3 border-b bg-destructive/[0.03]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Priority Monitor: Incomplete Work
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/analytics')} className="h-8 text-xs hover:text-destructive group">
                  View Full Details <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pendingWork.length > 0 ? (
                <div className="divide-y">
                  {pendingWork.slice(0, 5).map((report, idx) => (
                    <div key={idx} className="p-4 row-hover transition-colors flex items-start justify-between group">
                      <div className="flex gap-4">
                        <div className="mt-1 h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 border border-destructive/20 shadow-inner">
                          <User className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="font-bold text-base">{report.userName}</p>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Report Date: {format(parseISO(report.date || report.Date), 'MMM dd, yyyy')}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {report.entries.map((entry: any, eIdx: number) => (
                              <Badge key={eIdx} variant="outline" className="text-[10px] py-0 h-5 border-destructive/30 text-destructive bg-destructive/5 font-medium">
                                {entry.workTitle}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigate('/admin/analytics')}>
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">All reports are complete. No pending items detected.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>System-wide Submission Volume</CardTitle>
              <CardDescription>Aggregate reports filed across the entire organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="colorAdminEntries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="entries"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorAdminEntries)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-lg border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <Clock className="h-5 w-5 animate-pulse" />
                  Live Activity Feed
                </CardTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] animate-pulse">LIVE</Badge>
              </div>
              <CardDescription>Real-time updates from personnel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {liveActivities.length > 0 ? (
                  liveActivities.map((activity, idx) => (
                    <div className="relative pl-4 border-l-2 border-primary/20 pb-4 last:pb-0 group">
                      <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary group-hover:scale-125 transition-transform" />
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-bold text-foreground leading-none">{activity.assigneeName}</p>
                        <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap ml-2">
                          {activity.lastProgressUpdate ? formatDistanceToNow(new Date(activity.lastProgressUpdate), { addSuffix: true }) : ''}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-primary mb-1 leading-tight">
                        {activity.workTitle || activity.title}
                        {activity.clientName && <span className="text-muted-foreground font-normal"> • {activity.clientName}</span>}
                      </p>
                      <div className="bg-muted/30 p-2 rounded border border-primary/10 italic text-[11px] text-muted-foreground shadow-sm">
                        "{activity.progressNote}"
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400 italic text-sm">
                    Waiting for live updates...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Tasks Overview */}
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-blue-600" />
                  Recent Tasks
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/analytics')} className="h-8 text-xs">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {recentTasks.length > 0 ? (
                  recentTasks.map((task, idx) => (
                    <div key={`${task._source}-${task.id}`} className="flex items-start justify-between p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.taskName || task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task._source === 'task' ? `Assigned to: ${task.assigneeName}` : `By: ${task.assigneeName || task.assigner?.name || 'User'}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            className={cn(
                              "text-xs",
                              task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                              task.status === 'in_progress' || task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            )}
                          >
                            {(task.status || 'pending').replace('_', ' ')}
                          </Badge>
                          {task.groupId && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-indigo-100 text-indigo-700 border-indigo-200">Group</Badge>
                          )}
                          <Badge className={cn(
                            "text-[9px] px-1 py-0 h-4",
                            task._source === 'task'
                              ? 'bg-purple-100 text-purple-700 border-purple-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          )}>
                            {task._source === 'task' ? (task.groupId ? 'Group Task' : 'Admin') : 'User'}
                          </Badge>
                          {task.isRecurring && (
                            <Badge className="text-xs bg-purple-100 text-purple-800">
                              Recurring
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground ml-2">
                        {format(new Date(task.dueDate || task.DueDate), 'MMM dd')}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No recent tasks</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Administrative Tools</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button variant="outline" className="w-full justify-start h-12 gap-3 group" onClick={() => navigate('/admin/users')}>
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                  <Users size={18} />
                </div>
                Manage Personnel
              </Button>
              <Button variant="outline" className="w-full justify-start h-12 gap-3 group" onClick={() => navigate('/admin/clients')}>
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                  <Building2 size={18} />
                </div>
                Client Directory
              </Button>
              <Button variant="outline" className="w-full justify-start h-12 gap-3 group" onClick={() => navigate('/admin/works')}>
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                  <Briefcase size={18} />
                </div>
                Work Definitions
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
      </div>

      {/* ===== MOBILE VIEW (App-Like) ===== */}
      <div className="flex lg:hidden flex-col min-h-screen bg-slate-50 dark:bg-slate-950 -mt-5 pb-24 -mx-3 animate-in fade-in duration-300">
        {/* Mobile App Header (Curved Bottom) */}
        <div className="bg-primary pt-10 pb-20 px-6 rounded-b-[3rem] shadow-xl relative z-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <p className="text-sm text-primary-foreground/90 font-medium">System Control</p>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">Admin Terminal</h1>
              <p className="text-[10px] text-primary-foreground/70 mt-1 font-black tracking-widest uppercase italic">Operational Overview</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-white rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/20 shadow-lg" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Global Reports</p>
              <p className="text-2xl font-black text-white">{totalReports}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Active Personnel</p>
              <p className="text-2xl font-black text-white">{totalUsers}</p>
            </div>
          </div>
        </div>

        {/* Floating Quick Action Cards */}
        <div className="px-5 -mt-8 relative z-10">
          <div className="bg-card rounded-[2rem] p-5 shadow-[0_10px_40px_rgb(0,0,0,0.12)] ring-1 ring-black/5 flex justify-between items-center bg-white dark:bg-card">
            <div className="flex flex-col items-center gap-2 flex-1 border-r border-slate-100 last:border-0 cursor-pointer group active:scale-95 transition-transform" onClick={() => navigate('/admin/work-allocation')}>
               <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                 <ListTodo className="h-5 w-5" />
               </div>
               <div className="text-center">
                 <span className="block text-[10px] font-black text-slate-800 uppercase tracking-tighter">Allocate</span>
               </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 flex-1 border-r border-slate-100 last:border-0 cursor-pointer group active:scale-95 transition-transform" onClick={() => navigate('/admin/analytics')}>
               <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                 <TrendingUp className="h-5 w-5" />
               </div>
               <div className="text-center">
                 <span className="block text-[10px] font-black text-slate-800 uppercase tracking-tighter">Analytics</span>
               </div>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1 cursor-pointer group active:scale-95 transition-transform" onClick={() => navigate('/admin/users')}>
               <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                 <Users className="h-5 w-5" />
               </div>
               <div className="text-center">
                 <span className="block text-[10px] font-black text-slate-800 uppercase tracking-tighter">Personnel</span>
               </div>
            </div>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="px-5 mt-8 space-y-8">
          
          {/* Priority Alerts */}
          {(pendingWork.length > 0 || (taskStats?.overdueTasks || 0) > 0) && (
            <div>
              <div className="flex justify-between items-end mb-3">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Priority Alerts</h3>
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">Critical</span>
              </div>
              <div className="bg-rose-500 rounded-[2rem] p-5 shadow-lg shadow-rose-500/20 text-white relative overflow-hidden group active:scale-[0.98] transition-transform" onClick={() => navigate('/admin/analytics')}>
                 <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-xl pointer-events-none" />
                 <div className="flex justify-between items-center relative z-10">
                   <div className="flex items-center gap-4">
                     <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
                       <AlertCircle className="h-6 w-6 text-white" />
                     </div>
                     <div>
                       <p className="text-lg font-black tracking-tight leading-none">Incomplete Items</p>
                       <p className="text-xs font-bold text-rose-100 mt-1 uppercase tracking-wider">{pendingWork.length + (taskStats?.overdueTasks || 0)} issues need review</p>
                     </div>
                   </div>
                   <ArrowRight className="h-5 w-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                 </div>
              </div>
            </div>
          )}

          {/* Live Feed */}
          <div>
            <div className="flex justify-between items-end mb-4 px-1">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Live Activity</h3>
              <Badge className="bg-emerald-500 text-white border-none text-[8px] font-black h-4 px-1.5 animate-pulse">SYNCING</Badge>
            </div>
            <div className="bg-white dark:bg-card rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5 p-2 overflow-hidden border border-slate-100">
              <div className="max-h-[320px] overflow-y-auto space-y-1 p-1">
                {liveActivities.length > 0 ? (
                  liveActivities.map((activity, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3.5 rounded-[1.8rem] hover:bg-slate-50 active:bg-slate-100 transition-colors">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary shrink-0 shadow-sm">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate tracking-tight">{activity.assigneeName}</p>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter italic shrink-0 ml-2">
                             {activity.lastProgressUpdate ? formatDistanceToNow(new Date(activity.lastProgressUpdate), { addSuffix: true }) : ''}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-primary truncate uppercase tracking-tight mt-0.5">{activity.workTitle || activity.title}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate italic mt-1 leading-none">"{activity.progressNote}"</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center opacity-30 italic text-xs font-black uppercase tracking-widest text-slate-400">
                    No live data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div>
            <div className="flex justify-between items-end mb-4 px-1">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Key Metrics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white dark:bg-card p-5 rounded-[2rem] shadow-sm ring-1 ring-black/5 border border-slate-100 flex flex-col gap-3 active:scale-[0.98] transition-transform" onClick={() => navigate('/admin/analytics')}>
                  <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                    <ListTodo className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tighter leading-none">{taskStats?.totalTasks || 0}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Tasks</p>
                  </div>
               </div>
               <div className="bg-white dark:bg-card p-5 rounded-[2rem] shadow-sm ring-1 ring-black/5 border border-slate-100 flex flex-col gap-3 active:scale-[0.98] transition-transform" onClick={() => navigate('/admin/analytics')}>
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-emerald-600 tracking-tighter leading-none">{taskStats?.completedTasks || 0}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Completed</p>
                  </div>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Super admin should be on their own overview page
  React.useEffect(() => {
    if (user?.role === 'super_admin') {
      navigate('/super-admin/overview', { replace: true });
    }
  }, [user?.role]);

  if (user?.role === 'super_admin') return null;

  return (
    <DashboardLayout>
      {user?.role === 'admin' || user?.role === 'sub_admin' || user?.role === 'property_manager' || user?.role === 'facility_manager' ? <AdminDashboard /> : <UserDashboard />}
    </DashboardLayout>
  );
};

export default Dashboard;
