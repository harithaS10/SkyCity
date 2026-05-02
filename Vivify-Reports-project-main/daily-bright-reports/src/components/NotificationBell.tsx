import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  referenceId: number;
  isRead: boolean;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.notifications.getAll();
      if (res.success && Array.isArray(res.data)) {
        const incoming: Notification[] = res.data;

        // Show toast for any new notification not seen before
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

        // Update seen IDs
        prevIdsRef.current = new Set(incoming.map(n => n.id));
        setNotifications(incoming);
      }
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // poll every 20s
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifications.filter(n => !n.isRead);

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleMarkRead = async (id: number) => {
    await api.notifications.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-sm font-black text-slate-800 dark:text-white">Notifications</span>
            {unread.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 font-medium">
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={cn(
                    "px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                    !n.isRead && "bg-blue-50/60 dark:bg-blue-950/30"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">
                      {n.type === 'request_approved' ? '✅' : n.type === 'request_rejected' ? '❌' : '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-bold truncate", !n.isRead ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {format(new Date(n.createdAt), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
