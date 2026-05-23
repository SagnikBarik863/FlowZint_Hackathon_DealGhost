'use client';

import { useEffect, useRef } from 'react';
import { Send, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  completeness: number;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onGenerateProposal: () => void;
  isGeneratingProposal: boolean;
}

export function ChatPanel({
  messages,
  input,
  isLoading,
  completeness,
  onInputChange,
  onSend,
  onGenerateProposal,
  isGeneratingProposal,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) onSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-zinc-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 tracking-wide uppercase">
              Discovery Session
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Describe your project — I'll ask the right questions.
            </p>
          </div>
          {completeness >= 60 && (
            <button
              onClick={onGenerateProposal}
              disabled={isGeneratingProposal}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {isGeneratingProposal ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FileText size={12} />
              )}
              {isGeneratingProposal ? 'Generating…' : 'Generate Proposal'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 space-y-3">
            <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center">
              <span className="text-violet-500 text-xl">👻</span>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Start your discovery session</p>
              <p className="text-xs text-zinc-400 mt-1">
                Tell me what you want to build.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                <span className="text-xs">👻</span>
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-zinc-100 text-zinc-800 rounded-tl-sm',
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
              <span className="text-xs">👻</span>
            </div>
            <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-zinc-100">
        <div className="flex items-end gap-2 bg-zinc-50 rounded-xl border border-zinc-200 px-3 py-2 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-100 transition-all">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project or answer the question…"
            disabled={isLoading}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-zinc-800 placeholder:text-zinc-400 max-h-32 disabled:opacity-50"
            style={{ field_sizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-zinc-400 text-center mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
