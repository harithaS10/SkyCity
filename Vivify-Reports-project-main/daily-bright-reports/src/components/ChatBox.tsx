import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useChat, type ChatMsg } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import {
  MessageSquare, X, Send, Paperclip, ClipboardList, Smile,
  ChevronLeft, Search, CheckCheck, Check, Users, Plus, UserPlus, Trash2,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd MMM yyyy');
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md', showDot = false, isGroup = false }: {
  name: string; size?: 'sm' | 'md' | 'lg'; showDot?: boolean; isGroup?: boolean;
}) {
  const sizeClass = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-10 w-10 text-sm' }[size];
  return (
    <div className="relative shrink-0">
      <div className={cn(
        'rounded-full flex items-center justify-center font-bold text-white shrink-0',
        sizeClass,
        isGroup ? 'bg-indigo-500' : avatarColor(name)
      )}>
        {isGroup ? <Users className="h-3.5 w-3.5" /> : getInitials(name)}
      </div>
      {showDot && !isGroup && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#1a1d2e]" />
      )}
    </div>
  );
}

// ─── Date Separator ───────────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-4 px-2">
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white dark:bg-[#151724] px-2">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

// ─── Task Card (Flock style — interactive) ───────────────────────────────────
function TaskCard({ payload, isMine, currentUserId, onStatusUpdate }: {
  payload: string;
  isMine: boolean;
  currentUserId: number;
  onStatusUpdate?: (taskId: number, status: string) => void;
}) {
  const [task, setTask] = useState<any>(() => { try { return JSON.parse(payload); } catch { return {}; } });
  const [updating, setUpdating] = useState(false);

  useEffect(() => { try { setTask(JSON.parse(payload)); } catch { /* ignore */ } }, [payload]);

  const priority = (task.priority ?? '').toLowerCase();
  const priorityConfig: Record<string, { dot: string; badge: string; label: string }> = {
    high:   { dot: 'bg-rose-500',  badge: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',     label: 'High' },
    medium: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', label: 'Medium' },
    low:    { dot: 'bg-blue-400',  badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',     label: 'Low' },
  };
  const pc = priorityConfig[priority] ?? { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-500', label: priority };

  const statusKey = (task.status ?? 'assigned').toLowerCase().replace(/\s+/g, '_');
  const statusConfig: Record<string, { cls: string; label: string; icon: string }> = {
    assigned:    { cls: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400', label: 'Assigned',    icon: '📋' },
    pending:     { cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',       label: 'Pending',     icon: '⏳' },
    in_progress: { cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',         label: 'In Progress', icon: '🔄' },
    completed:   { cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Completed', icon: '✅' },
  };
  const sc = statusConfig[statusKey] ?? statusConfig.assigned;

  const isAssignee = task.assignedToId === currentUserId;
  const isCompleted = statusKey === 'completed';
  const canUpdate = !!onStatusUpdate && !!task.taskId && isAssignee && !isCompleted;

  const handleStatus = async (e: React.MouseEvent, newStatus: string) => {
    e.stopPropagation();
    if (!canUpdate || updating) return;
    setUpdating(true);
    setTask((prev: any) => ({ ...prev, status: newStatus }));
    try { await onStatusUpdate!(task.taskId, newStatus); }
    catch { setTask((prev: any) => ({ ...prev, status: task.status })); }
    finally { setUpdating(false); }
  };

  return (
    <div className="mt-1 rounded-xl border w-[280px] bg-amber-50/80 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 border-b border-amber-100 dark:border-amber-800/30">
        <span className="text-sm">📌</span>
        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex-1">
          Task Assigned
        </span>
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1', sc.cls)}>
          <span>{sc.icon}</span> {sc.label}
        </span>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
          {task.title ?? task.taskName ?? 'Task'}
        </p>
        {task.assignedBy && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">by {task.assignedBy}</p>
        )}
        {task.dueDate && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
            📅 {format(new Date(task.dueDate), 'dd MMM yyyy')}
          </p>
        )}
        {priority && (
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1.5', pc.badge)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', pc.dot)} />
            {pc.label}
          </span>
        )}

        {/* Assignee row */}
        <div className="mt-2.5 border-t border-amber-100 dark:border-amber-800/30 pt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate flex-1">
            {task.assignedTo ?? '—'}
          </span>
          <span className={cn('text-[11px] font-medium flex items-center gap-1', sc.cls)}>
            <span>{sc.icon}</span> {sc.label}
          </span>
        </div>

        {/* Action buttons */}
        {canUpdate && (
          <div className="flex gap-1.5 mt-2.5 pt-2 border-t border-amber-100 dark:border-amber-800/30" onClick={e => e.stopPropagation()}>
            {statusKey !== 'in_progress' && (
              <button
                onClick={e => handleStatus(e, 'in_progress')}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition disabled:opacity-50"
              >
                🔄 Start
              </button>
            )}
            <button
              onClick={e => handleStatus(e, 'completed')}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition disabled:opacity-50"
            >
              ✅ Done
            </button>
          </div>
        )}
        {isCompleted && (
          <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-2 text-center">Task completed ✅</p>
        )}
      </div>
    </div>
  );
}

// ─── System Message ───────────────────────────────────────────────────────────
function SystemMessage({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 my-3 px-2">
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/60" />
      <span className="text-[11px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 rounded-full px-3 py-1 whitespace-nowrap max-w-[80%] text-center truncate">
        {text}
      </span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/60" />
    </div>
  );
}

// ─── Group Task Card (Flock-style per-member status) ─────────────────────────
function GroupTaskCard({ payload, currentUserId, onUpdateStatus }: {
  payload: string;
  currentUserId: number;
  onUpdateStatus?: (taskId: number, status: string) => Promise<void>;
}) {
  const [task, setTask] = useState<any>(() => {
    try { return JSON.parse(payload); } catch { return {}; }
  });
  const [updating, setUpdating] = useState(false);

  // Allow parent to push real-time member status patches in
  useEffect(() => {
    try { setTask(JSON.parse(payload)); } catch { /* ignore */ }
  }, [payload]);

  const priority = (task.priority ?? '').toLowerCase();
  const priorityConfig: Record<string, { dot: string; badge: string; label: string }> = {
    high:   { dot: 'bg-rose-500',   badge: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',     label: 'High' },
    medium: { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', label: 'Medium' },
    low:    { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',     label: 'Low' },
  };
  const pc = priorityConfig[priority] ?? { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-500', label: priority };

  const memberStatusConfig: Record<string, { icon: string; cls: string; label: string }> = {
    pending:     { icon: '⏳', cls: 'text-slate-400 dark:text-slate-500',                                    label: 'Pending' },
    in_progress: { icon: '🔄', cls: 'text-blue-500 dark:text-blue-400',                                     label: 'In Progress' },
    completed:   { icon: '✅', cls: 'text-emerald-500 dark:text-emerald-400',                                label: 'Done' },
  };

  const members: Array<{ userId: number; userName: string; status: string }> = task.members ?? [];
  const myEntry = members.find(m => m.userId === currentUserId);
  const myStatus = myEntry?.status ?? 'pending';
  const isCompleted = myStatus === 'completed';
  const canUpdate = !!onUpdateStatus && !!task.taskId && !!myEntry;

  const handleStatus = async (e: React.MouseEvent, newStatus: string) => {
    e.stopPropagation();
    if (!canUpdate || updating || isCompleted) return;
    setUpdating(true);
    // Optimistic update
    setTask((prev: any) => ({
      ...prev,
      members: (prev.members ?? []).map((m: any) =>
        m.userId === currentUserId ? { ...m, status: newStatus } : m
      ),
    }));
    try { await onUpdateStatus!(task.taskId, newStatus); }
    catch {
      // Revert on failure
      setTask((prev: any) => ({
        ...prev,
        members: (prev.members ?? []).map((m: any) =>
          m.userId === currentUserId ? { ...m, status: myStatus } : m
        ),
      }));
    }
    finally { setUpdating(false); }
  };

  return (
    <div className="mt-1 rounded-xl border w-[280px] bg-amber-50/80 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 border-b border-amber-100 dark:border-amber-800/30">
        <span className="text-sm">📌</span>
        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex-1">
          Group Task
        </span>
        {priority && (
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1', pc.badge)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', pc.dot)} />
            {pc.label}
          </span>
        )}
      </div>

      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
          {task.title ?? task.taskName ?? 'Task'}
        </p>
        {task.assignedBy && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">by {task.assignedBy}</p>
        )}
        {task.dueDate && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
            📅 {format(new Date(task.dueDate), 'dd MMM yyyy')}
          </p>
        )}

        {/* Per-member status rows */}
        {members.length > 0 && (
          <div className="mt-2.5 space-y-1 border-t border-amber-100 dark:border-amber-800/30 pt-2">
            {members.map(m => {
              const sc = memberStatusConfig[m.status] ?? memberStatusConfig.pending;
              return (
                <div key={m.userId} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate flex-1">{m.userName}</span>
                  <span className={cn('text-[11px] font-medium flex items-center gap-1', sc.cls)}>
                    <span>{sc.icon}</span> {sc.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Action buttons — only for current user's own row, only if not completed */}
        {canUpdate && !isCompleted && (
          <div className="flex gap-1.5 mt-2.5 pt-2 border-t border-amber-100 dark:border-amber-800/30"
            onClick={e => e.stopPropagation()}>
            {myStatus !== 'in_progress' && (
              <button
                onClick={e => handleStatus(e, 'in_progress')}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition disabled:opacity-50"
              >
                🔄 Start
              </button>
            )}
            <button
              onClick={e => handleStatus(e, 'completed')}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition disabled:opacity-50"
            >
              ✅ Done
            </button>
          </div>
        )}
        {canUpdate && isCompleted && (
          <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-2 text-center">You completed this task ✅</p>
        )}
      </div>
    </div>
  );
}

// ─── Create Group Modal ───────────────────────────────────────────────────────
function CreateGroupModal({ users, onClose, onCreate }: {
  users: any[]; onClose: () => void; onCreate: (group: any) => void;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selected.length === 0) return;
    setLoading(true);
    try {
      const res = await api.groups.create({ groupName: name.trim(), memberIds: selected });
      if (res.success) onCreate(res.data);
    } catch (err) {
      console.error('Create group error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2230] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Create Group</h3>
          </div>
          <button onClick={onClose} className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Group Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Design Team"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Add Members *</label>
            <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(u.id)}
                    onChange={() => toggle(u.id)}
                    className="accent-indigo-600"
                  />
                  <Avatar name={u.name} size="sm" />
                  <span className="text-sm text-slate-800 dark:text-slate-200">{u.name}</span>
                  <span className="text-xs text-slate-400 capitalize ml-auto">{u.role}</span>
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{selected.length} member(s) selected</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading || !name.trim() || selected.length === 0} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-2 text-sm font-medium text-white transition">
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Group Task Modal ─────────────────────────────────────────────────────────
function GroupTaskModal({ groupId, groupName, onClose, onAssigned }: {
  groupId: number; groupName: string; onClose: () => void; onAssigned: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dueDate) return;
    setLoading(true);
    try {
      await api.groups.assignTask(groupId, { taskName: title, description, dueDate, priority });
      onAssigned();
    } catch (err) {
      console.error('Group task error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2230] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <ClipboardList className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Assign Task to Group</h3>
              <p className="text-[11px] text-slate-400">{groupName}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Task Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" required
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description..." rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Due Date *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition">
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 py-2 text-sm font-medium text-white transition">
              {loading ? 'Assigning...' : 'Assign to Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── DM Task Modal ────────────────────────────────────────────────────────────
function TaskModal({ users, currentUserId, role, onClose, onAllocate }: {
  users: any[]; currentUserId: number; role: string;
  onClose: () => void; onAllocate: (taskJson: string, receiverId: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !assignTo || !dueDate) return;
    setLoading(true);
    try {
      const assigneeId = parseInt(assignTo);
      let createdTaskId: number | undefined;
      const res = await api.tasks.create({ taskName: title, description, assignedTo: assigneeId, dueDate, priority, status: 'pending', startDate: new Date().toISOString() });
      createdTaskId = res?.data?.id ?? res?.data?.Id;
      const payload = JSON.stringify({
        taskId: createdTaskId,
        assignedToId: assigneeId,
        title, description,
        assignedTo: users.find(u => u.id === assigneeId)?.name ?? assigneeId,
        dueDate, priority, status: 'Assigned',
      });
      onAllocate(payload, assigneeId);
    } catch (err) {
      console.error('Task allocation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2230] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <ClipboardList className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Allocate Task</h3>
          </div>
          <button onClick={onClose} className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" required
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description..." rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Assign To *</label>
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} required
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition">
              <option value="">Select user</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Due Date *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition">
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 py-2 text-sm font-medium text-white transition">
              {loading ? 'Allocating...' : 'Allocate Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Message List (shared for DM + Group) ────────────────────────────────────
function MessageList({
  messages, loadingHistory, currentUserId, currentUserName, peerName, messagesEndRef, typingUserId, isGroup = false, onStatusUpdate, onGroupTaskStatusUpdate,
}: {
  messages: ChatMsg[];
  loadingHistory: boolean;
  currentUserId: number;
  currentUserName: string;
  peerName: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  typingUserId?: number;
  isGroup?: boolean;
  onStatusUpdate?: (taskId: number, status: string) => void;
  onGroupTaskStatusUpdate?: (taskId: number, status: string) => Promise<void>;
}) {
  // Group messages by date with separators
  const grouped: Array<{ type: 'separator'; label: string } | { type: 'msg'; msg: ChatMsg }> = [];
  let lastDate: Date | null = null;
  messages.forEach(msg => {
    const d = new Date(msg.createdAt);
    if (!lastDate || !isSameDay(d, lastDate)) {
      grouped.push({ type: 'separator', label: dateLabel(msg.createdAt) });
      lastDate = d;
    }
    grouped.push({ type: 'msg', msg });
  });

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50/60 dark:bg-[#151724]">
      {/* Loading */}
      {loadingHistory && (
        <div className="flex items-center justify-center py-10">
          <div className="flex gap-1.5">
            {[0, 150, 300].map(d => (
              <span key={d} className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loadingHistory && grouped.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No messages yet. Say hi to <span className="font-semibold text-slate-600 dark:text-slate-300">{peerName}</span>!
          </p>
        </div>
      )}

      {/* Messages */}
      {grouped.map((item, i) => {
        if (item.type === 'separator') return <DateSeparator key={`sep-${i}`} label={item.label} />;

        const { msg } = item;
        const isMine = msg.senderId === currentUserId;
        const isOptimistic = msg.id > 1_700_000_000_000 && isMine;
        const senderName = isMine ? currentUserName : (msg.senderName || peerName);

        // ── System message ──────────────────────────────────────────────
        if (msg.type === 'system') {
          return <SystemMessage key={msg.id ?? i} text={msg.message} />;
        }

        // ── Task message ────────────────────────────────────────────────
        if (msg.type === 'task' && msg.taskPayload) {
          // Detect group task (has members array) vs DM task
          let isGroupTask = false;
          try { const p = JSON.parse(msg.taskPayload); isGroupTask = Array.isArray(p.members); } catch { /* */ }

          return (
            <div key={msg.id ?? i} className={cn('flex mb-3 group', isMine ? 'justify-end' : 'justify-start')}>
              {/* Other's avatar */}
              {!isMine && (
                <div className="shrink-0 mr-2 mt-0.5">
                  <Avatar name={senderName} size="sm" />
                </div>
              )}
              <div className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
                {/* Sender name */}
                <span className={cn(
                  'text-[11px] font-semibold mb-1 px-1',
                  isMine ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-300'
                )}>
                  {isMine ? 'You' : senderName}
                </span>
                {isGroupTask ? (
                  <GroupTaskCard
                    payload={msg.taskPayload}
                    currentUserId={currentUserId}
                    onUpdateStatus={onGroupTaskStatusUpdate}
                  />
                ) : (
                  <TaskCard payload={msg.taskPayload} isMine={isMine} currentUserId={currentUserId} onStatusUpdate={onStatusUpdate} />
                )}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                  {format(new Date(msg.createdAt), 'h:mm a')}
                </span>
              </div>
              {/* Own avatar */}
              {isMine && (
                <div className="shrink-0 ml-2 mt-0.5">
                  <Avatar name={senderName} size="sm" />
                </div>
              )}
            </div>
          );
        }

        // ── Text message (Flock bubble style) ───────────────────────────
        return (
          <div key={msg.id ?? i} className={cn('flex mb-2 group', isMine ? 'justify-end' : 'justify-start')}>
            {/* Other's avatar */}
            {!isMine && (
              <div className="shrink-0 mr-2 mt-0.5">
                <Avatar name={senderName} size="sm" />
              </div>
            )}

            <div className={cn('flex flex-col max-w-[72%]', isMine ? 'items-end' : 'items-start')}>
              {/* Sender name — show in group or for others */}
              {(!isMine || isGroup) && (
                <span className={cn(
                  'text-[11px] font-semibold mb-0.5 px-1',
                  isMine ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-300'
                )}>
                  {isMine ? 'You' : senderName}
                </span>
              )}

              {/* Bubble */}
              <div className={cn(
                'relative px-3 py-2 rounded-2xl text-sm leading-relaxed break-words transition-all',
                'group-hover:shadow-sm',
                isMine
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-sm',
                isOptimistic && 'opacity-60'
              )}>
                {msg.message}
              </div>

              {/* Time + status */}
              <div className={cn('flex items-center gap-1 mt-0.5 px-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {format(new Date(msg.createdAt), 'h:mm a')}
                </span>
                {isMine && (
                  isOptimistic
                    ? <span className="text-[10px] text-slate-300 dark:text-slate-600">Sending…</span>
                    : msg.isRead
                      ? <CheckCheck className="h-3 w-3 text-violet-400" />
                      : <Check className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                )}
              </div>
            </div>

            {/* Own avatar */}
            {isMine && (
              <div className="shrink-0 ml-2 mt-0.5">
                <Avatar name={senderName} size="sm" />
              </div>
            )}
          </div>
        );
      })}

      {/* Typing indicator */}
      {typingUserId && (
        <div className="flex items-end gap-2 mb-2">
          <Avatar name={peerName} size="sm" />
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-3 py-2">
            <div className="flex gap-1 items-center h-4">
              {[0, 150, 300].map(d => (
                <span key={d} className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

// ─── Main ChatBox ─────────────────────────────────────────────────────────────
export function ChatBox() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Panel state: 'list' | 'dm' | 'group'
  const [panel, setPanel] = useState<'list' | 'dm' | 'group'>('list');

  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

  const [dmMessages, setDmMessages] = useState<ChatMsg[]>([]);
  const [groupMessages, setGroupMessages] = useState<ChatMsg[]>([]);

  const [input, setInput] = useState('');
  const [unreadMap, setUnreadMap] = useState<Record<number, number>>({});
  const [groupUnreadMap, setGroupUnreadMap] = useState<Record<number, number>>({});

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showGroupTaskModal, setShowGroupTaskModal] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Refs so real-time handlers always see current values without stale closures
  const selectedGroupRef = useRef<any>(null);
  const selectedUserRef = useRef<any>(null);

  const { connected, typingUsers, onMessage, onGroupMessage, onTaskStatusUpdate, onTaskUserStatusUpdate,
    sendMessage, sendTaskMessage, sendGroupMessage, sendGroupTaskMessage,
    updateTaskStatus, updateGroupTaskUserStatus, markRead, sendTyping } = useChat(!!user);

  // Keep refs in sync with state for use inside event handlers
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  // Toggle open
  useEffect(() => {
    const handler = () => setOpen(v => !v);
    window.addEventListener('toggle-chatbox', handler);
    return () => window.removeEventListener('toggle-chatbox', handler);
  }, []);

  // Open chat with specific user
  useEffect(() => {
    const handler = (e: Event) => {
      const { userId } = (e as CustomEvent).detail ?? {};
      if (!userId) return;
      setOpen(true);
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        setUsers(prev => {
          const found = prev.find(u => u.id === userId);
          if (found) { setSelectedUser(found); setPanel('dm'); clearInterval(interval); }
          else if (attempts >= 15) clearInterval(interval);
          return prev;
        });
      }, 300);
    };
    window.addEventListener('open-chat-with', handler);
    return () => window.removeEventListener('open-chat-with', handler);
  }, []);

  // Load users + groups when open
  useEffect(() => {
    if (!user || !open) return;
    api.chat.getUsers().then(res => { if (res.success && res.data) setUsers(res.data); }).catch(() => {});
    api.chat.getUnread().then(res => {
      if (res.success && res.data) {
        const map: Record<number, number> = {};
        res.data.forEach((item: any) => { map[item.senderId] = item.count; });
        setUnreadMap(map);
      }
    }).catch(() => {});
    api.groups.getMyGroups().then(res => {
      if (res.success && res.data) {
        setGroups(res.data);
        const gmap: Record<number, number> = {};
        res.data.forEach((g: any) => { gmap[g.id] = g.unreadCount ?? 0; });
        setGroupUnreadMap(gmap);
      }
    }).catch(() => {});
  }, [user, open]);

  // Load DM history
  useEffect(() => {
    if (!selectedUser) return;
    setDmMessages([]);
    setLoadingHistory(true);
    api.chat.getHistory(selectedUser.id).then(res => {
      if (res.success && res.data) setDmMessages(res.data as ChatMsg[]);
    }).catch(() => {}).finally(() => setLoadingHistory(false));
    markRead(selectedUser.id);
    api.chat.markRead(selectedUser.id).catch(() => {});
    setUnreadMap(prev => ({ ...prev, [selectedUser.id]: 0 }));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedUser]);

  // Load group history
  useEffect(() => {
    if (!selectedGroup) return;
    setGroupMessages([]);
    setLoadingHistory(true);
    api.groups.getMessages(selectedGroup.id).then(res => {
      if (res.success && res.data) setGroupMessages(res.data as ChatMsg[]);
    }).catch(() => {}).finally(() => setLoadingHistory(false));
    setGroupUnreadMap(prev => ({ ...prev, [selectedGroup.id]: 0 }));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedGroup]);

  // Real-time DM messages
  useEffect(() => {
    const unsub = onMessage((msg: ChatMsg) => {
      const myId = Number(user?.id);
      const currentUser = selectedUserRef.current;
      const theirId = currentUser?.id;
      const belongsHere = currentUser &&
        ((msg.senderId === myId && msg.receiverId === theirId) ||
         (msg.senderId === theirId && msg.receiverId === myId));

      if (belongsHere) {
        setDmMessages(prev => {
          // Replace optimistic task card
          if (msg.type === 'task' && msg.taskPayload) {
            const optIdx = prev.findIndex(m => m.type === 'task' && m.taskPayload === msg.taskPayload && m.id > 1_700_000_000_000);
            if (optIdx !== -1) { const u = [...prev]; u[optIdx] = msg; return u; }
          }
          // Replace optimistic text message by sender+text match
          if (msg.type === 'text' && msg.senderId === myId) {
            const optIdx = prev.findIndex(m => m.id > 1_700_000_000_000 && m.type === 'text' && m.senderId === myId && m.message === msg.message);
            if (optIdx !== -1) { const u = [...prev]; u[optIdx] = msg; return u; }
          }
          // Deduplicate by real server id
          if (prev.some(m => m.id === msg.id && m.id < 1_700_000_000_000)) return prev;
          return [...prev, msg];
        });
        markRead(msg.senderId);
        api.chat.markRead(msg.senderId).catch(() => {});
      } else {
        setUnreadMap(prev => ({ ...prev, [msg.senderId]: (prev[msg.senderId] ?? 0) + 1 }));
      }
    });
    return unsub;
  }, [onMessage, markRead, user]);

  // Real-time group messages — mirrors DM logic exactly, adapted for groupId
  useEffect(() => {
    const unsub = onGroupMessage((msg: ChatMsg) => {
      const myId = Number(user?.id);
      const currentGroup = selectedGroupRef.current;

      // Does this message belong to the currently open group?
      const belongsHere = currentGroup && msg.groupId === currentGroup.id;

      if (belongsHere) {
        setGroupMessages(prev => {
          // Replace optimistic task card (same payload)
          if (msg.type === 'task' && msg.taskPayload) {
            const optIdx = prev.findIndex(
              m => m.type === 'task' && m.taskPayload === msg.taskPayload && m.id > 1_700_000_000_000
            );
            if (optIdx !== -1) { const u = [...prev]; u[optIdx] = msg; return u; }
          }
          // Replace optimistic text — my own echo from server (Clients.Caller)
          if (msg.type === 'text' && msg.senderId === myId) {
            const optIdx = prev.findIndex(
              m => m.id > 1_700_000_000_000 && m.type === 'text' && m.senderId === myId && m.message === msg.message
            );
            if (optIdx !== -1) { const u = [...prev]; u[optIdx] = msg; return u; }
          }
          // Deduplicate — don't add if real server id already exists
          if (prev.some(m => m.id === msg.id && m.id < 1_700_000_000_000)) return prev;
          return [...prev, msg];
        });
      } else if (msg.groupId) {
        // Not the open group — increment unread badge
        setGroupUnreadMap(prev => ({ ...prev, [msg.groupId!]: (prev[msg.groupId!] ?? 0) + 1 }));
      }
    });
    return unsub;
  }, [onGroupMessage, user]);

  // Real-time task status updates — patch taskPayload.status in both DM + group messages
  useEffect(() => {
    const unsub = onTaskStatusUpdate(({ taskId, status }) => {
      const patchPayload = (payload: string) => {
        try {
          const p = JSON.parse(payload);
          return JSON.stringify({ ...p, status });
        } catch { return payload; }
      };
      const patchMessages = (prev: ChatMsg[]) =>
        prev.map(m => {
          if (m.type !== 'task' || !m.taskPayload) return m;
          try {
            const p = JSON.parse(m.taskPayload);
            if (p.taskId === taskId) return { ...m, taskPayload: patchPayload(m.taskPayload) };
          } catch { /* ignore */ }
          return m;
        });
      setDmMessages(patchMessages);
      setGroupMessages(patchMessages);
    });
    return unsub;
  }, [onTaskStatusUpdate]);

  // Real-time per-user group task status — patch members array inside task payload
  useEffect(() => {
    const unsub = onTaskUserStatusUpdate(({ taskId, userId, status }) => {
      const patchMessages = (prev: ChatMsg[]) =>
        prev.map(m => {
          if (m.type !== 'task' || !m.taskPayload) return m;
          try {
            const p = JSON.parse(m.taskPayload);
            if (p.taskId !== taskId || !Array.isArray(p.members)) return m;
            return {
              ...m,
              taskPayload: JSON.stringify({
                ...p,
                members: p.members.map((mem: any) =>
                  mem.userId === userId ? { ...mem, status } : mem
                ),
              }),
            };
          } catch { return m; }
        });
      setGroupMessages(patchMessages);
    });
    return unsub;
  }, [onTaskUserStatusUpdate]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages, groupMessages]);

  const handleSendDm = async () => {
    if (!input.trim() || !selectedUser) return;
    const text = input.trim();
    setInput('');
    const optimisticMsg: ChatMsg = {
      id: Date.now(), senderId: Number(user!.id), senderName: user!.name,
      receiverId: selectedUser.id, message: text, type: 'text',
      createdAt: new Date().toISOString(), isRead: false,
    };
    setDmMessages(prev => [...prev, optimisticMsg]);
    try {
      if (connected) {
        await sendMessage(selectedUser.id, text);
      } else {
        const res = await api.chat.send(selectedUser.id, text);
        if (res.success && res.data) setDmMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...res.data } : m));
      }
    } catch { setDmMessages(prev => prev.filter(m => m.id !== optimisticMsg.id)); }
  };

  const handleSendGroup = async () => {
    if (!input.trim() || !selectedGroup) return;
    const text = input.trim();
    setInput('');
    const optimisticMsg: ChatMsg = {
      id: Date.now(), senderId: Number(user!.id), senderName: user!.name,
      receiverId: null, groupId: selectedGroup.id, message: text, type: 'text',
      createdAt: new Date().toISOString(), isRead: false,
    };
    setGroupMessages(prev => [...prev, optimisticMsg]);
    try {
      if (connected) {
        // SignalR — server will echo back via ReceiveGroupMessage → replaces optimistic
        await sendGroupMessage(selectedGroup.id, text);
      } else {
        // REST fallback — replace optimistic with confirmed server message
        const res = await api.groups.sendMessage(selectedGroup.id, text);
        if (res.success && res.data) {
          setGroupMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...res.data } : m));
        }
      }
    } catch {
      // Remove optimistic on failure
      setGroupMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (panel === 'dm') handleSendDm();
      else if (panel === 'group') handleSendGroup();
    }
    if (selectedUser && panel === 'dm') {
      sendTyping(selectedUser.id, true).catch(() => {});
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTyping(selectedUser.id, false).catch(() => {}), 2000);
    }
  };

  const handleTaskAllocate = async (taskJson: string, receiverId: number) => {
    setShowTaskModal(false);
    const targetUser = users.find(u => u.id === receiverId);
    if (targetUser) { setSelectedUser(targetUser); setPanel('dm'); }
    const optimisticMsg: ChatMsg = {
      id: Date.now(), senderId: Number(user!.id), senderName: user!.name,
      receiverId, message: '📌 Task Assigned', type: 'task', taskPayload: taskJson,
      createdAt: new Date().toISOString(), isRead: false,
    };
    setDmMessages(prev => [...prev, optimisticMsg]);
    try {
      if (connected) {
        await sendTaskMessage(receiverId, taskJson);
      } else {
        // REST fallback — saves to DB and broadcasts via SignalR server-side
        const res = await api.chat.send(receiverId, '📌 Task Assigned', 'task', taskJson);
        if (res.success && res.data) {
          setDmMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...res.data } : m));
        }
      }
    } catch { console.error('Task send error'); }
  };

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0) +
    Object.values(groupUnreadMap).reduce((a, b) => a + b, 0);

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGroups = groups.filter(g =>
    g.groupName?.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'fixed bottom-5 right-4 z-[200] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200',
          'bg-violet-600 text-white hover:bg-violet-700 hover:scale-105 active:scale-95',
          open && 'hidden lg:flex bg-slate-700 hover:bg-slate-800'
        )}
        aria-label="Open chat"
      >
        <div className="relative">
          {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
          {!open && totalUnread > 0 && (
            <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
      </button>

      {/* Chat Window */}
      {open && (
        <>
          {/* Blurred backdrop — mobile only */}
          <div
            className="fixed inset-0 z-[199] bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
        <div
          className={cn(
            'fixed z-[200] shadow-2xl overflow-hidden flex flex-col transition-all duration-200',
            'bg-white dark:bg-[#1a1d2e]',
            'inset-0 w-full h-[100dvh] rounded-none border-none', // Mobile: full screen
            'lg:inset-auto lg:bottom-[72px] lg:right-4 lg:max-h-[calc(100vh-100px)] lg:h-[600px] lg:rounded-2xl lg:border lg:border-slate-200 lg:dark:border-slate-700', // Desktop: floating window
            panel !== 'list' ? 'lg:w-[380px]' : 'lg:w-[340px]'
          )}
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          {/* ── CONTACTS LIST ─────────────────────────────────────────── */}
          {panel === 'list' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-600" />
                  <span className="font-semibold text-slate-800 dark:text-white text-sm">Messages</span>
                  {connected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />}
                </div>
                <div className="flex items-center gap-1">
                  {user.role === 'admin' && (
                    <button onClick={() => setShowCreateGroup(true)} title="Create Group"
                      className="h-9 w-9 lg:h-7 lg:w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                      <Plus className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)}
                    className="h-9 w-9 lg:h-7 lg:w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700/60">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Groups section */}
                {filteredGroups.length > 0 && (
                  <>
                    <div className="px-3 pt-2.5 pb-1">
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Groups</span>
                    </div>
                    {filteredGroups.map(g => {
                      const unread = groupUnreadMap[g.id] ?? 0;
                      return (
                        <button key={g.id} onClick={() => { setSelectedGroup(g); setPanel('group'); }}
                          className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left">
                          <Avatar name={g.groupName} size="md" isGroup />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={cn('text-sm truncate', unread > 0 ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200')}>
                                {g.groupName}
                              </p>
                              {unread > 0 && (
                                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white px-1.5 shrink-0">
                                  {unread > 99 ? '99+' : unread}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{g.members?.length ?? 0} members</p>
                          </div>
                        </button>
                      );
                    })}
                    <div className="px-3 pt-2.5 pb-1">
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Direct Messages</span>
                    </div>
                  </>
                )}
                {/* Users section */}
                {filteredUsers.length === 0 && filteredGroups.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
                    <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">{search ? 'No results found' : 'No users available'}</p>
                  </div>
                )}
                {filteredUsers.map(u => {
                  const unread = unreadMap[u.id] ?? 0;
                  return (
                    <button key={u.id} onClick={() => { setSelectedUser(u); setPanel('dm'); }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left">
                      <Avatar name={u.name} size="md" showDot={connected} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={cn('text-sm truncate', unread > 0 ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200')}>
                            {u.name}
                          </p>
                          {unread > 0 && (
                            <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white px-1.5 shrink-0">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 capitalize truncate">{u.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── DM PANEL ──────────────────────────────────────────────── */}
          {panel === 'dm' && selectedUser && (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 px-3 py-3 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
                <button onClick={() => { setPanel('list'); setSelectedUser(null); }}
                  className="h-9 w-9 lg:h-7 lg:w-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0">
                  <ChevronLeft className="h-5 w-5 lg:h-4 lg:w-4" />
                </button>
                <Avatar name={selectedUser.name} size="md" showDot={connected} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{selectedUser.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 capitalize">
                    {typingUsers[selectedUser.id] ? <span className="text-violet-500 italic animate-pulse">typing...</span> : selectedUser.role}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {user.role === 'admin' && (
                    <button onClick={() => setShowTaskModal(true)} title="Allocate Task"
                      className="h-9 w-9 lg:h-7 lg:w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors">
                      <ClipboardList className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)}
                    className="h-9 w-9 lg:h-7 lg:w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                  </button>
                </div>
              </div>
              <MessageList
                messages={dmMessages} loadingHistory={loadingHistory}
                currentUserId={Number(user.id)} currentUserName={user.name}
                peerName={selectedUser.name} messagesEndRef={messagesEndRef}
                typingUserId={typingUsers[selectedUser.id] ? selectedUser.id : undefined}
                onStatusUpdate={updateTaskStatus}
              />
              <div className="border-t border-slate-100 dark:border-slate-700/60 bg-white dark:bg-[#1a1d2e] px-3 py-2.5 shrink-0">
                {user.role !== 'admin' && (
                  <div className="flex items-center gap-1 mb-2">
                    <button onClick={() => setShowTaskModal(true)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors">
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span>Allocate Task</span>
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button title="Attach file (coming soon)"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors shrink-0">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={`Message ${selectedUser.name.split(' ')[0]}...`}
                    className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition min-w-0" />
                  <button title="Emoji (coming soon)"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors shrink-0">
                    <Smile className="h-4 w-4" />
                  </button>
                  <button onClick={handleSendDm} disabled={!input.trim()}
                    className={cn('h-8 w-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                      input.trim() ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed')}>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── GROUP PANEL ───────────────────────────────────────────── */}
          {panel === 'group' && selectedGroup && (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 px-3 py-3 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
                <button onClick={() => { setPanel('list'); setSelectedGroup(null); }}
                  className="h-9 w-9 lg:h-7 lg:w-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0">
                  <ChevronLeft className="h-5 w-5 lg:h-4 lg:w-4" />
                </button>
                <Avatar name={selectedGroup.groupName} size="md" isGroup />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{selectedGroup.groupName}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {selectedGroup.members?.length ?? 0} members
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {user.role === 'admin' && (
                    <button onClick={() => setShowGroupTaskModal(true)} title="Assign Task to Group"
                      className="h-9 w-9 lg:h-7 lg:w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors">
                      <ClipboardList className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)}
                    className="h-9 w-9 lg:h-7 lg:w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                  </button>
                </div>
              </div>
              <MessageList
                messages={groupMessages} loadingHistory={loadingHistory}
                currentUserId={Number(user.id)} currentUserName={user.name}
                peerName={selectedGroup.groupName} messagesEndRef={messagesEndRef}
                isGroup onStatusUpdate={updateTaskStatus}
                onGroupTaskStatusUpdate={updateGroupTaskUserStatus}
              />
              <div className="border-t border-slate-100 dark:border-slate-700/60 bg-white dark:bg-[#1a1d2e] px-3 py-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={`Message ${selectedGroup.groupName}...`}
                    className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition min-w-0" />
                  <button title="Emoji (coming soon)"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors shrink-0">
                    <Smile className="h-4 w-4" />
                  </button>
                  <button onClick={handleSendGroup} disabled={!input.trim()}
                    className={cn('h-8 w-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                      input.trim() ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed')}>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </>
      )}

      {/* Modals */}
      {showTaskModal && (
        <TaskModal users={users} currentUserId={Number(user.id)} role={user.role}
          onClose={() => setShowTaskModal(false)} onAllocate={handleTaskAllocate} />
      )}
      {showGroupTaskModal && selectedGroup && (
        <GroupTaskModal groupId={selectedGroup.id} groupName={selectedGroup.groupName}
          onClose={() => setShowGroupTaskModal(false)}
          onAssigned={() => {
            setShowGroupTaskModal(false);
            // Reload group messages to show the new task card
            api.groups.getMessages(selectedGroup.id).then(res => {
              if (res.success && res.data) setGroupMessages(res.data as ChatMsg[]);
            }).catch(() => {});
          }} />
      )}
      {showCreateGroup && (
        <CreateGroupModal users={users} onClose={() => setShowCreateGroup(false)}
          onCreate={newGroup => {
            setShowCreateGroup(false);
            api.groups.getMyGroups().then(res => {
              if (res.success && res.data) setGroups(res.data);
            }).catch(() => {});
          }} />
      )}
    </>
  );
}
