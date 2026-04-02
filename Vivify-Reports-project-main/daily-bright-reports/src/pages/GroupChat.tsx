import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useChat, ChatMsg, TaskStatusUpdate } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Users, MessageSquare, Search, Plus, X, Check, Paperclip } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function getInitials(name: string) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-pink-500','bg-indigo-500'];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function timeLabel(dateStr: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
    return format(d, 'dd MMM HH:mm');
  } catch { return ''; }
}

interface User { id: number; name: string; fullName?: string; role: string; isActive: boolean; }
interface Group { id: number; groupName: string; memberCount?: number; unreadCount?: number; members?: {userId: number; name?: string}[]; }

const GroupChat: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canChat = user?.role === 'staff' ? hasPermission('chat', 'create') : true;
  const chat = useChat(true);

  const [tab, setTab] = useState<'dm' | 'groups'>('dm');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [dmMessages, setDmMessages] = useState<ChatMsg[]>([]);
  const [groupMessages, setGroupMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<{src: string; name: string} | null>(null);
  const [attachPreview, setAttachPreview] = useState<{dataUrl: string; fileName: string; fileType: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = ['admin','super_admin','sub_admin','property_manager'].includes(user?.role ?? '');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const [showMembers, setShowMembers] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    setCreatingGroup(true);
    try {
      const res = await api.groups.create({ groupName: groupName.trim(), memberIds: selectedMembers });
      if (res.success && res.data) {
        // Reload groups to get accurate memberCount
        const groupsRes = await api.groups.getMyGroups();
        if (groupsRes.success && groupsRes.data) setGroups(groupsRes.data);
        const newGroup = res.data;
        setShowCreateGroup(false);
        setGroupName('');
        setSelectedMembers([]);
        setMemberSearch('');
        setSelectedGroup(newGroup);
        setSelectedUser(null);
        setTab('groups');
      }
    } catch {} finally { setCreatingGroup(false); }
  };

  // Load users & groups
  useEffect(() => {
    api.chat.getUsers().then(res => {
      if (res.success && res.data) setUsers(res.data.map((u: any) => ({ ...u, name: u.fullName || u.username })));
    }).catch(() => {});
    api.groups.getMyGroups().then(res => {
      if (res.success && res.data) setGroups(res.data);
    }).catch(() => {});
  }, []);

  // Load DM history
  useEffect(() => {
    if (!selectedUser) return;
    setLoading(true);
    setDmMessages([]);
    api.chat.getHistory(selectedUser.id).then(res => {
      if (res.success && res.data) setDmMessages(res.data as ChatMsg[]);
    }).catch(() => {}).finally(() => setLoading(false));
    api.chat.markRead(selectedUser.id).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedUser?.id]);

  // Load group history
  useEffect(() => {
    if (!selectedGroup) return;
    setLoading(true);
    setGroupMessages([]);
    // Fetch group details to get members
    api.groups.getGroup(selectedGroup.id).then(res => {
      if (res.success && res.data) {
        setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, ...res.data, memberCount: res.data.members?.length ?? res.data.memberCount } : g));
        setSelectedGroup(prev => prev ? { ...prev, ...res.data, memberCount: res.data.members?.length ?? res.data.memberCount } : prev);
      }
    }).catch(() => {});
    api.groups.getMessages(selectedGroup.id).then(res => {
      if (res.success && res.data) setGroupMessages(res.data as ChatMsg[]);
    }).catch(() => {}).finally(() => setLoading(false));
    chat.joinGroup(selectedGroup.id);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedGroup?.id]);

  // Real-time DMs
  useEffect(() => {
    return chat.onMessage((msg: ChatMsg) => {
      if (selectedUser && (msg.senderId === selectedUser.id || msg.receiverId === selectedUser.id)) {
        setDmMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
    });
  }, [chat.onMessage, selectedUser?.id]);

  // Real-time group messages
  useEffect(() => {
    return chat.onGroupMessage((msg: ChatMsg) => {
      if (msg.groupId === selectedGroup?.id) {
        setGroupMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
    });
  }, [chat.onGroupMessage, selectedGroup?.id]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages, groupMessages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File too large (max 10MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachPreview({ dataUrl: reader.result as string, fileName: file.name, fileType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!canChat) { toast.error("You don't have permission to send messages"); return; }
    if (!text.trim() && !attachPreview) return;
    const t = text.trim();
    const attach = attachPreview;
    setText('');
    setAttachPreview(null);
    setSending(true);
    const msgType = attach ? (attach.fileType.startsWith('image/') ? 'image' : 'file') : 'text';
    const payload = attach ? JSON.stringify({ dataUrl: attach.dataUrl, fileName: attach.fileName, fileType: attach.fileType }) : undefined;
    const displayMsg = attach ? (t || attach.fileName) : t;
    try {
      if (selectedUser) {
        const optimistic: ChatMsg = {
          id: Date.now(), senderId: user!.id, senderName: user!.fullName || user!.username,
          receiverId: selectedUser.id, message: displayMsg, type: msgType,
          payload: payload ?? null, createdAt: new Date().toISOString(), isRead: false,
        };
        setDmMessages(prev => [...prev, optimistic]);
        const res = await api.chat.send(selectedUser.id, displayMsg, msgType, payload);
        if (res.success && res.data)
          setDmMessages(prev => prev.map(m => m.id === optimistic.id ? { ...optimistic, ...res.data } : m));
      } else if (selectedGroup) {
        const optimistic: ChatMsg = {
          id: Date.now(), senderId: user!.id, senderName: user!.fullName || user!.username,
          groupId: selectedGroup.id, receiverId: null, message: displayMsg, type: msgType,
          payload: payload ?? null, createdAt: new Date().toISOString(), isRead: false,
        };
        setGroupMessages(prev => [...prev, optimistic]);
        const res = await api.groups.sendMessage(selectedGroup.id, displayMsg, msgType, payload);
        if (res.success && res.data)
          setGroupMessages(prev => prev.map(m => m.id === optimistic.id ? { ...optimistic, ...res.data } : m));
      }
    } catch { } finally { setSending(false); }
  };

  const handleDeleteMessage = async (msgId: number) => {
    try {
      const res = await api.chat.deleteMessage(msgId);
      if (res.success) {
        if (selectedUser) setDmMessages(prev => prev.filter(m => m.id !== msgId));
        else setGroupMessages(prev => prev.filter(m => m.id !== msgId));
      }
    } catch {}
  };

  const messages = selectedUser ? dmMessages : groupMessages;
  const filteredUsers = users.filter(u => (u.name || '').toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groups.filter(g => (g.groupName || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* Sidebar */}
        <aside className={cn('shrink-0 border-r border-gray-100 flex flex-col bg-white', 'w-full md:w-72', mobileView === 'chat' ? 'hidden md:flex' : 'flex')}>
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button onClick={() => setTab('dm')} className={cn('flex-1 py-3 text-xs font-semibold transition-colors', tab === 'dm' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600')}>
              <MessageSquare className="h-3.5 w-3.5 inline mr-1" />Direct
            </button>
            <button onClick={() => setTab('groups')} className={cn('flex-1 py-3 text-xs font-semibold transition-colors', tab === 'groups' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600')}>
              <Users className="h-3.5 w-3.5 inline mr-1" />Groups
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-primary" />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'dm' ? (
              filteredUsers.length === 0 ? (
                <p className="p-4 text-xs text-gray-400">No users found.</p>
              ) : filteredUsers.map(u => (
        <button key={u.id} onClick={() => { setSelectedUser(u); setSelectedGroup(null); setMobileView('chat'); }}
                  className={cn('w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors', selectedUser?.id === u.id ? 'bg-primary/5 border-r-2 border-primary' : '')}>
                  <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(u.name))}>
                    {getInitials(u.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                  </div>
                </button>
              ))
            ) : (
              <>
                {isAdmin && (
                  <div className="px-3 py-2 border-b border-gray-100">
                    <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={() => setShowCreateGroup(true)}>
                      <Plus className="h-3.5 w-3.5" /> New Group
                    </Button>
                  </div>
                )}
                {filteredGroups.length === 0 ? (
                  <p className="p-4 text-xs text-gray-400">No groups yet.</p>
                ) : filteredGroups.map(g => (
                  <button key={g.id} onClick={() => { setSelectedGroup(g); setSelectedUser(null); setMobileView('chat'); }}
                    className={cn('w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors', selectedGroup?.id === g.id ? 'bg-primary/5 border-r-2 border-primary' : '')}>
                    <div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{g.groupName}</p>
                      <p className="text-xs text-gray-400">{g.memberCount ?? 0} members</p>
                    </div>
                    {(g.unreadCount ?? 0) > 0 && (
                      <Badge className="ml-auto bg-primary text-white text-[10px] h-5 min-w-[20px] rounded-full">{g.unreadCount}</Badge>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* Chat area */}
        <div className={cn('flex-1 flex flex-col min-w-0', mobileView === 'list' ? 'hidden md:flex' : 'flex')}>
          {!selectedUser && !selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select a conversation to start chatting</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-white">
                {/* Back button — mobile only */}
                <button onClick={() => setMobileView('list')} className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                {selectedUser ? (
                  <>
                    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold', avatarColor(selectedUser.name))}>
                      {getInitials(selectedUser.name)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{selectedUser.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{selectedUser.role}</p>
                    </div>
                  </>
                ) : selectedGroup ? (
                  <>
                    <div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{selectedGroup.groupName}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {selectedGroup.members && selectedGroup.members.length > 0 ? (
                          <>
                            <div className="flex -space-x-1">
                              {selectedGroup.members.slice(0, 5).map((m, i) => {
                                const u = users.find(u => u.id === m.userId);
                                const name = u?.name || m.name || '?';
                                return (
                                  <div key={i} title={name}
                                    onClick={() => { if (u) { setSelectedUser(u); setSelectedGroup(null); setTab('dm'); } }}
                                    className={cn('h-5 w-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold cursor-pointer hover:scale-110 transition-transform', avatarColor(name))}>
                                    {getInitials(name)}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-400 flex flex-wrap gap-x-1">
                              {selectedGroup.members.slice(0, 5).map((m, i) => {
                                const u = users.find(u => u.id === m.userId);
                                const name = u?.name || m.name || '?';
                                return (
                                  <span key={i}
                                    onClick={() => { if (u) { setSelectedUser(u); setSelectedGroup(null); setTab('dm'); } }}
                                    className="cursor-pointer hover:text-primary hover:underline transition-colors">
                                    {name}{i < Math.min(selectedGroup.members!.length, 5) - 1 ? ',' : ''}
                                  </span>
                                );
                              })}
                              {(selectedGroup.memberCount ?? selectedGroup.members.length) > 5 && (
                                <span className="text-primary cursor-pointer hover:underline font-medium" onClick={() => setShowMembers(true)}>
                                  +{(selectedGroup.memberCount ?? selectedGroup.members.length) - 5} more
                                </span>
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">{selectedGroup.memberCount ?? 0} members</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50/40">
                {loading ? (
                  <p className="text-center text-xs text-gray-400 py-8">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-8">No messages yet. Say hello!</p>
                ) : messages.map((msg, i) => {
                  const isOwn = msg.senderId === user?.id;
                  const canDelete = isOwn || isAdmin;
                  return (
                    <div key={msg.id || i} className={cn('flex items-end gap-2 group', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                      {!isOwn && (
                        <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', avatarColor(msg.senderName || ''))}>
                          {getInitials(msg.senderName || '?')}
                        </div>
                      )}
                      <div className={cn('max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm relative', isOwn ? 'bg-primary text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm')}>
                        {!isOwn && msg.senderName && (
                          <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.senderName}</p>
                        )}
                        {msg.type === 'image' && msg.payload ? (() => {
                          try {
                            const p = JSON.parse(msg.payload);
                            return (
                              <img
                                src={p.dataUrl} alt={p.fileName}
                                className="max-w-[220px] max-h-[200px] rounded-lg object-cover mb-1 cursor-pointer hover:opacity-90"
                                onClick={() => setLightbox({ src: p.dataUrl, name: p.fileName })}
                              />
                            );
                          } catch { return null; }
                        })() : msg.type === 'file' && msg.payload ? (() => {
                          try {
                            const p = JSON.parse(msg.payload);
                            return (
                              <a href={p.dataUrl} download={p.fileName} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-xs font-medium', isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-slate-100 hover:bg-slate-200')}>
                                <Paperclip className="h-4 w-4 shrink-0" />
                                <span className="truncate max-w-[160px]">{p.fileName}</span>
                              </a>
                            );
                          } catch { return null; }
                        })() : null}
                        {msg.message && msg.type !== 'image' && <p className="leading-relaxed">{msg.message}</p>}
                        {msg.type === 'image' && msg.message && msg.payload && (() => { try { const p = JSON.parse(msg.payload); return p.fileName !== msg.message ? <p className="leading-relaxed text-xs mt-0.5">{msg.message}</p> : null; } catch { return null; } })()}
                        <p className={cn('text-[10px] mt-1', isOwn ? 'text-white/70 text-right' : 'text-gray-400')}>{timeLabel(msg.createdAt)}</p>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-full hover:bg-red-100 text-red-400 hover:text-red-600 shrink-0"
                          title="Delete message"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-100 bg-white">
                {attachPreview && (
                  <div className="mb-2 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                    {attachPreview.fileType.startsWith('image/') ? (
                      <img src={attachPreview.dataUrl} alt={attachPreview.fileName} className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <Paperclip className="h-5 w-5 text-slate-500 shrink-0" />
                    )}
                    <span className="text-xs text-slate-600 truncate flex-1">{attachPreview.fileName}</span>
                    <button onClick={() => setAttachPreview(null)} className="text-slate-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
                  <button onClick={() => fileInputRef.current?.click()} className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-primary hover:border-primary transition-colors shrink-0">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <Input
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={canChat ? "Type a message…" : "You don't have permission to send messages"}
                    className="flex-1 text-sm"
                    disabled={!canChat}
                  />
                  <Button onClick={handleSend} disabled={(!text.trim() && !attachPreview) || sending || !canChat} size="sm" className="shrink-0 bg-primary">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[500] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300">
              <X className="h-6 w-6" />
            </button>
            <img src={lightbox.src} alt={lightbox.name} className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            <a
              href={lightbox.src} download={lightbox.name}
              className="mt-3 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-4 rounded-lg transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <Paperclip className="h-4 w-4" /> Download {lightbox.name}
            </a>
          </div>
        </div>
      )}

      {/* Members Dialog */}
      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedGroup?.groupName} — Members ({selectedGroup?.memberCount ?? selectedGroup?.members?.length ?? 0})</DialogTitle>
          </DialogHeader>
          <div className="divide-y max-h-80 overflow-y-auto">
            {selectedGroup?.members?.map((m, i) => {
              const u = users.find(u => u.id === m.userId);
              const name = u?.name || m.name || '?';
              return (
                <button key={i} className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-slate-50 rounded-lg transition-colors text-left"
                  onClick={() => { if (u) { setSelectedUser(u); setSelectedGroup(null); setTab('dm'); setShowMembers(false); } }}>
                  <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(name))}>
                    {getInitials(name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{name}</p>
                    <p className="text-xs text-gray-400 capitalize">{u?.role ?? ''}</p>
                  </div>
                  <span className="ml-auto text-xs text-primary opacity-0 group-hover:opacity-100">Message →</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Group Name *</Label>
              <Input placeholder="e.g. Support Team" value={groupName} onChange={e => setGroupName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Add Members *</Label>
              <div className="relative mb-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-primary"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {users.filter(u => (u.name || '').toLowerCase().includes(memberSearch.toLowerCase())).map(u => (
                  <button key={u.id} type="button"
                    onClick={() => setSelectedMembers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                    className={cn('w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors', selectedMembers.includes(u.id) ? 'bg-primary/5' : '')}>
                    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(u.name))}>
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                    </div>
                    {selectedMembers.includes(u.id) && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
              {selectedMembers.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedMembers.length} member(s) selected</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)}>Cancel</Button>
            <Button disabled={!groupName.trim() || selectedMembers.length === 0 || creatingGroup} onClick={handleCreateGroup}>
              {creatingGroup ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default GroupChat;
