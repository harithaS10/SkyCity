import React, { useState, useEffect, useRef } from 'react';

class ChatErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.error('ChatBox error:', error); }
  render() {
    if (this.state.hasError) {
      // Show a minimal fallback button so users can still see the chat icon
      return (
        <button
          onClick={() => this.setState({ hasError: false })}
          className="fixed bottom-5 right-4 z-[200] flex h-12 w-12 items-center justify-center rounded-full shadow-lg bg-violet-600 text-white hover:bg-violet-700"
          aria-label="Open chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      );
    }
    return this.props.children;
  }
}
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { api } from '@/lib/api';
import { useSignalRReminders, type ReminderPayload } from '@/hooks/useSignalRReminders';
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  ClipboardList,
  Building2,
  ListTodo,
  Briefcase,
  MessageSquareWarning,
  Shield,
  Settings,
  Package,
  Bell,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Crown,
  Layers,
  Activity,
  Palette,
  Home,
  ClipboardCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ModeToggle } from '@/components/ModeToggle';
import { ChatBox } from '@/components/ChatBox';
import { Badge } from '@/components/ui/badge';
import logo from '@/assets/skycity-logo.png';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type AllowedRole = string; // Custom roles only - any string is allowed

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: AllowedRole[];
}

interface DropdownItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// ─── Navigation Configuration (Role-Aware) ────────────────────────────────────

const navItems: NavItem[] = [
  // Available to all authenticated users
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-3.5 w-3.5" />, roles: [] },
  { label: 'Community Chat', href: '/chat', icon: <MessageSquare className="h-3.5 w-3.5" />, roles: ['staff', 'resident', 'property_manager', 'facility_manager'] },
  // Staff/resident only
  { label: 'My Tasks', href: '/my-tasks', icon: <ClipboardList className="h-3.5 w-3.5" />, roles: ['staff', 'resident'] },
  { label: 'Daily Reports', href: '/daily-report', icon: <FileText className="h-3.5 w-3.5" />, roles: ['staff', 'resident', 'facility_manager'] },
  { label: 'My Reports', href: '/my-reports', icon: <FileText className="h-3.5 w-3.5" />, roles: ['staff', 'resident', 'facility_manager'] },
  { label: 'Complaints', href: '/complaints', icon: <MessageSquareWarning className="h-3.5 w-3.5" />, roles: ['staff', 'resident', 'helpdesk'] },
  // Admin-only items - NOT in navItems, rendered separately for admin users
];

// Admin dropdowns
const managementItems: DropdownItem[] = [
  { label: 'User Management', href: '/admin/users', icon: <Users className="h-3.5 w-3.5" /> },
  { label: 'Property Management', href: '/admin/properties', icon: <Home className="h-3.5 w-3.5" /> },
  { label: 'Client Management', href: '/admin/clients', icon: <Building2 className="h-3.5 w-3.5" /> },
  { label: 'Work Management', href: '/admin/works', icon: <Briefcase className="h-3.5 w-3.5" /> },
  { label: 'Role Management', href: '/admin/roles', icon: <Shield className="h-3.5 w-3.5" /> },
  { label: 'Branding', href: '/admin/themes', icon: <Palette className="h-3.5 w-3.5" /> },
  { label: 'Terms & Conditions', href: '/admin/terms', icon: <FileText className="h-3.5 w-3.5" /> },
];

const taskManagementItems: DropdownItem[] = [
  { label: 'Employee Tasks', href: '/admin/employees', icon: <Users className="h-3.5 w-3.5" /> },
];

const productManagementItems: DropdownItem[] = [
  { label: 'Work Management', href: '/admin/works', icon: <Briefcase className="h-3.5 w-3.5" /> },
];

