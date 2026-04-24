import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Sparkles, Mic, MicOff, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface BotMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  actions?: string[];
}

// All possible quick commands with required role/permission
const ALL_QUICK_COMMANDS = [
  { cmd: 'show my tasks',     roles: ['staff', 'admin', 'sub_admin', 'property_manager', 'facility_manager', 'resident'] },
  { cmd: 'show pending tasks', roles: ['staff', 'admin', 'sub_admin', 'property_manager', 'facility_manager'] },
  { cmd: 'show all users',    roles: ['admin', 'sub_admin', 'property_manager'] },
  { cmd: 'assign task',       roles: ['admin', 'sub_admin', 'property_manager', 'facility_manager'] },
  { cmd: 'add user',          roles: ['admin', 'sub_admin'] },
  { cmd: 'add work type',     roles: ['admin', 'sub_admin', 'property_manager'] },
  { cmd: 'add property',      roles: ['admin', 'sub_admin'] },
  { cmd: 'summary',           roles: ['admin', 'sub_admin', 'property_manager', 'facility_manager', 'staff'] },
  { cmd: 'help',              roles: ['admin', 'sub_admin', 'property_manager', 'facility_manager', 'staff', 'resident'] },
];

const CHAT_STORAGE_KEY = 'skycity_ai_chat_history';

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
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
    );
    return <p key={i} className={line === '' ? 'h-2' : 'leading-relaxed'}>{rendered}</p>;
  });
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
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

  // Load persisted messages from sessionStorage, fall back to welcome message
  const [messages, setMessages] = useState<BotMessage[]>(() => {
    try {
      const stored = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const msgs = deserializeMessages(stored);
        if (msgs.length > 0) return msgs;
      }
    } catch { /* ignore */ }
    return [WELCOME_MSG(firstName)];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [customDateContext, setCustomDateContext] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, serializeMessages(messages));
    } catch { /* ignore */ }
  }, [messages]);

  // Filter quick commands based on user role/permissions
  const quickCommands = ALL_QUICK_COMMANDS
    .filter(({ roles }) => user?.role && roles.includes(user.role))
    .map(({ cmd }) => cmd);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create a fresh recognition instance each time (avoids stale state issues)
  const createRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    return recognition;
  };

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input not supported. Please use Chrome or Edge browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Always create a fresh instance to avoid "already started" errors
    const recognition = createRecognition();
    if (!recognition) return;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      recognitionRef.current = null;
      // Auto-send after voice input
      setTimeout(() => sendMessage(transcript), 300);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      recognitionRef.current = null;
      const err = event.error;
      if (err === 'no-speech') {
        toast.info('No speech detected. Tap the mic and try again.');
      } else if (err === 'not-allowed' || err === 'permission-denied') {
        toast.error('Microphone access denied. Please allow microphone permission in your browser.');
      } else if (err === 'network') {
        toast.error('Voice requires HTTPS. Please use the live site or type your message.');
      } else if (err === 'audio-capture') {
        toast.error('No microphone found. Please connect a microphone and try again.');
      } else if (err === 'aborted') {
        // User stopped it — no message needed
      } else {
        toast.error('Voice not available. Please type your message instead.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      toast.info('Listening... speak now 🎤');
    } catch (e: any) {
      setIsListening(false);
      recognitionRef.current = null;
      if (e?.message?.includes('not-allowed') || e?.message?.includes('permission')) {
        toast.error('Microphone access denied. Please allow microphone in browser settings.');
      } else {
        toast.error('Could not start voice input. Please type your message.');
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: BotMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
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
        id: `b-err-${Date.now()}`,
        role: 'bot',
        text: 'Sorry, I could not connect to the server. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-sm">SkyCity AI Assistant</p>
          <p className="text-[10px] text-white/70">Text or voice — I understand both!</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-white/80">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-4 space-y-4 bg-slate-50/50">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-2.5 w-full', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold',
              msg.role === 'bot' ? 'bg-gradient-to-br from-violet-500 to-indigo-600' : 'bg-primary'
            )}>
              {msg.role === 'bot' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm',
              msg.role === 'bot'
                ? 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                : 'bg-primary text-primary-foreground rounded-tr-sm'
            )}>
              <div className="space-y-0.5">{renderText(msg.text)}</div>
              {/* Action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100">
                  {msg.actions.map((action, i) => {
                    let label = action;
                    let isDateBtn = false;

                    if (/^assign task for /i.test(action)) {
                      label = action.replace(/^assign task for /i, '');
                    } else if (/^allocate work (.+?) to .+$/i.test(action)) {
                      const m = action.match(/^allocate work (.+?) to .+$/i);
                      label = m ? m[1] : action;
                    } else if (/^confirm:/i.test(action)) {
                      label = '✅ Confirm';
                    } else if (/^cancel$/i.test(action)) {
                      label = '❌ Cancel';
                    } else if (/^set-due:/i.test(action)) {
                      // Extract just the date from "set-due:allocate work X to Y due YYYY-MM-DD"
                      const dateMatch = action.match(/due (\d{4}-\d{2}-\d{2})$/i);
                      if (dateMatch) {
                        try {
                          label = '📅 ' + format(parseISO(dateMatch[1]), 'MMM dd');
                        } catch {
                          label = '📅 ' + dateMatch[1];
                        }
                      } else {
                        label = '📅 Pick date';
                      }
                      isDateBtn = true;
                    } else if (/^role:/i.test(action)) {
                      label = action.replace(/^role:/i, '');
                    } else if (/^priority:/i.test(action)) {
                      label = action.replace(/^priority:/i, '');
                    }

                    const isConfirm = /^confirm:/i.test(action);
                    const isCancel = /^cancel$/i.test(action);

                    return (
                      <button
                        key={i}
                        onClick={() => sendMessage(action)}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium",
                          isConfirm ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100" :
                          isCancel ? "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100" :
                          isDateBtn ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" :
                          "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}

                  {/* Custom date picker — shown when there are set-due actions */}
                  {msg.actions.some(a => /^set-due:/i.test(a)) && (
                    <div className="w-full mt-2 flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <input
                        type="date"
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                        min={format(new Date(), 'yyyy-MM-dd')}
                        onChange={e => {
                          if (!e.target.value) return;
                          // Find the set-due template from the first set-due action
                          const setDueAction = msg.actions!.find(a => /^set-due:/i.test(a));
                          if (!setDueAction) return;
                          // Replace the date in the command with the custom date
                          const cmd = setDueAction.replace(/^set-due:/i, '').replace(/due \d{4}-\d{2}-\d{2}$/i, `due ${e.target.value}`);
                          sendMessage(`set-due:${cmd}`);
                          e.target.value = '';
                        }}
                      />
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
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick commands — filtered by user role */}
      <div className="px-3 py-2 border-t bg-white flex gap-1.5 overflow-x-auto scrollbar-none">
        {quickCommands.map(cmd => (
          <button
            key={cmd}
            onClick={() => sendMessage(cmd)}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors whitespace-nowrap"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t bg-white flex gap-2">
        {/* Voice button */}
        <Button
          size="icon"
          variant={isListening ? "default" : "outline"}
          className={cn(
            "rounded-full shrink-0 transition-all",
            isListening ? "bg-rose-500 hover:bg-rose-600 border-rose-500 animate-pulse" : "border-slate-200"
          )}
          onClick={toggleVoice}
          title={isListening ? "Stop listening" : "Start voice input"}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder={isListening ? "Listening... 🎤" : "Ask me anything..."}
          className="flex-1 rounded-full border-slate-200 bg-slate-50 focus:bg-white"
          disabled={isLoading || isListening}
        />
        <Button
          size="icon"
          className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shrink-0"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default AiChat;
