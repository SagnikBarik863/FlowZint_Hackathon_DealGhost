# DealGhost Chat UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing DealGhost chat UI with a premium full-screen interface featuring animated message entry, markdown rendering for bot responses, a polished typing indicator, a refined input bar, and a fix to restore the welcome message on "New session."

**Architecture:** Three focused changes — animation keyframes go into the existing `globals.css`, the `ChatPanel` component is fully rewritten in-place (same props interface, no parent changes needed), and `chat/page.tsx` gets a two-line fix for the "New session" reset plus a minor nav polish. No new files required.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, `react-markdown` ^10.1.0 (already installed), `lucide-react`, TypeScript.

---

## File Map

| File | Change |
|---|---|
| `frontend/app/globals.css` | Add `@keyframes chatMessageEnter` (fade-up) and `@keyframes typingPulse` (dot bounce) |
| `frontend/components/chat-panel.tsx` | Full rewrite — same props, premium visuals |
| `frontend/app/chat/page.tsx` | Fix "New session" to restore welcome message; polish top nav |

---

## Task 1: Add chat animation keyframes to globals.css

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Open globals.css and append the animation keyframes at the bottom**

The file currently ends after the `body` rule. Append exactly this block:

```css
/* ── Chat UI animations ──────────────────────────────────────────────────── */

/* Message fade-up on entry */
@keyframes chatMessageEnter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-message-enter {
  animation: chatMessageEnter 0.22s ease forwards;
}

/* Typing indicator dots */
@keyframes typingPulse {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  30% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

.typing-dot {
  animation: typingPulse 1.3s ease infinite;
}
```

- [ ] **Step 2: Verify the dev server accepts the change**

The Next.js dev server should hot-reload without errors. Check the terminal — no CSS parse errors expected. If you see `Unknown at rule @keyframes`, your Tailwind version is misreading it — that would be a Tailwind v4 issue. In that case wrap in `@layer base { ... }`.

---

## Task 2: Rewrite chat-panel.tsx

**Files:**
- Modify: `frontend/components/chat-panel.tsx` (full rewrite, same exported interface)

The props interface **must not change** — `chat/page.tsx` passes all props by name and will break if any prop is removed or renamed.

- [ ] **Step 1: Replace the entire file with the new implementation**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { Send, Eye, EyeOff } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '@/lib/utils';

