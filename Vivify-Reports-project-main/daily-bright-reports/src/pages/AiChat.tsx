import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Sparkles, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface BotMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  actions?: string[];
}

const QUICK_COMMANDS = [
  'show my tasks',
  'show all users',
  'show pending tasks',
  'assign task',
  'add user',
  'add work type',
  'add property',
  'summary',
  'help',
];

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

const AiChat: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: `Hello ${user?.fullName?.split(' ')[0] || 'there'}! 👋 I'm your SkyCity AI Assistant.\n\nI can help you with:\n• **Work Orders** — assign, view, manage\n• **Users** — add new users\n• **Work Types** — add work categories\n• **Properties** — add towers/areas\n• **Reports** — view stats and summaries\n\nType or **speak** your request! 🎤`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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
    <div className="flex flex-col h-full">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
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
                      label = action.replace(/^set-due:/i, '📅 ');
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
                          "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
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

      {/* Quick commands */}
      <div className="px-3 py-2 border-t bg-white flex gap-1.5 overflow-x-auto scrollbar-none">
        {QUICK_COMMANDS.map(cmd => (
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
