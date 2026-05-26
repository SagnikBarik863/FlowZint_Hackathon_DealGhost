'use client';

import { useEffect, useRef } from 'react';
import { Send, Loader2, FileText, Eye, EyeOff } from 'lucide-react';
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
  /** Number of messages the client (user) has sent. Used to prevent premature proposal generation. */
  userMessageCount: number;
  isPanelOpen: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onTogglePanel: () => void;
  onGenerateProposal: () => void;
  isGeneratingProposal: boolean;
}

// Evaluated once at module load — safe for client components
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function ChatPanel({
  messages,
  input,
  isLoading,
  completeness,
  userMessageCount,
  isPanelOpen,
  onInputChange,
  onSend,
  onTogglePanel,
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
    <div className="flex flex-col h-full bg-[#0d1117] border-r border-[#1f2d3d]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1f2d3d] bg-[#0d1117]">
        <div className="flex items-center justify-between">
          {/* Brand identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-900 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-sm">👻</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 tracking-wide">DealGhost</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-[10px] text-emerald-400">Solution Architect · Online</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Generate Proposal button — appears only when the client has given enough information.
                Requires: completeness >= 60 (enough fields filled) AND >= 6 client messages
                (prevents premature proposals from AI-inferred data with minimal real input). */}
            {completeness >= 60 && userMessageCount >= 6 && (
              <button
                onClick={onGenerateProposal}
                disabled={isGeneratingProposal}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed',
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

            {/* Intelligence toggle — only rendered when NEXT_PUBLIC_DEMO_MODE=true */}
            {isDemoMode && (
              <button
                onClick={onTogglePanel}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                  isPanelOpen
                    ? 'bg-blue-950 border-blue-700 text-blue-300 hover:bg-blue-900'
                    : 'bg-gradient-to-r from-blue-900 to-blue-700 border-blue-600 text-blue-200 hover:from-blue-800 hover:to-blue-600',
                )}
              >
                {isPanelOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                {isPanelOpen ? 'Hide Intelligence' : '👁 View Intelligence'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-950/50 border border-blue-900/50 flex items-center justify-center">
              <span className="text-blue-400 text-xl">👻</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Start your discovery session</p>
              <p className="text-xs text-slate-600 mt-1">Tell me what you want to build.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                <span className="text-xs">👻</span>
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-700 text-white rounded-tr-sm'
                  : 'bg-[#111827] border border-[#1f2d3d] text-slate-300 rounded-tl-sm',
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
              <span className="text-xs">👻</span>
            </div>
            <div className="bg-[#111827] border border-[#1f2d3d] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-[#1f2d3d] bg-[#0d1117]">
        <div className="flex items-end gap-2 bg-[#111827] rounded-xl border border-[#1f2d3d] px-3 py-2 focus-within:border-blue-600/60 focus-within:ring-1 focus-within:ring-blue-600/20 transition-all">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project or answer the question…"
            disabled={isLoading}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-200 placeholder:text-slate-600 max-h-32 disabled:opacity-50"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 text-center mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
