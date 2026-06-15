'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Eye, EyeOff, Clock, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '@/lib/utils';

// ── Public interface (must stay stable — page.tsx depends on these) ──────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HistoryEntry {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  completeness: number;
  /** Number of user messages — used externally to gate proposal button */
  userMessageCount: number;
  isPanelOpen: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onTogglePanel: () => void;
  onGenerateProposal: () => void;
  isGeneratingProposal: boolean;
  /** When true the textarea is replaced with an email input */
  emailCollectionMode?: boolean;
  /** Called with the submitted email address */
  onEmailSubmit?: (email: string) => void;
  /** Shows loading state on the email submit button */
  isSubmittingEmail?: boolean;
  /** When true shows inline proposal action buttons after the last bot message */
  showProposalButton?: boolean;
  /** Called when user clicks the Generate Proposal button */
  onConfirmFeatures?: () => void;
  /** Called when user clicks "Add more details" */
  onAddMoreDetails?: () => void;
  /** Previous conversation history entries for the drawer */
  history?: HistoryEntry[];
  /** Called when user selects a history entry */
  onLoadHistory?: (id: string) => void;
  /** Currently active conversation id (highlighted in the list) */
  currentConversationId?: string | null;
  /** Called when user confirms clearing all history (except current session) */
  onClearHistory?: () => void;
  /** Called when user deletes a single history entry */
  onDeleteHistory?: (id: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

function completenessColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-blue-400';
}

// ── Markdown renderer for bot messages ───────────────────────────────────────

