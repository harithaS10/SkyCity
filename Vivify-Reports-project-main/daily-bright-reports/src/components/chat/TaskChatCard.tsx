import React, { useState } from 'react';
import { useChat } from '../../hooks/useChat';

interface TaskPayload {
  taskId: number;
  title: string;
  description?: string;
  dueDate: string;
  priority: string;
  assignedTo?: string;
  assignedBy?: string;
  status: string;
}

interface Props {
  rawPayload: string;
  currentUserId: number;
  chat: ReturnType<typeof useChat>;
  /** Called after a successful status update so the parent can refresh */
  onStatusChanged?: (taskId: number, newStatus: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const TaskChatCard: React.FC<Props> = ({ rawPayload, chat, onStatusChanged }) => {
  const [task, setTask] = useState<TaskPayload>(() => {
    try { return JSON.parse(rawPayload); }
    catch { return null as unknown as TaskPayload; }
  });
  const [loading, setLoading] = useState<string | null>(null);

  if (!task) return <div className="text-xs text-gray-400 italic">Invalid task card</div>;

  const status = (task.status ?? 'pending').toLowerCase();
  const isPending = status === 'pending';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';

  const handleAction = async (action: 'start' | 'done') => {
    setLoading(action);
    try {
      await chat.updateTaskStatus(task.taskId, action);
      const newStatus = action === 'start' ? 'in_progress' : 'completed';
      setTask(prev => ({ ...prev, status: newStatus }));
      onStatusChanged?.(task.taskId, newStatus);
    } catch (err) {
      console.error('Failed to update task status', err);
    } finally {
      setLoading(null);
    }
  };

  const priorityClass = PRIORITY_COLORS[task.priority?.toLowerCase()] ?? PRIORITY_COLORS.medium;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 max-w-sm w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base">📌</span>
          <span className="font-semibold text-gray-800 text-sm truncate">{task.title}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${priorityClass}`}>
          {task.priority}
        </span>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
        {task.dueDate && (
          <span>📅 Due: {new Date(task.dueDate).toLocaleDateString()}</span>
        )}
        {task.assignedBy && <span>👤 By: {task.assignedBy}</span>}
      </div>

      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isCompleted ? 'bg-green-100 text-green-700' :
          isInProgress ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {STATUS_LABELS[status] ?? status}
        </span>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isPending && (
            <button
              onClick={() => handleAction('start')}
              disabled={loading !== null}
              className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'start' ? '…' : '▶ Start'}
            </button>
          )}
          {(isPending || isInProgress) && (
            <button
              onClick={() => handleAction('done')}
              disabled={loading !== null}
              className="text-xs px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'done' ? '…' : '✓ Done'}
            </button>
          )}
          {isCompleted && (
            <span className="text-xs text-green-600 font-medium">✓ Completed</span>
          )}
        </div>
      </div>
    </div>
  );
};
