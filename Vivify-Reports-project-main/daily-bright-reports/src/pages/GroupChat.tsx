import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useChat, ChatMsg, TaskStatusUpdate } from '@/hooks/useChat';
import { TaskChatCard } from '@/components/chat/TaskChatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Users, MessageSquare } from 'lucide-react';

interface Group {
  id: number;
  groupName: string;
  createdByName: string;
  members: { userId: number; name: string; role: string }[];
  unreadCount: number;
}

const GroupChat: React.FC = () => {
  const { user } = useAuth();
  const chat = useChat(true);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load groups on mount
  useEffect(() => {
    api.groups.getMyGroups().then(res => {
      if (res.success) setGroups(res.data ?? []);
    }).finally(() => setLoadingGroups(false));
  }, []);

  // Load messages when group changes
  useEffect(() => {
    if (!selectedGroup) return;
    setLoadingMessages(true);
    setMessages([]);
    api.groups.getMessages(selectedGroup.id).then(res => {
      if (res.success) setMessages(res.data ?? []);
    }).finally(() => setLoadingMessages(false));
  }, [selectedGroup?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time: incoming group messages
  useEffect(() => {
    return chat.onGroupMessage((msg: ChatMsg) => {
      if (msg.groupId === selectedGroup?.id) {
        setMessages(prev => {
          // Deduplicate by id
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      // Update unread badge for other groups
      if (msg.groupId !== selectedGroup?.id) {
        setGroups(prev => prev.map(g =>
          g.id === msg.groupId ? { ...g, unreadCount: g.unreadCount + 1 } : g
        ));
      }
    });
  }, [chat.onGroupMessage, selectedGroup?.id]);

  // Real-time: task status updates — patch the taskPayload inside existing task messages
  useEffect(() => {
    return chat.onTaskStatusUpdate((update: TaskStatusUpdate) => {
      setMessages(prev => prev.map(msg => {
        if (msg.type !== 'task' || !msg.taskPayload) return msg;
        try {
          const payload = JSON.parse(msg.taskPayload);
          if (payload.taskId !== update.taskId) return msg;
          return {
            ...msg,
            taskPayload: JSON.stringify({ ...payload, status: update.status }),
          };
        } catch { return msg; }
      }));
    });
  }, [chat.onTaskStatusUpdate]);

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
    // Clear unread badge
    setGroups(prev => prev.map(g => g.id === group.id ? { ...g, unreadCount: 0 } : g));
    chat.joinGroup(group.id);
  };

  const handleSend = async () => {
    if (!text.trim() || !selectedGroup || !chat.connected) return;
    setSending(true);
    try {
      await chat.sendGroupMessage(selectedGroup.id, text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTaskStatusChanged = useCallback((taskId: number, newStatus: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.type !== 'task' || !msg.taskPayload) return msg;
      try {
        const payload = JSON.parse(msg.taskPayload);
        if (payload.taskId !== taskId) return msg;
        return { ...msg, taskPayload: JSON.stringify({ ...payload, status: newStatus }) };
      } catch { return msg; }
    }));
  }, []);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* Sidebar — group list */}
        <aside className="w-64 shrink-0 border-r border-gray-100 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="h-4 w-4" /> Group Chats
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingGroups ? (
              <div className="p-4 text-xs text-gray-400">Loading…</div>
            ) : groups.length === 0 ? (
              <div className="p-4 text-xs text-gray-400">No groups yet.</div>
            ) : groups.map(g => (
              <button
                key={g.id}
                onClick={() => handleSelectGroup(g)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                  selectedGroup?.id === g.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{g.groupName}</p>
                  <p className="text-xs text-gray-400 truncate">{g.members.length} members</p>
                </div>
                {g.unreadCount > 0 && (
                  <Badge className="ml-2 bg-blue-600 text-white text-[10px] h-5 min-w-[20px] flex items-center justify-center rounded-full shrink-0">
                    {g.unreadCount}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select a group to start chatting</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{selectedGroup.groupName}</h3>
                  <p className="text-xs text-gray-400">
                    {selectedGroup.members.map(m => m.name).join(', ')}
                  </p>
                </div>
                {!chat.connected && (
                  <Badge variant="outline" className="ml-auto text-xs text-orange-600 border-orange-300">
                    Reconnecting…
                  </Badge>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {loadingMessages ? (
                  <div className="text-xs text-gray-400 text-center py-8">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-8">No messages yet. Say hello!</div>
                ) : messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id || i}
                    msg={msg}
                    isOwn={msg.senderId === user?.id}
                    chat={chat}
                    currentUserId={user?.id ?? 0}
                    onTaskStatusChanged={handleTaskStatusChanged}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <Input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  className="flex-1 text-sm"
                  disabled={!chat.connected}
                />
                <Button
                  onClick={handleSend}
                  disabled={!text.trim() || sending || !chat.connected}
                  size="sm"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

// ── Message bubble ─────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: ChatMsg;
  isOwn: boolean;
  chat: ReturnType<typeof useChat>;
  currentUserId: number;
  onTaskStatusChanged: (taskId: number, newStatus: string) => void;
}

const MessageBubble: React.FC<BubbleProps> = ({ msg, isOwn, chat, currentUserId, onTaskStatusChanged }) => {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.message}</span>
      </div>
    );
  }

  if (msg.type === 'task' && msg.taskPayload) {
    return (
      <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && <span className="text-xs text-gray-500 ml-1">{msg.senderName}</span>}
        <TaskChatCard
          rawPayload={msg.taskPayload}
          currentUserId={currentUserId}
          chat={chat}
          onStatusChanged={onTaskStatusChanged}
        />
        <span className="text-[10px] text-gray-400">{time}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
      {!isOwn && <span className="text-xs text-gray-500 ml-1">{msg.senderName}</span>}
      <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm ${
        isOwn
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
      }`}>
        {msg.message}
      </div>
      <span className="text-[10px] text-gray-400">{time}</span>
    </div>
  );
};

export default GroupChat;