const mdComponents: React.ComponentProps<typeof Markdown>['components'] = {
  p:      ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em:     ({ children }) => <em className="italic text-slate-400">{children}</em>,
  ul:     ({ children }) => <ul className="list-disc ml-4 mb-1.5 space-y-0.5">{children}</ul>,
  ol:     ({ children }) => <ol className="list-decimal ml-4 mb-1.5 space-y-0.5">{children}</ol>,
  li:     ({ children }) => <li className="text-slate-300">{children}</li>,
  code:   ({ children }) => (
    <code className="bg-[#0a0f1a] text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono border border-[#1f2d3d]">
      {children}
    </code>
  ),
  h3: ({ children }) => (
    <h3 className="font-bold text-slate-100 text-sm mb-1 mt-2">{children}</h3>
  ),
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel({
  messages,
  input,
  isLoading,
  completeness,
  isPanelOpen,
  onInputChange,
  onSend,
  onTogglePanel,
  emailCollectionMode = false,
  onEmailSubmit,
  isSubmittingEmail = false,
  showProposalButton = false,
  onConfirmFeatures,
  onAddMoreDetails,
  history,
  onLoadHistory,
  currentConversationId,
  onClearHistory,
  onDeleteHistory,
}: ChatPanelProps) {
  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const emailRef     = useRef<HTMLInputElement>(null);
  const historyRef   = useRef<HTMLDivElement>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [hoveredHistoryId, setHoveredHistoryId] = useState<string | null>(null);

  // Auto-scroll on new message or loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea up to 128px
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 128) + 'px';
  }, [input]);

  // Keep focus on the textarea after a response arrives, unless in email mode
  useEffect(() => {
    if (!isLoading && !emailCollectionMode) {
      textareaRef.current?.focus();
    }
  }, [isLoading, emailCollectionMode]);

  // Close history drawer when clicking outside of it
  useEffect(() => {
    if (!isHistoryOpen) return;
    // Use a timeout so the toggle click that opened the drawer doesn't
    // immediately re-close it via the outside-click handler.
    const timer = setTimeout(() => {
      function handleClickOutside(e: MouseEvent) {
        if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
          setIsHistoryOpen(false);
          setConfirmClearHistory(false);
        }
      }
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => clearTimeout(timer);
  }, [isHistoryOpen]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) onSend();
    }
  }

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] relative">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3.5 border-b border-[#1f2d3d] bg-[#080d14]/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/40">
                <span className="text-base leading-none">👻</span>
              </div>
              {/* Online dot with glow */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#080d14] shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 tracking-tight">DealGhost</h2>
                <span className="text-[10px] font-medium text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/50 uppercase tracking-wide">
                  AI Advisor
                </span>
              </div>
              <p className="text-[10px] mt-0.5 transition-colors duration-300">
                {isLoading
                  ? <span className="text-blue-400">✦ Thinking…</span>
                  : <span className="text-emerald-400/70">Online · Ready to help</span>
                }
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* History toggle */}
            <button
              onClick={() => setIsHistoryOpen((v) => !v)}
              title="Chat history"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border',
                isHistoryOpen
                  ? 'bg-[#111827] border-slate-600/50 text-slate-300'
                  : 'border-[#1f2d3d] text-slate-500 hover:text-slate-200 hover:border-slate-600/60',
              )}
            >
              <Clock size={11} />
              <span>History</span>
            </button>

            {/* Completeness score */}
            {completeness > 0 && (
              <div className={cn('text-xs font-bold tabular-nums', completenessColor(completeness))}>
                {completeness}%
              </div>
            )}

            {/* View Intelligence — demo only */}
            {isDemoMode && (
              <button
                onClick={onTogglePanel}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border',
                  isPanelOpen
                    ? 'bg-blue-950/60 border-blue-800/70 text-blue-300 hover:bg-blue-900/50'
                    : 'bg-blue-600/10 border-blue-700/40 text-blue-400 hover:bg-blue-600/20 hover:border-blue-600/60',
                )}
              >
                {isPanelOpen ? <EyeOff size={11} /> : <Eye size={11} />}
                {isPanelOpen ? 'Hide' : '👁 Intelligence'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── History Drawer ──────────────────────────────────────────────────── */}
      <div
        ref={historyRef}
        className={cn(
          'absolute inset-y-0 left-0 z-20 w-72 bg-[#05080d] border-r border-[#1a2535] flex flex-col shadow-2xl',
          'transition-transform duration-200 ease-in-out',
          isHistoryOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2535] flex-shrink-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Chat History</span>
            {(history?.length ?? 0) > 0 && (
              <button
                onClick={() => setConfirmClearHistory(true)}
                title="Clear history"
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Confirm clear */}
          {confirmClearHistory && (
            <div className="flex-shrink-0 mx-3 mt-3 mb-1 p-3 rounded-lg bg-red-950/20 border border-red-900/40">
              <p className="text-[11px] text-red-300 leading-relaxed mb-2.5">
                Delete all previous chats? The current conversation will be kept.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onClearHistory?.();
                    setConfirmClearHistory(false);
                  }}
                  className="flex-1 py-1 rounded text-[11px] font-medium bg-red-700/60 hover:bg-red-600/70 text-red-100 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmClearHistory(false)}
                  className="flex-1 py-1 rounded text-[11px] font-medium bg-[#0f1724] hover:bg-[#1a2535] text-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {!history?.length ? (
              <div className="flex flex-col items-center justify-center h-36 gap-2 px-6">
                <Clock size={22} className="text-slate-700" />
                <p className="text-[11px] text-slate-600 text-center leading-relaxed">
                  No previous chats yet.<br />Start a conversation to see history here.
                </p>
              </div>
            ) : (
              <div className="py-1">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'relative flex items-stretch border-l-2 transition-colors hover:bg-[#0d1520]',
                      entry.id === currentConversationId
                        ? 'bg-blue-950/20 border-l-blue-600'
                        : 'border-l-transparent',
                    )}
                    onMouseEnter={() => setHoveredHistoryId(entry.id)}
                    onMouseLeave={() => setHoveredHistoryId(null)}
                  >
                    <button
                      onClick={() => {
                        onLoadHistory?.(entry.id);
                        setIsHistoryOpen(false);
                      }}
                      className="flex-1 text-left px-4 py-3 min-w-0"
                    >
                      <div className="text-xs font-medium text-slate-200 truncate leading-snug">{entry.title}</div>
                      {entry.preview && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{entry.preview}</div>
                      )}
                      <div className="text-[10px] text-slate-700 mt-1">{formatRelativeTime(entry.timestamp)}</div>
                    </button>
                    {hoveredHistoryId === entry.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHistory?.(entry.id);
                        }}
                        title="Delete chat"
                        className="flex-shrink-0 flex items-center justify-center w-8 text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex items-end gap-2.5 chat-message-enter',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            {/* Bot avatar */}
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-900/40">
                <span className="text-xs leading-none">👻</span>
              </div>
            )}

            {/* Bubble */}
            <div
              className={cn(
                'max-w-[78%] w-fit rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm shadow-lg shadow-blue-900/30'
                  : 'bg-[#0f1724] border border-[#1e2d40] text-slate-300 rounded-bl-sm shadow-[inset_2px_0_0_rgba(59,130,246,0.22)]',
              )}
            >
              {msg.role === 'assistant' ? (
                <Markdown components={mdComponents}>{msg.content}</Markdown>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>

            {/* User avatar */}
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-[#1a2535] border border-[#2a3d52] flex items-center justify-center flex-shrink-0 text-[11px] text-slate-400 font-bold">
                U
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-end gap-2.5 chat-message-enter">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-900/40">
              <span className="text-xs leading-none">👻</span>
            </div>
            <div className="bg-[#0f1724] border border-[#1e2d40] rounded-2xl rounded-bl-sm px-4 py-3 shadow-[inset_2px_0_0_rgba(59,130,246,0.22)]">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-500 mr-1.5">Thinking</span>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-blue-500"
                    style={{ animationDelay: `${i * 180}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Inline proposal action buttons — appear below last bot message */}
        {showProposalButton && !isLoading && (
          <div className="flex flex-col gap-2 pl-9">
            <button
              onClick={onConfirmFeatures}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white transition-all duration-200 shadow-lg shadow-blue-900/30 hover:scale-[1.01] active:scale-[0.99]"
            >
              ✦ Generate Proposal →
            </button>
            <button
              onClick={onAddMoreDetails}
              className="w-full py-2 rounded-xl text-xs font-medium bg-[#111827] border border-[#1f2d3d] text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all duration-200"
            >
              Add more details
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-[#1f2d3d] bg-[#080d14]/60">
        {emailCollectionMode ? (
          /* Email collection — shown when readyForProposal */
          <div className="space-y-2">
            <p className="text-[11px] text-blue-400 font-medium text-center tracking-wide">
              ✦ Ready to generate your proposal
            </p>
            <div className="flex items-center gap-3 bg-[#0f1724] rounded-xl border border-blue-600/50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)] px-4 py-3 transition-all duration-200">
              <input
                ref={emailRef}
                type="email"
                placeholder="your@email.com"
                aria-label="Email address"
                disabled={isSubmittingEmail}
                className="flex-1 bg-transparent outline-none text-sm text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = emailRef.current?.value.trim();
                    if (val && onEmailSubmit) onEmailSubmit(val);
                  }
                }}
              />
              <button
                onClick={() => {
                  const val = emailRef.current?.value.trim();
                  if (val && onEmailSubmit) onEmailSubmit(val);
                }}
                disabled={isSubmittingEmail}
                aria-label="Submit email"
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white transition-all duration-200 disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-[10px] text-slate-700 text-center">
              We'll send your detailed proposal to this address
            </p>
          </div>
        ) : (
          /* Normal chat input */
          <>
            <div
              className={cn(
                'flex items-end gap-3 bg-[#0f1724] rounded-xl border px-4 py-3 transition-all duration-200',
                canSend
                  ? 'border-blue-600/50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]'
                  : 'border-[#1e2d40] focus-within:border-blue-700/50 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.05)]',
              )}
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me what you want to build…"
                disabled={isLoading}
                className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-200 placeholder:text-slate-600 disabled:opacity-50 leading-relaxed"
                style={{ minHeight: '24px', maxHeight: '128px' }}
              />
              <button
                onClick={onSend}
                disabled={!canSend}
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
                  canSend
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 hover:scale-105 active:scale-95'
                    : 'bg-[#1a2535] text-slate-600 cursor-not-allowed',
                )}
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-[10px] text-slate-700 text-center mt-2">
              Enter to send · Shift+Enter for new line
            </p>
          </>
        )}
      </div>
    </div>
  );
}