// ── Public interface (must stay stable — page.tsx depends on these) ──────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
}: ChatPanelProps) {
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) onSend();
    }
  }

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">

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
                'max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
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

        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-[#1f2d3d] bg-[#080d14]/60">
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
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the dev server compiles without errors**

Check the terminal running `npm run dev:frontend`. Expected: no TypeScript errors. Common issues:
- `react-markdown` import — if it fails, try `import Markdown from 'react-markdown'` (already used above)
- `Markdown` components type — the `React.ComponentProps<typeof Markdown>['components']` type requires `react-markdown` to be installed. Verify: `ls frontend/node_modules/react-markdown` should exist.

- [ ] **Step 3: Open http://localhost:3000/chat and visually verify**

Check:
- Welcome message appears immediately (already initialised in page.tsx state)
- Messages fade up smoothly as they appear
- Bot messages render markdown bold/lists correctly
- Typing indicator shows "Thinking" + three bouncing blue dots
- Input border glows blue when text is typed
- Send button turns blue and is clickable only when input has text
- Header shows online dot with green glow

---

## Task 3: Fix "New session" and polish top nav in chat/page.tsx

**Files:**
- Modify: `frontend/app/chat/page.tsx`

- [ ] **Step 1: Define the welcome message as a constant at the top of the file**

Add this constant immediately after the imports, before `export default function Home()`:

```tsx
const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hey! 👋 I'm DealGhost, your AI project advisor at Team CheatGPT.\n\nI'm here to understand exactly what you want to build and put together a real, detailed proposal for you — no generic quotes, no vague estimates.\n\nSo, what are you looking to build? Tell me about your idea! 🚀",
};
```

- [ ] **Step 2: Update the messages useState to use the constant**

Find:
```tsx
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hey! 👋 I'm DealGhost, your AI project advisor at Team CheatGPT.\n\nI'm here to understand exactly what you want to build and put together a real, detailed proposal for you — no generic quotes, no vague estimates.\n\nSo, what are you looking to build? Tell me about your idea! 🚀",
    },
  ]);
```

Replace with:
```tsx
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
```

- [ ] **Step 3: Fix "New session" to restore welcome message**

Find the "New session" button's onClick handler:
```tsx
              onClick={() => {
                setMessages([]);
                setConversationId(null);
                setProjectState(null);
                setProposal(null);
                setInput('');
                setIsPanelOpen(false);
                setUserMessageCount(0);
              }}
```

Replace `setMessages([])` with `setMessages([WELCOME_MESSAGE])`:
```tsx
              onClick={() => {
                setMessages([WELCOME_MESSAGE]);
                setConversationId(null);
                setProjectState(null);
                setProposal(null);
                setInput('');
                setIsPanelOpen(false);
                setUserMessageCount(0);
              }}
```

- [ ] **Step 4: Polish the top nav**

Find the top nav section:
```tsx
      <nav className="h-12 bg-[#0d1117] border-b border-[#1f2d3d] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">👻</span>
          <span className="text-sm font-bold text-slate-100 tracking-tight">DealGhost</span>
          <span className="hidden sm:block text-[10px] font-medium text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-900">
            AI Pre-Sales Intelligence
          </span>
        </div>
        <div className="flex items-center gap-3">
          {projectState && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Pipeline active
            </div>
          )}
          {conversationId && (
            <button
              onClick={() => { ... }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              New session
            </button>
          )}
        </div>
      </nav>
```

Replace with:
```tsx
      <nav className="h-12 bg-[#080d14]/90 backdrop-blur-sm border-b border-[#1f2d3d] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Home
          </a>
          <span className="text-[#1f2d3d]">|</span>
          <span className="text-sm font-bold text-slate-100 tracking-tight">Team CheatGPT</span>
          <span className="hidden sm:block text-[10px] font-medium text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-900">
            Powered by DealGhost
          </span>
        </div>
        <div className="flex items-center gap-3">
          {projectState && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Pipeline active
            </div>
          )}
          {conversationId && (
            <button
              onClick={() => {
                setMessages([WELCOME_MESSAGE]);
                setConversationId(null);
                setProjectState(null);
                setProposal(null);
                setInput('');
                setIsPanelOpen(false);
                setUserMessageCount(0);
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors border border-[#1f2d3d] hover:border-slate-600 px-2.5 py-1 rounded-md"
            >
              ↺ New session
            </button>
          )}
        </div>
      </nav>
```

- [ ] **Step 5: Verify at http://localhost:3000/chat**

Check:
- Top nav shows "← Home" link on the left
- "Powered by DealGhost" badge visible
- Clicking "↺ New session" shows the welcome message again (not a blank chat)
- "Pipeline active" still appears when a conversation is running

---

## Self-Review

### 1. Spec coverage
| Requirement | Task |
|---|---|
| Markdown rendering for bot messages | Task 2 — `Markdown` component with `mdComponents` |
| Fade-in animation per message | Task 1 (`chatMessageEnter`) + Task 2 (`chat-message-enter` class) |
| Typing indicator with "Thinking" + dots | Task 2 — typing indicator block |
| Polished input bar with focus glow | Task 2 — input area with `canSend` border logic |
| Welcome message on load | Already in state; Task 3 ensures it's restored on reset |
| "New session" restores welcome message | Task 3 Step 3 |
| Top nav polish + back to home | Task 3 Step 4 |
| Same props interface (no parent changes) | Task 2 — interface unchanged |

### 2. Placeholder scan
No TBDs. All code blocks are complete and self-contained.

### 3. Type consistency
- `ChatMessage` exported from `chat-panel.tsx` — same shape as before (`role`, `content`)
- `WELCOME_MESSAGE` typed as `ChatMessage` — matches state type
- `mdComponents` typed via `React.ComponentProps<typeof Markdown>['components']` — avoids loose `any`
- Props interface: all 9 props preserved from original

All consistent. ✓
