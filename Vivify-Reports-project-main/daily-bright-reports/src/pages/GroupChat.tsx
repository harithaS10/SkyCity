import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useChat, ChatMsg, TaskStatusUpdate } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Users, MessageSquare, Search, Plus, X, Check, Paperclip, Sparkles } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import AiChat from './AiChat';

function getInitials(name: string) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500'];
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
interface Group { id: number; groupName: string; memberCount?: number; unreadCount?: number; members?: { userId: number; name?: string }[]; }

const GroupChat: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canChat = user?.role === 'staff' ? hasPermission('chat', 'create') : true;
  const chat = useChat(true);

  const [tab, setTab] = useState<'ai' | 'dm' | 'groups'>('ai');
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
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
  const [attachPreview, setAttachPreview] = useState<{ dataUrl: string; fileName: string; fileType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = ['admin', 'super_admin', 'sub_admin', 'property_manager'].includes(user?.role ?? '');
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
    } catch { } finally { setCreatingGroup(false); }
  };

  // Load users & groups
  useEffect(() => {
    api.chat.getUsers().then(res => {
      if (res.success && res.data) setUsers(res.data.map((u: any) => ({ ...u, name: u.fullName || u.username })));
    }).catch(() => { });
    api.groups.getMyGroups().then(res => {
      if (res.success && res.data) setGroups(res.data);
    }).catch(() => { });
  }, []);

  // Load DM history
  useEffect(() => {
    if (!selectedUser) return;
    setLoading(true);
    setDmMessages([]);
    api.chat.getHistory(selectedUser.id).then(res => {
      if (res.success && res.data) setDmMessages(res.data as ChatMsg[]);
    }).catch(() => { }).finally(() => setLoading(false));
    api.chat.markRead(selectedUser.id).catch(() => { });
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
    }).catch(() => { });
    api.groups.getMessages(selectedGroup.id).then(res => {
      if (res.success && res.data) setGroupMessages(res.data as ChatMsg[]);
    }).catch(() => { }).finally(() => setLoading(false));
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
    } catch { }
  };

  const messages = selectedUser ? dmMessages : groupMessages;
  const filteredUsers = users.filter(u => (u.name || '').toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groups.filter(g => (g.groupName || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden lg:flex flex-col h-[calc(100vh-5rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm animate-in fade-in duration-500">
          <div className="flex border-b border-gray-100 shrink-0">
            <button onClick={() => setTab('ai')} className={cn('flex-1 py-3 text-xs font-semibold transition-colors', tab === 'ai' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-400 hover:text-gray-600')}>
              <Sparkles className="h-3.5 w-3.5 inline mr-1" />AI Bot
            </button>
            <button onClick={() => { setTab('dm'); setMobileView('list'); }} className={cn('flex-1 py-3 text-xs font-semibold transition-colors', tab === 'dm' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600')}>
              <MessageSquare className="h-3.5 w-3.5 inline mr-1" />Self
            </button>
            <button onClick={() => { setTab('groups'); setMobileView('list'); }} className={cn('flex-1 py-3 text-xs font-semibold transition-colors', tab === 'groups' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600')}>
              <Users className="h-3.5 w-3.5 inline mr-1" />Group
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <aside className={cn('shrink-0 border-r border-gray-100 flex flex-col bg-white w-72', tab === 'ai' ? '!hidden' : '')}>
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {tab === 'dm' ? (
                  filteredUsers.length === 0 ? <p className="p-4 text-xs text-gray-400">No users found.</p> : filteredUsers.map(u => (
                    <button key={u.id} onClick={() => { setSelectedUser(u); setSelectedGroup(null); }} className={cn('w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors', selectedUser?.id === u.id ? 'bg-primary/5 border-r-2 border-primary' : '')}>
                      <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(u.name))}>{getInitials(u.name)}</div>
                      <div className="min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{u.name}</p><p className="text-xs text-gray-400 capitalize">{u.role}</p></div>
                    </button>
                  ))
                ) : (
                  <>
                    {isAdmin && (
                      <div className="px-3 py-2 border-b border-gray-100">
                        <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={() => setShowCreateGroup(true)}><Plus className="h-3.5 w-3.5" /> New Group</Button>
                      </div>
                    )}
                    {filteredGroups.length === 0 ? <p className="p-4 text-xs text-gray-400">No groups yet.</p> : filteredGroups.map(g => (
                      <button key={g.id} onClick={() => { setSelectedGroup(g); setSelectedUser(null); }} className={cn('w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors', selectedGroup?.id === g.id ? 'bg-primary/5 border-r-2 border-primary' : '')}>
                        <div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center shrink-0"><Users className="h-4 w-4 text-white" /></div>
                        <div className="min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{g.groupName}</p><p className="text-xs text-gray-400">{g.memberCount ?? 0} members</p></div>
                        {(g.unreadCount ?? 0) > 0 && <Badge className="ml-auto bg-primary text-white text-[10px] h-5 min-w-[20px] rounded-full">{g.unreadCount}</Badge>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
              {tab === 'ai' ? <AiChat /> : !selectedUser && !selectedGroup ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2"><MessageSquare className="h-10 w-10 opacity-30" /><p className="text-sm">Select a conversation to start chatting</p></div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-white">
                    {selectedUser ? (
                      <><div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold', avatarColor(selectedUser.name))}>{getInitials(selectedUser.name)}</div><div><p className="text-sm font-semibold text-gray-800">{selectedUser.name}</p><p className="text-xs text-gray-400 capitalize">{selectedUser.role}</p></div></>
                    ) : (
                      <><div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center shrink-0"><Users className="h-4 w-4 text-white" /></div><div><p className="text-sm font-semibold text-gray-800">{selectedGroup?.groupName}</p><p className="text-xs text-gray-400">{selectedGroup?.memberCount ?? 0} members</p></div></>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50/40">
                    {loading ? <p className="text-center text-xs text-gray-400 py-8">Loading...</p> : messages.map((msg, i) => (
                      <div key={msg.id || i} className={cn('flex items-end gap-2 group', msg.senderId === user?.id ? 'flex-row-reverse' : 'flex-row')}>
                        {msg.senderId !== user?.id && <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', avatarColor(msg.senderName || ''))}>{getInitials(msg.senderName || '?')}</div>}
                        <div className={cn('max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm relative', msg.senderId === user?.id ? 'bg-primary text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm')}>
                          {msg.senderId !== user?.id && msg.senderName && <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.senderName}</p>}
                          {msg.type === 'image' && msg.payload ? <img src={JSON.parse(msg.payload).dataUrl} className="w-full max-w-[220px] rounded-lg mb-1" /> : msg.message && <p className="leading-relaxed">{msg.message}</p>}
                          <p className={cn('text-[10px] mt-1', msg.senderId === user?.id ? 'text-white/70 text-right' : 'text-gray-400')}>{timeLabel(msg.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 bg-white flex gap-2">
                    <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Type a message..." className="flex-1 text-sm" />
                    <Button onClick={handleSend} size="sm" className="bg-primary hover:bg-primary/90"><Send className="h-4 w-4 text-white" /></Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="flex lg:hidden flex-col min-h-screen -mx-4 -mt-4 bg-slate-50 animate-in fade-in duration-300">
          {mobileView === 'list' ? (
            <>
              {/* Premium Header */}
              <div className="bg-primary/95 pt-10 pb-16 px-6 rounded-b-[2.5rem] shadow-lg text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />

                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-black tracking-tight">Chat</h1>
                    <p className="text-[10px] text-white/70 font-black tracking-[0.2em] uppercase mt-1">Connect · Collaborate</p>
                  </div>
                  {isAdmin && tab === 'groups' && (
                    <Button
                      onClick={() => setShowCreateGroup(true)}
                      className="bg-white/10 hover:bg-white/20 text-white rounded-2xl h-11 w-11 p-0 flex items-center justify-center shrink-0 active:scale-90 transition-all border border-white/10 backdrop-blur-md shadow-xl"
                    >
                      <Plus className="h-6 w-6 text-white" strokeWidth={3} />
                    </Button>
                  )}
                </div>

                {/* Mobile Tab Switcher */}
                <div className="mt-6 flex p-1.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                  <button onClick={() => setTab('ai')} className={cn('flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2', tab === 'ai' ? 'bg-white text-primary shadow-lg' : 'text-white/70')}>
                    <Sparkles className="h-3.5 w-3.5" /> AI Bot
                  </button>
                  <button onClick={() => { setTab('dm'); setMobileView('list'); }} className={cn('flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2', tab === 'dm' ? 'bg-white text-primary shadow-lg' : 'text-white/70')}>
                    <MessageSquare className="h-3.5 w-3.5" /> Self
                  </button>
                  <button onClick={() => { setTab('groups'); setMobileView('list'); }} className={cn('flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2', tab === 'groups' ? 'bg-white text-primary shadow-lg' : 'text-white/70')}>
                    <Users className="h-3.5 w-3.5" /> Group
                  </button>
                </div>
              </div>

              {/* Floating Search */}
              <div className="px-5 -mt-7 relative z-20">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search contacts or groups..."
                    className="h-14 pl-12 pr-4 rounded-2xl bg-white border-none shadow-xl ring-1 ring-black/5 font-bold text-sm"
                  />
                </div>
              </div>

              {/* List Content */}
              <div className="px-5 mt-6 space-y-3 pb-24 overflow-y-auto">
                {tab === 'ai' ? (
                <div className="bg-white rounded-[2.5rem] h-[80vh] overflow-hidden shadow-xl ring-1 ring-black/5 border-none">
                  <AiChat />
                </div>
              ) : (tab === 'dm' ? filteredUsers : filteredGroups).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <MessageSquare className="h-12 w-12 opacity-10" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">No conversations found</p>
                  </div>
                ) : (tab === 'dm' ? filteredUsers : filteredGroups).map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (tab === 'dm') { setSelectedUser(item); setSelectedGroup(null); }
                      else { setSelectedGroup(item); setSelectedUser(null); }
                      setMobileView('chat');
                    }}
                    className="bg-white rounded-[1.8rem] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] ring-1 ring-black/5 active:scale-[0.98] transition-all flex items-center gap-4 cursor-pointer"
                  >
                    <div className={cn(
                      'h-14 w-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-lg',
                      tab === 'dm' ? avatarColor(item.name) : 'bg-indigo-500'
                    )}>
                      {tab === 'dm' ? getInitials(item.name) : <Users className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <h4 className="text-sm font-black text-slate-800 truncate">{tab === 'dm' ? item.name : item.groupName}</h4>
                        {tab === 'dm' && <span className="text-[8px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-full">{item.role}</span>}
                      </div>
                      <p className="text-xs text-slate-400 font-medium truncate">
                        {tab === 'dm' ? 'Start a private conversation' : `${item.memberCount ?? 0} members · Active`}
                      </p>
                    </div>
                    {(item.unreadCount ?? 0) > 0 && (
                      <Badge className="bg-primary text-white text-[10px] font-black h-6 min-w-[24px] rounded-full flex items-center justify-center border-2 border-white shadow-md">
                        {item.unreadCount}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col h-screen overflow-hidden animate-in slide-in-from-right-10 duration-300">
              {/* Mobile Chat Header */}
              <div className="bg-white px-4 py-4 border-b flex items-center gap-3 shadow-sm relative z-30 pt-10">
                <button
                  onClick={() => setMobileView('list')}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 active:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                {selectedUser ? (
                  <>
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md', avatarColor(selectedUser.name))}>
                      {getInitials(selectedUser.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-800 truncate">{selectedUser.name}</h4>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1.5 tracking-widest">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-indigo-100">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-800 truncate">{selectedGroup?.groupName}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {selectedGroup?.memberCount ?? 0} members
                      </p>
                    </div>
                  </>
                )}
                {tab === 'groups' && (
                  <button
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500"
                    onClick={() => setShowMembers(true)}
                  >
                    <Users className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Message Area */}
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 bg-slate-50/50 flex flex-col">
                {loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-30">
                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <MessageSquare className="h-12 w-12 opacity-10" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">Start the conversation</p>
                  </div>
                ) : messages.map((msg, i) => {
                  const isOwn = msg.senderId === user?.id;
                  const showAvatar = !isOwn && (i === 0 || messages[i - 1].senderId !== msg.senderId);
                  return (
                    <div key={msg.id || i} className={cn('flex items-end gap-2.5', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                      {!isOwn && (
                        <div className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0 transition-all',
                          showAvatar ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
                          avatarColor(msg.senderName || '')
                        )}>
                          {getInitials(msg.senderName || '?')}
                        </div>
                      )}
                      <div className={cn('max-w-[80%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
                        {!isOwn && showAvatar && msg.senderName && (
                          <span className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-tighter">
                            {msg.senderName}
                          </span>
                        )}
                        <div className={cn(
                          'px-4 py-3 rounded-2xl text-sm shadow-sm relative',
                          isOwn ? 'bg-primary text-white rounded-br-none shadow-primary/20' : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none font-medium'
                        )}>
                          {msg.type === 'image' && msg.payload ? (
                            <img
                              src={JSON.parse(msg.payload).dataUrl}
                              className="w-full max-w-[240px] rounded-xl mb-1 cursor-pointer"
                              onClick={() => setLightbox({ src: JSON.parse(msg.payload).dataUrl, name: 'Image' })}
                            />
                          ) : (
                            <p className="leading-relaxed">{msg.message}</p>
                          )}
                          <p className={cn('text-[9px] mt-1.5 font-bold', isOwn ? 'text-white/60 text-right' : 'text-slate-300')}>
                            {timeLabel(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-slate-100 relative z-30 pb-10">
                {attachPreview && (
                  <div className="mb-3 flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 animate-in slide-in-from-bottom-2">
                    <img src={attachPreview.dataUrl} className="h-12 w-12 object-cover rounded-xl shadow-sm" />
                    <span className="text-[10px] font-black text-slate-500 truncate flex-1 uppercase tracking-widest">{attachPreview.fileName}</span>
                    <button onClick={() => setAttachPreview(null)} className="h-8 w-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2.5 items-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 active:scale-95 transition-all"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <div className="flex-1 relative">
                    <Input
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Message..."
                      className="h-12 rounded-2xl bg-slate-50 border-none px-4 text-sm font-bold placeholder:text-slate-300"
                      disabled={!canChat}
                    />
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={(!text.trim() && !attachPreview) || sending || !canChat}
                    className="h-12 w-12 rounded-2xl shadow-lg shadow-primary/20 p-0 shrink-0 bg-primary"
                  >
                    <Send className="h-5 w-5 text-white" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightbox && (
          <div
            className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <img src={lightbox.src} className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl" />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Member List Dialog */}
        <Dialog open={showMembers} onOpenChange={setShowMembers}>
          <DialogContent className="max-w-sm rounded-[2.5rem] border-none">
            <DialogHeader>
              <DialogTitle className="font-black text-lg">
                Members ({selectedGroup?.memberCount})
              </DialogTitle>
            </DialogHeader>
            <div className="divide-y max-h-80 overflow-y-auto">
              {selectedGroup?.members?.map((m, i) => {
                const u = users.find(u => u.id === m.userId);
                const name = u?.name || m.name || '?';
                return (
                  <div key={i} className="flex items-center gap-3 py-3 px-1">
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-md', avatarColor(name))}>
                      {getInitials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{u?.role}</p>
                    </div>
                    <button
                      className="h-9 w-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center"
                      onClick={() => {
                        if (u) {
                          setSelectedUser(u);
                          setSelectedGroup(null);
                          setTab('dm');
                          setMobileView('chat');
                          setShowMembers(false);
                        }
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Group Dialog */}
        <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
          <DialogContent className="max-w-md rounded-[2.5rem] border-none">
            <DialogHeader>
              <DialogTitle className="font-black text-xl">Create Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-1.5">
                <Label className="font-black text-[10px] uppercase text-slate-400 ml-1">Name</Label>
                <Input
                  placeholder="e.g. Technical Support"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="h-12 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase text-slate-400 ml-1">Select Members</Label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="h-11 pl-10 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {users
                    .filter(u => (u.name || '').toLowerCase().includes(memberSearch.toLowerCase()))
                    .map(u => (
                      <button
                        key={u.id}
                        onClick={() =>
                          setSelectedMembers(prev =>
                            prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                          )
                        }
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-2xl transition-all',
                          selectedMembers.includes(u.id) ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-slate-50'
                        )}
                      >
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm', avatarColor(u.name))}>
                          {getInitials(u.name)}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-black truncate">{u.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{u.role}</p>
                        </div>
                        {selectedMembers.includes(u.id) && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                </div>
                {selectedMembers.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedMembers.length} member(s) selected</p>
                )}
              </div>
            </div>
            <DialogFooter className="flex-row gap-3">
              <Button
                variant="ghost"
                className="flex-1 rounded-2xl font-black uppercase text-xs tracking-widest"
                onClick={() => setShowCreateGroup(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={!groupName.trim() || selectedMembers.length === 0 || creatingGroup}
                className="flex-1 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20 bg-primary text-white"
                onClick={handleCreateGroup}
              >
                {creatingGroup ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
      </div>
    </DashboardLayout>
  );
};

export default GroupChat;