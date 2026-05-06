import React, { useState, useRef, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Sparkles, Mic, MicOff, Calendar, Search, Trash2, X, History, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'sonner';

interface BotMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  actions?: string[];
}

const ALL_QUICK_COMMANDS = [
  { cmd: 'show my tasks',      roles: ['staff', 'admin', 'sub_admin', 'property_manager', 'facility_manager', 'resident'] },
  { cmd: 'show pending tasks', roles: ['staff', 'admin', 'sub_admin', 'property_manager', 'facility_manager'] },
  { cmd: 'show all users',     roles: ['admin', 'sub_admin', 'property_manager'] },
  { cmd: 'assign task',        roles: ['admin', 'sub_admin', 'property_manager', 'facility_manager'] },
  { cmd: 'add user',           roles: ['admin', 'sub_admin'] },
  { cmd: 'add work type',      roles: ['admin', 'sub_admin', 'property_manager'] },
  { cmd: 'add property',       roles: ['admin', 'sub_admin'] },
  { cmd: 'summary',            roles: ['admin', 'sub_admin', 'property_manager', 'facility_manager', 'staff'] },
  { cmd: 'help',               roles: ['admin', 'sub_admin', 'property_manager', 'facility_manager', 'staff', 'resident'] },
];

// Max messages to keep in history
const MAX_HISTORY = 500;

function storageKey(userId?: number | string) {
  return `skycity_ai_chat_history_${userId || 'guest'}`;
}

function serializeMessages(msgs: BotMessage[]): string {
  return JSON.stringify(msgs.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })));
}

function deserializeMessages(raw: string): BotMessage[] {
  try {
    const parsed = JSON.parse(raw);
    return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch { return []; }
}

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
    );
    return <p key={i} className={line === '' ? 'h-2' : 'leading-relaxed'}>{rendered}</p>;
  });
}

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}

const WELCOME_MSG = (name: string): BotMessage => ({
  id: 'welcome',
  role: 'bot',
  text: `Hello ${name}! 👋 I'm your SkyCity AI Assistant.\n\nI can help you with:\n• **Work Orders** — assign, view, manage\n• **Users** — add new users\n• **Work Types** — add work categories\n• **Properties** — add towers/areas\n• **Reports** — view stats and summaries\n\nType or **speak** your request! 🎤`,
  timestamp: new Date(),
});