// ─── RoleBadge ────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { label: string; color: string }> = {}; // Custom roles - no hardcoded badges

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const { companyName, logoUrl } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unseenTasksCount, setUnseenTasksCount] = useState(0);

  // Reminder bell (user only)
  const [reminders, setReminders] = useState<any[]>([]);
  const [showReminderPanel, setShowReminderPanel] = useState(false);
  const [showAdminNotifPanel, setShowAdminNotifPanel] = useState(false);
  const reminderPanelRef = useRef<HTMLDivElement>(null);
  const adminNotifPanelRef = useRef<HTMLDivElement>(null);
  const DISMISSED_KEY = `reminder_dismissed_${user?.id ?? 'user'}`;

  // API notifications (approved/rejected requests for staff/resident, admin notifications for admins)
  const [apiNotifications, setApiNotifications] = useState<any[]>([]);
  const apiNotifUnread = apiNotifications.filter((n: any) => !n.isRead).length;
  const prevNotifIdsRef = React.useRef<Set<number>>(new Set());

  const isInitialFetchRef = React.useRef(true);
  // Unified notification polling for all roles (Real Notifications + Live Activity Fallback)
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        // 1. Fetch Real Notifications
        const res = await api.notifications.getAll();
        let combinedNotifs = res?.success && Array.isArray(res.data) ? res.data : [];

        // 2. Fallback: If Admin, fetch Live Activities and convert to Virtual Notifications
        const isAdmin = ['admin', 'sub_admin', 'property_manager', 'facility_manager', 'super_admin'].includes(user.role || '');
        if (isAdmin) {
          try {
            const liveRes = await api.allocations.getLiveActivities();
            if (liveRes?.success && Array.isArray(liveRes.data)) {
              const now = new Date().getTime();
              const virtualNotifs = liveRes.data
                .filter((act: any) => {
                  // Only show activities from the last 2 hours as "recent" notifications
                  const actTime = act.lastProgressUpdate ? new Date(act.lastProgressUpdate).getTime() : 0;
                  return (now - actTime) < (2 * 60 * 60 * 1000); 
                })
                .map((act: any) => ({
                  id: `live-${act.id}-${act.lastProgressUpdate}`,
                  type: act.status === 'completed' ? 'task_completed' : 'progress_update',
                  title: act.status === 'completed' ? 'Task Completed' : 'Progress Update',
                  message: `${act.assigneeName} updated "${act.workTitle || act.title}": ${act.progressNote || act.status}`,
                  createdAt: act.lastProgressUpdate,
                  isRead: false,
                  _isVirtual: true
                }));
              
              // Merge virtual notifications into the list, avoiding duplicates
              virtualNotifs.forEach(vn => {
                if (!combinedNotifs.find(n => n.id === vn.id)) {
                  combinedNotifs.push(vn);
                }
              });
            }
          } catch (err) { console.warn("Live activity fetch failed", err); }
        }

        // 3. Process Alerts and Update State
        combinedNotifs.forEach((n: any) => {
          // Only show toasts for NEW notifications (not seen in previous fetch)
          // AND only after the very first load to avoid toast spam on login
          if (!prevNotifIdsRef.current.has(n.id) && !isInitialFetchRef.current) {
            // Staff Alerts
            if (n.type === 'request_approved') toast.success(n.title, { description: n.message });
            else if (n.type === 'request_rejected') toast.error(n.title, { description: n.message });
            
            // Admin Alerts (Real or Virtual)
            else if (n.type === 'task_completed') toast.success(n.title, { description: n.message });
            else if (['self_assign', 'task_started', 'request_change', 'progress_update'].includes(n.type))
              toast.info(n.title, { description: n.message });
          }
        });

        prevNotifIdsRef.current = new Set(combinedNotifs.map((n: any) => n.id));
        isInitialFetchRef.current = false;
        // Keep only unread in state
        setApiNotifications(combinedNotifs.filter((n: any) => !n.isRead));
      } catch (error) {
        console.warn("Notification poll failed:", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(`reminder_dismissed_${user?.id ?? 'user'}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const persistDismiss = (ids: Set<number>) => {
    setDismissedIds(ids);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!user) return false;
    // If item has role restrictions, check if current user's role is allowed
    if (item.roles && item.roles.length > 0) {
      if (!item.roles.includes(user.role)) return false;
    }
    // Permission-based filtering for staff
    const moduleMap: Record<string, string> = {
      '/complaints': 'complaints',
      '/admin/work-allocation': 'work_orders',
      '/daily-report': 'daily_reports',
      '/my-reports': 'daily_reports',
      '/my-tasks': 'work_orders',
      '/admin/analytics': 'analytics',
      '/chat': 'chat',
    };
    const module = moduleMap[item.href];
    if (module && user.role === 'staff') return hasPermission(module, 'view');
    return true;
  });

  useEffect(() => {
    if ((user?.role === 'staff' || user?.role === 'resident')) {
      const fetch = async () => {
        try {
          const [allocRes, taskRes] = await Promise.all([
            api.allocations.getMyTasks(),
            api.tasks.getMyTasks(),
          ]);
          const allocCount = (allocRes.success && allocRes.data)
            ? allocRes.data.filter((a: any) => a.status === 'pending' || a.status === 'in-progress' || a.status === 'in_progress').length : 0;
          const taskCount = (taskRes.success && taskRes.data)
            ? taskRes.data.filter((t: any) => t.status === 'pending' || t.status === 'in_progress').length : 0;
          setUnseenTasksCount(allocCount + taskCount);
        } catch {}
      };
      fetch();
    }
  }, [user]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const fetchReminders = async () => {
    try {
      const res = await api.tasks.getReminders();
      if (res.success && res.data) {
        setReminders(prev => {
          const apiIds = new Set(res.data!.map((r: any) => r.id));
          const signalROnly = prev.filter((r: any) => r._signalR && !apiIds.has(r.id));
          return [...res.data!, ...signalROnly];
        });
        setDismissedIds(prev => {
          const activeIds = new Set(res.data!.map((r: any) => r.id));
          const pruned = new Set([...prev].filter(id => activeIds.has(id)));
          try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...pruned])); } catch {}
          return pruned;
        });
      }
    } catch {}
  };

  useEffect(() => {
    if ((user?.role === 'staff' || user?.role === 'resident')) {
      fetchReminders();
      const interval = setInterval(fetchReminders, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  useSignalRReminders((user?.role === 'staff' || user?.role === 'resident'), (payload: ReminderPayload) => {
    setReminders(prev => {
      const filtered = prev.filter((r: any) => r.taskId !== payload.taskId);
      return [{ ...payload, id: Date.now(), _signalR: true }, ...filtered];
    });
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (reminderPanelRef.current && !reminderPanelRef.current.contains(e.target as Node)) {
        setShowReminderPanel(false);
      }
      if (adminNotifPanelRef.current && !adminNotifPanelRef.current.contains(e.target as Node)) {
        setShowAdminNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visibleReminders = reminders.filter((r: any) => !dismissedIds.has(r.id));
  const unreadCount = visibleReminders.length;
  const priorityColors: Record<string, string> = { low: 'text-slate-500', medium: 'text-amber-500', high: 'text-rose-500' };

  const displayLogo = logoUrl ?? logo;
  const roleBadge = user ? ROLE_BADGE[user.role as AllowedRole] : null;

  // Check if user has management/admin privileges
  const isAdminRole = user && ['admin', 'sub_admin', 'property_manager', 'facility_manager', 'super_admin'].includes(user.role?.toLowerCase() ?? '');
  const isSuperAdmin = user?.role?.toLowerCase() === 'super_admin';
  const isResident = user?.role?.toLowerCase() === 'resident';

  // Build a helper to render desktop dropdown menus
  const renderDropdown = (
    label: string,
    items: DropdownItem[],
    icon: React.ReactNode,
    activeHrefs: string[]
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 px-2 gap-1 text-[11px] font-semibold transition-all rounded-md whitespace-nowrap flex-shrink-0',
            activeHrefs.includes(location.pathname)
              ? 'bg-white/20 text-white shadow-md'
              : 'text-white/80 hover:bg-white/10 hover:text-white'
          )}
        >
          <span className="relative z-10 flex items-center gap-1">
            {icon}
            <span>{label}</span>
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 p-1 bg-card border shadow-lg">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn('cursor-pointer text-xs font-medium', location.pathname === item.href && 'bg-accent')}
          >
            <span className="flex items-center gap-2">{item.icon}{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden w-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 w-full border-b border-white/10 bg-[#0d9488] text-white shadow-md safe-top"
      >
        <div className="flex h-16 sm:h-14 items-center justify-between px-3 sm:px-3 lg:px-4 xl:px-6 max-w-[1800px] mx-auto w-full gap-2">

          {/* Left: Logo + Mobile menu toggle */}
          <div className="flex items-center gap-2 sm:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden text-white/80 hover:text-white hover:bg-white/10 h-10 w-10 sm:h-8 sm:w-8 flex-shrink-0"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5 sm:h-4 sm:w-4" /> : <Menu className="h-5 w-5 sm:h-4 sm:w-4" />}
            </Button>
            <div
              className="flex items-center gap-2 sm:gap-2 cursor-pointer group flex-shrink-0"
              onClick={() => navigate(isSuperAdmin ? '/super-admin/overview' : '/dashboard')}
            >
              <div className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-white shadow-xl ring-2 ring-white/20 group-hover:scale-105 transition-transform duration-300 overflow-hidden p-0.5 flex-shrink-0">
                <img src={displayLogo} alt="Logo" className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-xl sm:text-xl skycity-logo-text leading-none tracking-tighter text-white">
                  {companyName.split(' ')[0].toLowerCase()}
                </span>
                <span className="text-[10px] sm:text-[9px] reports-subtext font-black leading-none mt-1 opacity-90 text-white/80">
                  REPORTS
                </span>
              </div>
            </div>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden xl:flex items-center flex-1 justify-center mx-2 min-w-0 overflow-hidden">
            <div className="flex items-center gap-0.5 border-l border-white/20 dark:border-slate-200 pl-2 overflow-x-auto scrollbar-hide">
              {/* For admin roles, only render Dashboard from filteredNavItems; the rest are rendered in order below */}
              {filteredNavItems
                .filter(item => !isAdminRole || item.href === '/dashboard')
                .map((item) => {
                const unseenCount = item.href === '/my-tasks' ? unseenTasksCount : 0;
                const isActive = location.pathname === item.href;
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-8 px-2 gap-1 text-[11px] font-semibold transition-all relative overflow-hidden group rounded-md whitespace-nowrap flex-shrink-0',
                      isActive
                        ? 'bg-white/20 text-white shadow-md'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    )}
                    onClick={() => {
                      navigate(item.href);
                    }}
                  >
                    <span className="relative z-10 flex items-center gap-1">
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="truncate max-w-[120px]">{item.label}</span>
                    </span>
                    {unseenCount > 0 && (
                      <span className="relative z-10 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white leading-none flex-shrink-0">
                        {unseenCount}
                      </span>
                    )}
                  </Button>
                );
              })}

              {/* Admin nav — strict order: Management → Employee Tasks → Work Allocation → Community Chat → Complaints → Analytics */}
              {isAdminRole && renderDropdown(
                'Management',
                managementItems,
                <Settings className="h-3.5 w-3.5 flex-shrink-0" />,
                managementItems.map(i => i.href)
              )}
              {isAdminRole && (
                <button
                  onClick={() => navigate('/admin/employees')}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors text-white/80 hover:text-white hover:bg-white/10 whitespace-nowrap flex-shrink-0',
                    location.pathname.startsWith('/admin/employee') && 'bg-white/20 text-white shadow-md'
                  )}
                >
                  <ClipboardCheck className="h-3.5 w-3.5 flex-shrink-0" />
                  Employee Tasks
                </button>
              )}
              {isAdminRole && ([
                { label: 'Work Allocation', href: '/admin/work-allocation', icon: <ClipboardList className="h-3.5 w-3.5" /> },
                { label: 'Community Chat', href: '/chat', icon: <MessageSquare className="h-3.5 w-3.5" /> },
                { label: 'Complaints', href: '/complaints', icon: <MessageSquareWarning className="h-3.5 w-3.5" /> },
                { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
                { label: 'Reports', href: '/admin/reports', icon: <FileText className="h-3.5 w-3.5" /> },
              ].map(item => (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 px-2 gap-1 text-[11px] font-semibold transition-all rounded-md whitespace-nowrap flex-shrink-0',
                    location.pathname === item.href
                      ? 'bg-white/20 text-white shadow-md'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  )}
                  onClick={() => navigate(item.href)}
                >
                  <span className="flex items-center gap-1">
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                </Button>
              )))}
            </div>
          </nav>

          {/* Right: Theme + Bell + User Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Association Info Badge (Non-SuperAdmins) */}
            

            <ModeToggle className="text-white/80 hover:text-white hover:bg-white/10 h-10 w-10 sm:h-8 sm:w-8" />

            {/* Admin Notification Bell */}
            {isAdminRole && (
              <div className="relative" ref={adminNotifPanelRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 sm:h-8 sm:w-8 text-white/80 hover:bg-white/10 hover:text-white"
                  onClick={() => setShowAdminNotifPanel(v => !v)}
                >
                  <Bell className={cn('h-4 w-4', apiNotifUnread > 0 && 'text-amber-300')} />
                  {apiNotifUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none">
                      {apiNotifUnread > 9 ? '9+' : apiNotifUnread}
                    </span>
                  )}
                </Button>
                {showAdminNotifPanel && (
                  <div className="fixed sm:absolute right-0 sm:right-0 top-16 sm:top-11 left-0 sm:left-auto z-[100] sm:w-80 w-full sm:rounded-lg rounded-none border bg-white shadow-xl dark:bg-card">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <span className="font-semibold text-sm text-slate-900 dark:text-foreground flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        Notifications
                      </span>
                      <div className="flex items-center gap-2">
                        {apiNotifications.length > 0 && (
                          <button
                            onClick={() => api.notifications.markAllRead().then(() => setApiNotifications([]))}
                            className="text-xs text-primary hover:text-primary/80 font-medium"
                          >Mark all read</button>
                        )}
                        <button onClick={() => setShowAdminNotifPanel(false)} className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
                      {apiNotifications.filter(n => !n.isRead).length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                          <Bell className="h-10 w-10 text-slate-200" />
                          <p className="text-sm font-medium">No notifications yet</p>
                          <p className="text-xs text-center px-6">Notifications will appear here when employees start tasks, complete work, or request changes.</p>
                        </div>
                      ) : apiNotifications
                        .filter(n => !n.isRead)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((n: any) => {
                        const icons: Record<string, string> = {
                          task_completed: '✅',
                          task_started: '▶️',
                          self_assign: '📋',
                          progress_update: '📝',
                          request_change: '⚠️',
                          request_approved: '✅',
                          request_rejected: '❌',
                        };
                        return (
                          <div
                            key={`admin-notif-${n.id}`}
                            className={cn('flex items-start gap-3 border-b px-4 py-3 last:border-0 cursor-pointer bg-blue-50/60 dark:bg-blue-950/20 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors')}
                            onClick={() => api.notifications.markRead(n.id).then(() => setApiNotifications(prev => prev.filter(x => x.id !== n.id)))}
                          >
                            <span className="text-lg mt-0.5 shrink-0">{icons[n.type] ?? '🔔'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-foreground leading-tight">{n.title}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1">{format(new Date(n.createdAt), 'MMM dd, hh:mm a')}</p>
                            </div>
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Combined Notification + Reminder Bell (Staff & Resident) */}
            {(user?.role === 'staff' || user?.role === 'resident') && (
              <div className="relative" ref={reminderPanelRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 sm:h-8 sm:w-8 text-white/80 hover:bg-white/10 hover:text-white"
                  onClick={() => setShowReminderPanel(v => !v)}
                >
                  <Bell className={cn('h-4 w-4', (unreadCount + apiNotifUnread) > 0 && 'text-amber-300')} />
                  {(unreadCount + apiNotifUnread) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none">
                      {(unreadCount + apiNotifUnread) > 9 ? '9+' : unreadCount + apiNotifUnread}
                    </span>
                  )}
                </Button>
                {showReminderPanel && (
                  <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border bg-white shadow-xl dark:bg-card">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <span className="font-semibold text-sm text-slate-900 dark:text-foreground">Notifications</span>
                      {(visibleReminders.length > 0 || apiNotifications.length > 0) && (
                        <button
                            onClick={() => {
                              persistDismiss(new Set(reminders.map((r: any) => r.id)));
                              api.notifications.markAllRead().then(() => setApiNotifications([]));
                              setShowReminderPanel(false);
                            }}
                          className="text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                        >Dismiss all</button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {/* API Notifications (approved/rejected requests) */}
                      {apiNotifications.filter(n => !n.isRead).length === 0 && visibleReminders.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                          <p className="text-sm font-medium">No notifications</p>
                        </div>
                      ) : (
                        <>
                          {apiNotifications
                            .filter(n => !n.isRead)
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map((n: any) => (
                            <div key={`notif-${n.id}`}
                              className={cn('flex items-start gap-3 border-b px-4 py-3 last:border-0 cursor-pointer transition-colors bg-blue-50/80 dark:bg-blue-900/20')}
                              onClick={() => api.notifications.markRead(n.id).then(() => setApiNotifications(prev => prev.filter(x => x.id !== n.id)))}
                            >
                              <span className="text-lg mt-0.5 shrink-0">
                                {n.type === 'request_approved' ? '✅' : n.type === 'request_rejected' ? '❌' : '🔔'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm leading-tight truncate", "font-bold text-slate-900 dark:text-white")}>{n.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                                <p className="text-[9px] text-muted-foreground/60 mt-1">{format(new Date(n.createdAt), 'MMM dd, hh:mm a')}</p>
                              </div>
                              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                            </div>
                          ))}
                          {/* Task Reminders */}
                          {visibleReminders.map((r: any) => (
                            <div key={`rem-${r.id}`} className="flex items-start gap-3 border-b px-4 py-3 last:border-0">
                              <AlertCircle className={cn('mt-0.5 h-4 w-4 shrink-0', priorityColors[r.priority] || 'text-slate-400')} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate text-slate-900 dark:text-foreground">{r.taskName}</p>
                                <p className="text-xs text-muted-foreground">Due: {format(new Date(r.dueDate), 'MMM dd, yyyy')}</p>
                                <span className={cn('text-[10px] font-semibold capitalize', priorityColors[r.priority])}>
                                  {r.priority} priority
                                </span>
                              </div>
                              <button onClick={() => persistDismiss(new Set([...dismissedIds, r.id]))} className="text-muted-foreground hover:text-slate-900 dark:hover:text-white shrink-0 mt-0.5">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 sm:h-8 px-2 sm:px-1.5 gap-1.5 hover:bg-white/10 hover:text-white border border-transparent transition-all text-white"
                >
                  <div className="flex h-8 w-8 sm:h-6 sm:w-6 items-center justify-center rounded-md bg-white/20 shadow-sm flex-shrink-0">
                    <User className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-white" />
                  </div>
                  <div className="hidden sm:block text-left min-w-0 max-w-[100px]">
                    <p className="text-[11px] font-bold text-white leading-none mb-0.5 truncate">{user?.fullName}</p>
                    <p className={cn('text-[9px] capitalize truncate', roleBadge?.color ?? 'text-white/70')}>
                      {roleBadge?.label ?? user?.role}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 sm:h-3 sm:w-3 text-white/70 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1 bg-card border shadow-lg">
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-xs font-semibold text-foreground truncate">{user?.fullName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email || user?.username}</p>
                </div>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer text-xs font-medium"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Mobile Navigation ─────────────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <nav className="fixed left-0 top-0 bottom-0 z-40 w-72 sm:w-64 bg-card border-r pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-[calc(4.5rem+env(safe-area-inset-top))] pb-4 px-4 sm:px-3 shadow-xl overflow-y-auto">
            <div className="space-y-0.5 pb-4">
              {filteredNavItems.map((item) => {
                const unseenCount = item.href === '/my-tasks' ? unseenTasksCount : 0;
                const isActive = location.pathname === item.href;
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className={cn(
                      'w-full justify-start h-11 sm:h-9 px-3 text-[13px] sm:text-xs font-medium transition-all',
                      isActive ? 'bg-[#0d9488] text-white' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    onClick={() => {
                      navigate(item.href);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3 sm:gap-2">
                      <span className="h-5 w-5 sm:h-4 sm:w-4 flex-shrink-0">{item.icon}</span>
                      {item.label}
                    </div>
                    {unseenCount > 0 && (
                      <span className="ml-auto h-5 w-5 sm:h-4 sm:w-4 flex items-center justify-center rounded-full bg-rose-500 text-[10px] sm:text-[9px] font-bold text-white">
                        {unseenCount}
                      </span>
                    )}
                  </Button>
                );
              })}

              {/* Admin Management Section */}
              {isAdminRole && (
                <>
                  <div className="pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground px-3 uppercase tracking-wide">Management</p>
                  </div>
                  {managementItems.map((item) => (
                    <Button key={item.href} variant="ghost"
                      className={cn('w-full justify-start h-9 px-3 pl-5 text-xs font-medium transition-all',
                        location.pathname === item.href ? 'bg-[#0d9488] text-white' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                      onClick={() => { navigate(item.href); setIsMobileMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>{item.label}
                      </div>
                    </Button>
                  ))}
                  <div className="pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground px-3 uppercase tracking-wide">Task Management</p>
                  </div>
                  {taskManagementItems.map((item) => (
                    <Button key={item.href} variant="ghost"
                      className={cn('w-full justify-start h-9 px-3 pl-5 text-xs font-medium transition-all',
                        location.pathname === item.href ? 'bg-[#0d9488] text-white' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                      onClick={() => { navigate(item.href); setIsMobileMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>{item.label}
                      </div>
                    </Button>
                  ))}

                  {/* Work Allocation, Community Chat, Complaints, Analytics */}
                  <div className="pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground px-3 uppercase tracking-wide">Operations</p>
                  </div>
                  {[
                    { label: 'Work Allocation', href: '/admin/work-allocation', icon: <ClipboardList className="h-4 w-4" /> },
                    { label: 'Community Chat', href: '/chat', icon: <MessageSquare className="h-4 w-4" /> },
                    { label: 'Complaints', href: '/complaints', icon: <MessageSquareWarning className="h-4 w-4" /> },
                    { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 className="h-4 w-4" /> },
                    { label: 'Reports', href: '/admin/reports', icon: <FileText className="h-4 w-4" /> },
                  ].map((item) => (
                    <Button key={item.href} variant="ghost"
                      className={cn('w-full justify-start h-9 px-3 pl-5 text-xs font-medium transition-all',
                        location.pathname === item.href ? 'bg-[#0d9488] text-white' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                      onClick={() => { navigate(item.href); setIsMobileMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>{item.label}
                      </div>
                    </Button>
                  ))}
                </>
              )}
            </div>

            <div className="pt-4 pb-20 mt-2 border-t border-border">
              <Button variant="outline" className="w-full justify-start text-sm sm:text-xs h-12 sm:h-9 text-rose-600 border-rose-100 hover:bg-rose-50" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4 sm:h-3.5 sm:w-3.5" />
                Log out
              </Button>
            </div>
          </nav>
        </div>
      )}

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="px-3 sm:px-6 md:px-8 py-4 sm:py-8 max-w-[1800px] mx-auto w-full pb-20 xl:pb-8 overflow-x-hidden flex-1 pt-20 sm:pt-20">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation Bar ─────────────────────────────────── */}
      <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-white/10 shadow-2xl safe-bottom">
        <div className="flex items-center justify-around px-2 py-3">
          {(() => {
            // For admin roles: always show Dashboard + Complaints in bottom nav
            // For other roles: use filteredNavItems (up to 5)
            const bottomItems: { label: string; href: string; icon: React.ReactNode }[] = isAdminRole
              ? [
                  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
                  { label: 'Complaints', href: '/complaints', icon: <MessageSquareWarning className="h-5 w-5" /> },
                ]
              : filteredNavItems.slice(0, 5);

            return bottomItems.map((item) => {
              const isActive = location.pathname === item.href;
              const unseenCount = item.href === '/my-tasks' ? unseenTasksCount : 0;
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0 flex-1',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <div className="relative">
                    <span className={cn('flex h-6 w-6 items-center justify-center', isActive && 'text-primary')}>
                      {item.icon}
                    </span>
                    {unseenCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                        {unseenCount > 9 ? '9+' : unseenCount}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    'text-[9px] font-medium truncate max-w-[52px] text-center leading-tight',
                    isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="h-1 w-1 rounded-full bg-primary mt-1 shadow-glow shadow-primary/50" />
                  )}
                </button>
              );
            });
          })()}
        </div>
      </nav>
    </div>
  );
};
