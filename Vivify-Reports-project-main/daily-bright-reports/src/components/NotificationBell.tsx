import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ApiNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  referenceId: number;
  isRead: boolean;
  createdAt: string;
}

interface Reminder {
  id: number;
  taskName: string;
  dueDate: string;
  priority: string;
}

interface Props {
  reminders: Reminder[];
  unreadReminderCount: number;
  onDismissReminder: (id: number) => void;
  onDismissAllReminders: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
}

const priorityColors: Record<string, string> = {
  high: 'text-rose-500',
  medium: 'text-amber-500',
  low: 'text-emerald-500',
};

export const NotificationBell: React.FC<Props> = ({
  reminders,
  unreadReminderCount,
  onDismissReminder,
  onDismissAllReminders,
  panelRef,
}) => {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'reminders'>('notifications');
  const prevIdsRef = useRef<Set<number>>(new Set());

  const fetchNotifications = async () => {
    try {
      const res = await api.notifications.getAll();
      if (res.success && Array.isArray(res.data)) {
        const incoming: ApiNotification[] = res.data;
        // Show toast for brand-new notifications
        incoming.forEach(n => {
          if (!prevIdsRef.current.has(n.id) && prevIdsRef.current.size > 0) {
            if (n.type === 'request_approved') {
              toast.success(n.title, { description: n.message, duration: 6000 });
            } else if (n.type === 'request_rejected') {
              toast.error(n.title, { description: n.message, duration: 6000 });
            } else {
              toast.info(n.title, { description: n.message, duration: 5000 });
            }
          }
        });
        prevIdsRef.current = new Set(incoming.map(n => n.id));
        setNotifications(incoming);
      }
    } catch { /* silently fail */ }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelRef]);

  const unreadNotifs = notifications.filter(n => !n.isRead);
  const totalBadge = unreadNotifs.length + unreadReminderCount;

  const handleMarkRead = async (id: number) => {
    await api.notifications.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full text-primary-foreground/80 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Bell className={cn('h-4 w-4', totalBadge > 0 && 'text-amber-300')} />
        {totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('notifications')}
              className={cn(
                'flex-1 py-2.5 text-xs font-black uppercase tracking-wide transition-colors',
                activeTab === 'notifications'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              )}
            >
              Notifications
              {unreadNotifs.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                  {unreadNotifs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={cn(
                'flex-1 py-2.5 text-xs font-black uppercase tracking-wide transition-colors',
                activeTab === 'reminders'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              )}
            >
              Reminders
              {unreadReminderCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white">
                  {unreadReminderCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <>
              {unreadNotifs.length > 0 && (
                <div className="flex justify-end px-4 py-2 border-b border-slate-50 dark:border-slate-800">
                  <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide">
                    Mark all read
                  </button>
                </div>
              )}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 font-medium">No notifications yet</div>
                ) : notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleMarkRead(n.id)}
                    className={cn(
                      'px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                      !n.isRead && 'bg-blue-50/60 dark:bg-blue-950/30'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">
                        {n.type === 'request_approved' ? '✅' : n.type === 'request_rejected' ? '❌' : '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-bold truncate', !n.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>
                          {n.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{format(new Date(n.createdAt), 'MMM dd, HH:mm')}</p>
                      </div>
                      {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Reminders tab */}
          {activeTab === 'reminders' && (
            <>
              {unreadReminderCount > 0 && (
                <div className="flex justify-end px-4 py-2 border-b border-slate-50 dark:border-slate-800">
                  <button onClick={onDismissAllReminders} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-wide">
                    Dismiss all
                  </button>
                </div>
              )}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                {reminders.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    <p className="text-xs font-medium">No pending reminders</p>
                  </div>
                ) : reminders.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <AlertCircle className={cn('mt-0.5 h-4 w-4 shrink-0', priorityColors[r.priority] || 'text-slate-400')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-slate-900 dark:text-white">{r.taskName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Due: {format(new Date(r.dueDate), 'MMM dd, yyyy')}</p>
                      <span className={cn('text-[10px] font-semibold capitalize', priorityColors[r.priority])}>
                        {r.priority} priority
                      </span>
                    </div>
                    <button onClick={() => onDismissReminder(r.id)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 mt-0.5">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