const AiChat: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const key = storageKey(user?.id);

  const [messages, setMessages] = useState<BotMessage[]>(() => {
    // Try to load from localStorage with guest key first
    try {
      const stored = localStorage.getItem(storageKey('guest'));
      if (stored) {
        const msgs = deserializeMessages(stored);
        if (msgs.length > 0) return msgs;
      }
    } catch { /* ignore */ }
    return [WELCOME_MSG(firstName)];
  });

  // Re-load messages when user ID becomes available (auth context loads async)
  const loadedUserRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (!user?.id || loadedUserRef.current === user.id) return;
    loadedUserRef.current = user.id;
    const userKey = storageKey(user.id);
    try {
      const stored = localStorage.getItem(userKey);
      if (stored) {
        const msgs = deserializeMessages(stored);
        if (msgs.length > 0) {
          setMessages(msgs);
          return;
        }
      }
      // No user-specific history — check if there's guest history to migrate
      const guestKey = storageKey('guest');
      const guestStored = localStorage.getItem(guestKey);
      if (guestStored) {
        const guestMsgs = deserializeMessages(guestStored);
        if (guestMsgs.length > 1) { // more than just welcome
          setMessages(guestMsgs);
          localStorage.setItem(userKey, guestStored);
          localStorage.removeItem(guestKey);
        }
      }
    } catch { /* ignore */ }
  }, [user?.id]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // History / search panel
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist to localStorage on every change — always use user-specific key
  useEffect(() => {
    try {
      const saveKey = user?.id ? storageKey(user.id) : key;
      const trimmed = messages.slice(-MAX_HISTORY);
      localStorage.setItem(saveKey, serializeMessages(trimmed));
    } catch { /* ignore */ }
  }, [messages, key, user?.id]);

  useEffect(() => {
    if (!showHistory) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showHistory]);

  useEffect(() => {
    if (showHistory) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [showHistory]);

  const quickCommands = ALL_QUICK_COMMANDS
    .filter(({ roles }) => user?.role && roles.includes(user.role))
    .map(({ cmd }) => cmd);

  // ── Search / filter ──────────────────────────────────────────────────────
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.text.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  // Group messages by day for display
  const groupedMessages = useMemo(() => {
    // Main chat always shows ALL messages grouped by day
    const groups: { label: string; date: Date; msgs: BotMessage[] }[] = [];
    messages.forEach(msg => {
      const last = groups[groups.length - 1];
      if (!last || !isSameDay(last.date, msg.timestamp)) {
        groups.push({ label: dayLabel(msg.timestamp), date: msg.timestamp, msgs: [msg] });
      } else {
        last.msgs.push(msg);
      }
    });
    return groups;
  }, [messages]);

  // History panel uses filtered messages (search-aware)
  const historyGroups = useMemo(() => {
    const groups: { label: string; date: Date; msgs: BotMessage[] }[] = [];
    filteredMessages.forEach(msg => {
      const last = groups[groups.length - 1];
      if (!last || !isSameDay(last.date, msg.timestamp)) {
        groups.push({ label: dayLabel(msg.timestamp), date: msg.timestamp, msgs: [msg] });
      } else {
        last.msgs.push(msg);
      }
    });
    return groups;
  }, [filteredMessages]);

  const clearHistory = () => {
    if (!confirm('Clear all chat history? This cannot be undone.')) return;
    const welcome = WELCOME_MSG(firstName);
    setMessages([welcome]);
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    setShowHistory(false);
    toast.success('Chat history cleared');
  };

  // ── Voice ────────────────────────────────────────────────────────────────
  const createRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = 'en-US'; r.maxAlternatives = 1;
    return r;
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error('Voice input not supported. Use Chrome or Edge.'); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = createRecognition();
    if (!recognition) return;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInput(t); setIsListening(false); recognitionRef.current = null;
      setTimeout(() => sendMessage(t), 300);
    };
    recognition.onerror = (e: any) => {
      setIsListening(false); recognitionRef.current = null;
      if (e.error === 'no-speech') toast.info('No speech detected. Try again.');
      else if (e.error === 'not-allowed') toast.error('Microphone access denied.');
      else if (e.error !== 'aborted') toast.error('Voice not available. Please type instead.');
    };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    try { recognition.start(); toast.info('Listening... 🎤'); }
    catch { setIsListening(false); recognitionRef.current = null; toast.error('Could not start voice input.'); }
  };

  // ── Send ─────────────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    if (showHistory) setShowHistory(false);

    const userMsg: BotMessage = { id: `u-${Date.now()}`, role: 'user', text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.aiBot.sendMessage(text.trim());
      const botMsg: BotMessage = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: res.success ? res.data.message : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(res.data?.timestamp || Date.now()),
        actions: res.data?.actions || [],
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `b-err-${Date.now()}`, role: 'bot',
        text: 'Sorry, I could not connect to the server. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Message bubble ───────────────────────────────────────────────────────
  const renderMessage = (msg: BotMessage) => (
    <div key={msg.id} className={cn('flex gap-2.5 w-full', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 text-white">
        {msg.role === 'bot' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm',
        msg.role === 'bot'
          ? 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white rounded-tl-sm'
          : 'bg-primary text-primary-foreground rounded-tr-sm'
      )}>
        <div className="space-y-0.5">{renderText(msg.text)}</div>

        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            {msg.actions.map((action, i) => {
              let label = action;
              let isDateBtn = false;
              if (/^assign task for /i.test(action)) label = action.replace(/^assign task for /i, '');
              else if (/^allocate work (.+?) to .+$/i.test(action)) { const m = action.match(/^allocate work (.+?) to .+$/i); label = m ? m[1] : action; }
              else if (/^confirm:/i.test(action)) label = '✅ Confirm';
              else if (/^cancel$/i.test(action)) label = '❌ Cancel';
              else if (/^set-due:/i.test(action)) {
                const dm = action.match(/due (\d{4}-\d{2}-\d{2})$/i);
                label = dm ? '📅 ' + (() => { try { return format(parseISO(dm[1]), 'MMM dd'); } catch { return dm[1]; } })() : '📅 Pick date';
                isDateBtn = true;
              }
              const isConfirm = /^confirm:/i.test(action);
              const isCancel = /^cancel$/i.test(action);
              return (
                <button key={i} onClick={() => sendMessage(action)}
                  className={cn("text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium",
                    isConfirm ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100" :
                    isCancel  ? "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100" :
                    isDateBtn ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" :
                    "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                  )}>
                  {label}
                </button>
              );
            })}
            {msg.actions.some(a => /^set-due:/i.test(a)) && (
              <div className="w-full mt-2 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input type="date"
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => {
                    if (!e.target.value) return;
                    const base = msg.actions!.find(a => /^set-due:/i.test(a));
                    if (!base) return;
                    const cmd = base.replace(/^set-due:/i, '').replace(/due \d{4}-\d{2}-\d{2}$/i, `due ${e.target.value}`);
                    sendMessage(`set-due:${cmd}`); e.target.value = '';
                  }} />
                <span className="text-[10px] text-slate-400 shrink-0">custom date</span>
              </div>
            )}
          </div>
        )}

        <p className={cn('text-[10px] mt-1.5', msg.role === 'bot' ? 'text-slate-400' : 'text-white/60')}>
          {format(msg.timestamp, 'HH:mm')}
        </p>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-primary text-white shrink-0">
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">SkyCity AI Assistant</p>
          <p className="text-[10px] text-white/70">Text or voice — I understand both!</p>
        </div>
        <div className="flex items-center gap-2">
          {/* History toggle */}
          <button
            onClick={() => setShowHistory(v => !v)}
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
              showHistory ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
            )}
            title="Chat history & search"
          >
            <History className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-white/80">Online</span>
          </div>
        </div>
      </div>

      {/* ── History / Search Panel ── */}
      {showHistory && (
        <div className="flex flex-col border-b bg-white dark:bg-slate-900 shrink-0" style={{ maxHeight: '60%' }}>
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-slate-700">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chat history..."
              className="flex-1 text-sm bg-transparent outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={clearHistory}
              className="ml-1 flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
              title="Clear all history"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 ml-1">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Stats bar */}
          <div className="px-3 py-1.5 flex items-center gap-3 text-[11px] text-slate-400 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <span>{messages.length} messages</span>
            <span>•</span>
            <span>{messages.filter(m => m.role === 'user').length} from you</span>
            {searchQuery && <><span>•</span><span className="text-primary font-medium">{filteredMessages.length} results</span></>}
          </div>

          {/* Scrollable history list */}
          <div className="overflow-y-auto flex-1 p-3 space-y-4" style={{ maxHeight: '300px' }}>
            {historyGroups.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">No messages found</p>
            ) : (
              historyGroups.map(group => (
                <div key={group.label}>
                  {/* Day separator */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2">{group.label}</span>
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
                  </div>
                  <div className="space-y-2">
                    {group.msgs.map(msg => (
                      <div
                        key={msg.id}
                        onClick={() => { setShowHistory(false); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                          msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        )}
                      >
                        <div className={cn(
                          'h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-[10px]',
                          'bg-primary'
                        )}>
                          {msg.role === 'bot' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        </div>
                        <div className={cn('flex-1 min-w-0', msg.role === 'user' ? 'text-right' : 'text-left')}>
                          {/* Highlight search match */}
                          <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                            {searchQuery ? highlightMatch(msg.text, searchQuery) : msg.text.slice(0, 120) + (msg.text.length > 120 ? '…' : '')}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{format(msg.timestamp, 'HH:mm')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Chat Messages ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
        {/* Day-grouped messages */}
        {groupedMessages.map(group => (
          <div key={group.label}>
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2 bg-slate-50/50 dark:bg-slate-950/50">{group.label}</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="space-y-4">
              {group.msgs.map(renderMessage)}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                {[0, 150, 300].map(d => (
                  <div key={d} className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick commands */}
      <div className="px-3 py-2 border-t dark:border-slate-700 bg-white dark:bg-slate-900 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {quickCommands.map(cmd => (
          <button key={cmd} onClick={() => sendMessage(cmd)}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 transition-colors whitespace-nowrap">
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t dark:border-slate-700 bg-white dark:bg-slate-900 flex gap-2 shrink-0">
        <Button size="icon" variant={isListening ? 'default' : 'outline'}
          className={cn('rounded-full shrink-0 transition-all', isListening ? 'bg-rose-500 hover:bg-rose-600 border-rose-500 animate-pulse' : 'border-slate-200 dark:border-slate-700')}
          onClick={toggleVoice} title={isListening ? 'Stop listening' : 'Start voice input'}>
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder={isListening ? 'Listening... 🎤' : 'Ask me anything...'}
          className="flex-1 rounded-full border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700"
          disabled={isLoading || isListening} />
        <Button size="icon" className="rounded-full bg-primary hover:bg-primary/90 shrink-0"
          onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Highlight matching text in search results
function highlightMatch(text: string, query: string): React.ReactNode {
  const preview = text.slice(0, 150) + (text.length > 150 ? '…' : '');
  if (!query) return preview;
  const idx = preview.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return preview;
  return (
    <>
      {preview.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">{preview.slice(idx, idx + query.length)}</mark>
      {preview.slice(idx + query.length)}
    </>
  );
}

export default AiChat;
