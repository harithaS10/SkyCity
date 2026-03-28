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
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/my-tasks')} className="flex-1 sm:flex-none gap-2 text-xs h-9">
            <ListTodo className="h-3.5 w-3.5" />
            My Tasks
          </Button>
          <Button size="sm" onClick={() => navigate('/daily-report')} className="flex-1 sm:flex-none gap-2 text-xs h-9 shadow-lg shadow-primary/20">
            <FileText className="h-3.5 w-3.5" />
            {todayReport ? "Update Report" : "Create Report"}
          </Button>
        </div>
      </div>

      {/* Enhanced Stats Cards with Task Dashboard Integration */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="hover-lift rounded-xl shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">To Do Tasks</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl sm:text-2xl font-bold">{pendingTasks.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Tasks awaiting start</p>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks.length}</div>
            <p className="text-xs text-muted-foreground">Active assignments</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Tasks</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{allTasks.length}</div>
            <p className="text-xs text-muted-foreground">Total assigned</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{completedTasks.length}</div>
            <p className="text-xs text-muted-foreground">Successfully finished</p>
          </CardContent>
        </Card>

        <Card className={`hover-lift ${!todayReport ? 'border-warning/50 bg-warning/5' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
            {todayReport ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-warning" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${!todayReport ? 'text-warning' : 'text-success'}`}>
              {todayReport ? 'Report Filed' : 'Pending Report'}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayReport ? 'Updated ' + format(parseISO(todayReport.date || todayReport.Date), 'HH:mm') : 'Required for today'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-none shadow-md">
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
                    <p className="font-medium text-sm">{task.title || task.taskName}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {format(new Date(task.dueDate || task.DueDate), 'MMM dd, yyyy')}
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

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4 space-y-6">
          {reports.flatMap(r =>
            (r.entries || [])
              .filter((e: any) => e.status === 'pending' && e.adminDueDate)
              .map((e: any) => ({ ...e, reportDate: r.date || r.Date }))
          ).length > 0 && (
              <Card className="border-primary/20 bg-primary/5 shadow-lg shadow-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <AlertCircle className="h-5 w-5" />
                    Attention Required: Admin Updates
                  </CardTitle>
                  <CardDescription className="text-primary/70">
                    Admins have updated due dates for these pending items.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reports.flatMap(r =>
                    (r.entries || [])
                      .filter((e: any) => e.status === 'pending' && e.adminDueDate)
                      .map((e: any) => ({ ...e, reportDate: r.date || r.Date }))
                  ).map((update, idx) => {
                    const isOverdue = new Date(update.adminDueDate) < new Date();
                    return (
                      <div key={idx} className={`p-4 rounded-lg border-2 shadow-sm transition-all ${isOverdue ? 'bg-destructive/5 border-destructive/20' : 'bg-background border-primary/10'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-base leading-tight">{update.workTitle}</h3>
                          <Badge variant={isOverdue ? "destructive" : "secondary"}>
                            {isOverdue ? "Overdue" : "Updated Due Date"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{update.description}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">New Due Date</p>
                            <p className={`text-sm font-semibold ${isOverdue ? 'text-destructive' : 'text-primary'}`}>
                              {format(new Date(update.adminDueDate), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">From Report</p>
                            <p className="text-sm font-semibold">{format(parseISO(update.reportDate), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

          <Card className="shadow-xl shadow-muted/20 border-none bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Activity Overview</CardTitle>
              <CardDescription className="text-xs">Daily report entry volume over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              <div className="h-[200px] sm:h-[300px] w-full mt-2 sm:mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
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
                      dy={10}
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
                      fill="url(#colorEntries)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-lg border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Active Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...pendingTasks, ...inProgressTasks].length > 0 ? (
                  [...pendingTasks, ...inProgressTasks].slice(0, 5).map((task) => (
                    <div key={`${task._source}-${task.id}`} className="group flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/my-tasks')}>
                      <div className="min-w-0 pr-4">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{task.title || task.taskName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Due {format(new Date(task.dueDate || task.DueDate), 'MMM dd')}</p>
                          {task._source === 'task' && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-blue-100 text-blue-700 border-blue-200">Admin</Badge>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize text-[10px] whitespace-nowrap">{task.priority}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-muted-foreground bg-muted/20 rounded-lg border-dashed border-2">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No active tasks</p>
                  </div>
                )}
                <Button variant="ghost" className="w-full text-sm group" onClick={() => navigate('/my-tasks')}>
                  View All Tasks <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Task Summary */}
          <Card className="shadow-lg border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                My Task Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allTasks.length > 0 ? (
                  allTasks.slice(0, 5).map((task) => (
                    <div key={`${task._source}-${task.id}`} className="flex items-start justify-between p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title || task.taskName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn("text-xs capitalize", priorityColors[task.priority])}>
                            {task.priority || 'medium'}
                          </Badge>
                          <Badge className={cn("text-xs capitalize", statusColors[task.status?.replace('-', '_')])}>
                            {(task.status || 'pending').replace('_', ' ')}
                          </Badge>
                          {task.groupId && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-indigo-100 text-indigo-700 border-indigo-200">Group</Badge>
                          )}
                          {task._source === 'task' && !task.groupId && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-blue-100 text-blue-700 border-blue-200">Admin</Badge>
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
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No tasks assigned</p>
                  </div>
                )}
                {allTasks.length > 5 && (
                  <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/my-tasks')}>
                    View all {allTasks.length} tasks <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground shadow-2xl shadow-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 scale-150">
              <ClipboardList size={80} />
            </div>
            <CardContent className="p-6 relative z-10">
              <h3 className="font-bold text-lg mb-2">Need Help?</h3>
              <p className="text-sm text-primary-foreground/80 mb-4 leading-relaxed">
                Contact your system administrator if you encounter any issues or have questions about your allocations.
              </p>
              <Button
                variant="secondary"
                className="w-full font-semibold"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await api.allocations.requestHelp("User requested assistance via Dashboard.");
                    if (response.success) {
                      toast.success("Help request sent to administrator.");
                    } else {
                      toast.error("Failed to send request.");
                    }
                  } catch (e) {
                    console.error(e);
                    toast.error("Error sending request.");
                  }
                }}
              >
                Request Assistance
              </Button>
            </CardContent>
          </Card>
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
                <h2 className="text-base font-bold !text-white">Welcome back, {user?.name?.split(' ')[0]} 👋</h2>
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
          api.tasks.getStats(),
          api.tasks.getAll(),
          api.tasks.getPerformance(),
          // User-created allocations (all users)
          api.allocations.getAll()
        ]);

        if (statsRes.success) setStats(statsRes.data);
        if (tasksRes.success) setAdminTasks(tasksRes.data || []);
        if (liveRes.success) setLiveActivities(liveRes.data || []);

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
    <div className="space-y-8 animate-in fade-in duration-500">
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
                          {formatDistanceToNow(new Date(activity.lastProgressUpdate), { addSuffix: true })}
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

          <Card className="bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-2xl relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 opacity-10 rotate-12">
              <TrendingUp size={120} />
            </div>
            <CardContent className="p-6 relative z-10">
              <h3 className="font-bold text-xl mb-2">Help Requests</h3>
              <div className="space-y-3 mt-4">
                {adminTasks.filter(t => t.title && t.title.startsWith("HELP REQUEST") && t.status === 'pending').length > 0 ? (
                  adminTasks.filter(t => t.title && t.title.startsWith("HELP REQUEST") && t.status === 'pending').slice(0, 3).map((task, i) => (
                    <div key={i} className="flex justify-between text-sm items-center py-2 border-b border-white/10 last:border-0">
                      <div className="flex flex-col">
                        <span className="font-bold text-white">{task.title.replace("HELP REQUEST: ", "")}</span>
                        <span className="text-xs opacity-70 truncate max-w-[150px]">{task.description}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 text-[10px]"
                        onClick={() => navigate('/my-tasks')}
                      >
                        View
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-4">
                    <CheckCircle2 className="h-8 w-8 opacity-50 mb-2" />
                    <span className="opacity-70 text-sm">No new requests</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      {user?.role === 'admin' ? <AdminDashboard /> : <UserDashboard />}
    </DashboardLayout>
  );
};

export default Dashboard;
