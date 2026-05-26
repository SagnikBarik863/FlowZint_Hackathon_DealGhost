# DealGhost UI Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install shadcn/ui and react-resizable-panels, enforce Groq JSON mode on all structured AI calls, and refactor the existing light-themed fixed-split workspace into a dark enterprise split-panel UI with an env-gated intelligence panel toggle.

**Architecture:** `app/page.tsx` owns all state and renders a `ResizablePanelGroup`. `ChatPanel` (left panel) contains a "👁 View Intelligence" pill button gated by `NEXT_PUBLIC_DEMO_MODE`. `IntelligencePanel` (right panel) uses shadcn `Tabs` with Overview / Features / Proposal tabs and four decorated `Card` components in Overview. The right panel only mounts when `isPanelOpen = true`; a `key` prop on the group resets sizes on toggle.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript 5, Tailwind v4, shadcn/ui (latest), react-resizable-panels (via shadcn resizable), Groq SDK llama-3.3-70b-versatile, Prisma 7, Supabase PostgreSQL

---

## File map

| Status | Path | Purpose |
|--------|------|---------|
| Create | `components.json` | shadcn config (auto-generated) |
| Create | `components/ui/*.tsx` | shadcn UI components (8 files) |
| Modify | `package.json` | react-resizable-panels added |
| Modify | `app/globals.css` | Dark CSS variables + shadcn theming |
| Modify | `app/layout.tsx` | `dark` class on html, dark body background |
| Modify | `lib/ai/groq.ts` | Add `structured` param for JSON mode |
| Modify | `lib/ai/extraction.ts` | Pass `structured: true` |
| Modify | `lib/ai/scoring.ts` | Pass `structured: true` |
| Modify | `lib/ai/proposal.ts` | Pass `structured: true` |
| Modify | `app/page.tsx` | Toggle state, ResizablePanelGroup, dark nav |
| Modify | `components/chat-panel.tsx` | Toggle button, dark theme, new props |
| Modify | `components/intelligence-panel.tsx` | Tabs + Cards + dark theme |
| Modify | `components/proposal-view.tsx` | Dark theme color updates |
| Modify | `.env.local` | `NEXT_PUBLIC_DEMO_MODE=true` |

---

## Task 1: Install shadcn/ui and resizable panels

**Files:**
- Create: `components.json`
- Create: `components/ui/card.tsx`, `badge.tsx`, `progress.tsx`, `tabs.tsx`, `scroll-area.tsx`, `separator.tsx`, `button.tsx`, `resizable.tsx`
- Modify: `package.json`, `app/globals.css`

- [ ] **Step 1: Run shadcn init**

```bash
cd d:\FlowZint\dealghost
npx shadcn@latest init --yes
```

When prompted interactively:
- Style → **Default**
- Base color → **Zinc**
- CSS variables → **Yes**

Expected: `components.json` created, CSS variables added to `app/globals.css`.

- [ ] **Step 2: Add all required shadcn components**

```bash
npx shadcn@latest add card badge progress tabs scroll-area separator button resizable
```

`resizable` automatically installs `react-resizable-panels` as a peer dependency.

Expected: `components/ui/` directory with the 8 component files above.

- [ ] **Step 3: Verify installation**

```bash
ls components/ui/
```

Expected output contains: `card.tsx  badge.tsx  progress.tsx  tabs.tsx  scroll-area.tsx  separator.tsx  button.tsx  resizable.tsx`

- [ ] **Step 4: Commit**

```bash
git add components/ components.json package.json package-lock.json app/globals.css
git commit -m "chore: install shadcn/ui and react-resizable-panels"
```

---

## Task 2: Enforce Groq JSON mode on structured AI calls

**Files:**
- Modify: `lib/ai/groq.ts`
- Modify: `lib/ai/extraction.ts`
- Modify: `lib/ai/scoring.ts`
- Modify: `lib/ai/proposal.ts`

- [ ] **Step 1: Replace `lib/ai/groq.ts`**

```typescript
import Groq from 'groq-sdk';

const globalForGroq = globalThis as unknown as {
  groq: Groq | undefined;
};

export const groq =
  globalForGroq.groq ?? new Groq({ apiKey: process.env.GROQ_API_KEY });

if (process.env.NODE_ENV !== 'production') {
  globalForGroq.groq = groq;
}

export const MODEL = 'llama-3.3-70b-versatile';

/**
 * Call Groq with a system prompt and user content.
 * @param systemPrompt - The system instruction for the model
 * @param userContent  - The user message / data to process
 * @param structured   - When true, enforces JSON output via response_format.
 *                       Pass true for extraction, scoring, and proposal calls.
 *                       Pass false (default) for plain-text calls (follow-up questions).
 */
export async function callGroq(
  systemPrompt: string,
  userContent: string,
  structured = false,
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    ...(structured ? { response_format: { type: 'json_object' } } : {}),
  });

  return completion.choices[0]?.message?.content ?? '';
}
```

- [ ] **Step 2: Update `lib/ai/extraction.ts` — line 51**

Change only the `callGroq` call (line 51 of the original):

```typescript
  const raw = await callGroq(EXTRACTION_SYSTEM_PROMPT, userPrompt, true);
```

- [ ] **Step 3: Update `lib/ai/scoring.ts` — line 20**

Change only the `callGroq` call (line 20 of the original):

```typescript
  const raw = await callGroq(SCORING_SYSTEM_PROMPT, userPrompt, true);
```

- [ ] **Step 4: Update `lib/ai/proposal.ts` — line 52**

Change only the `callGroq` call (line 52 of the original):

```typescript
  const raw = await callGroq(PROPOSAL_SYSTEM_PROMPT, userPrompt, true);
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/groq.ts lib/ai/extraction.ts lib/ai/scoring.ts lib/ai/proposal.ts
git commit -m "feat: enforce JSON mode on all structured Groq AI calls"
```

---

## Task 3: Dark enterprise theme — globals and layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `app/globals.css` entirely**

This replaces whatever shadcn init wrote. It keeps all shadcn CSS variables but overrides the `.dark` block with the deep-dark enterprise palette from the design spec.

```css
@import "tailwindcss";

/* ── shadcn/ui CSS custom properties ──────────────────────────────────────── */
:root {
  --radius: 0.5rem;
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 221 83% 53%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 221 83% 53%;
}

/* Deep-dark enterprise palette — active because layout.tsx adds class="dark" to <html> */
.dark {
  --background: 222 47% 5%;        /* #0d1117 */
  --foreground: 215 28% 93%;       /* #e2e8f0 */
  --card: 221 39% 11%;             /* #111827 */
  --card-foreground: 215 28% 93%;
  --popover: 221 39% 11%;
  --popover-foreground: 215 28% 93%;
  --primary: 217 91% 60%;          /* #3b82f6 */
  --primary-foreground: 0 0% 98%;
  --secondary: 215 28% 17%;        /* #1f2d3d */
  --secondary-foreground: 215 28% 93%;
  --muted: 215 28% 17%;
  --muted-foreground: 215 14% 42%; /* slate-500 */
  --accent: 215 28% 17%;
  --accent-foreground: 215 28% 93%;
  --destructive: 0 63% 56%;
  --destructive-foreground: 0 0% 98%;
  --border: 215 28% 17%;           /* #1f2d3d */
  --input: 215 28% 17%;
  --ring: 217 91% 60%;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: #0d1117;
  color: #e2e8f0;
  font-family: var(--font-geist-sans, Arial, Helvetica, sans-serif);
}
```

- [ ] **Step 2: Replace `app/layout.tsx`**

Adds `dark` to the html className so shadcn's `.dark` block activates.

```typescript
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DealGhost — AI Pre-Sales Intelligence',
  description:
    'AI-powered pre-sales solution architect that converts client conversations into structured project intelligence and proposal-ready artifacts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="h-full bg-[#0d1117] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: apply dark enterprise theme via CSS variables and dark class"
```

---

## Task 4: Refactor page.tsx — toggle state + ResizablePanelGroup

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx` entirely**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { ChatPanel, ChatMessage } from '@/components/chat-panel';
import { IntelligencePanel } from '@/components/intelligence-panel';
import { ProposalView } from '@/components/proposal-view';
import { ProjectRequirementState } from '@/types/project';
import { ProposalContent } from '@/types/proposal';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [projectState, setProjectState] = useState<ProjectRequirementState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalContent | null>(null);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  // isPanelOpen controls whether the intelligence panel is visible
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Something went wrong. Please try again.' },
        ]);
        return;
      }

      if (!conversationId) setConversationId(data.conversationId);
      setProjectState(data.state);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Network error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId]);

  const generateProposal = useCallback(async () => {
    if (!conversationId || isGeneratingProposal) return;
    setIsGeneratingProposal(true);

    try {
      const res = await fetch('/api/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "I wasn't able to generate the proposal. Let's continue gathering requirements.",
          },
        ]);
        return;
      }

      setProposal(data.proposal);
      // Auto-open the panel so the proposal is immediately visible
      setIsPanelOpen(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Failed to generate proposal. Please try again.' },
      ]);
    } finally {
      setIsGeneratingProposal(false);
    }
  }, [conversationId, isGeneratingProposal]);

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      {/* Top Nav */}
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
              onClick={() => {
                setMessages([]);
                setConversationId(null);
                setProjectState(null);
                setProposal(null);
                setInput('');
                setIsPanelOpen(false);
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              New session
            </button>
          )}
        </div>
      </nav>

      {/*
        ResizablePanelGroup replaces the old hard-coded flex split.
        key={String(isPanelOpen)} forces re-mount on toggle so panel sizes reset cleanly.
      */}
      <ResizablePanelGroup
        key={String(isPanelOpen)}
        direction="horizontal"
        className="flex-1 overflow-hidden"
      >
        <ResizablePanel defaultSize={isPanelOpen ? 60 : 100} minSize={35}>
          <ChatPanel
            messages={messages}
            input={input}
            isLoading={isLoading}
            completeness={projectState?.completenessScore ?? 0}
            isPanelOpen={isPanelOpen}
            onInputChange={setInput}
            onSend={sendMessage}
            onTogglePanel={() => setIsPanelOpen((v) => !v)}
            onGenerateProposal={generateProposal}
            isGeneratingProposal={isGeneratingProposal}
          />
        </ResizablePanel>

        {isPanelOpen && (
          <>
            <ResizableHandle
              withHandle
              className="bg-[#1f2d3d] w-px hover:bg-blue-600 transition-colors"
            />
            <ResizablePanel defaultSize={40} minSize={25}>
              {proposal ? (
                <ProposalView
                  proposal={proposal}
                  projectName={projectState?.projectName}
                  onClose={() => setProposal(null)}
                />
              ) : (
                <IntelligencePanel state={projectState} />
              )}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check — expect errors on ChatPanel props (fixed in Task 5)**

```bash
npx tsc --noEmit
```

Expected: Errors about `isPanelOpen` and `onTogglePanel` not existing on `ChatPanel`. This is expected — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add panel toggle state and ResizablePanelGroup to workspace"
```

---

## Task 5: Update ChatPanel — toggle button + dark theme

**Files:**
- Modify: `components/chat-panel.tsx`

- [ ] **Step 1: Replace `components/chat-panel.tsx` entirely**

```typescript
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
            {/* Generate Proposal button — appears when completeness >= 60 */}
            {completeness >= 60 && (
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (the missing props from Task 4 are now satisfied).

- [ ] **Step 3: Commit**

```bash
git add components/chat-panel.tsx
git commit -m "feat: add intelligence toggle button and dark theme to ChatPanel"
```

---

## Task 6: Refactor IntelligencePanel — tabs + decorated cards + dark theme

**Files:**
- Modify: `components/intelligence-panel.tsx`

- [ ] **Step 1: Replace `components/intelligence-panel.tsx` entirely**

```typescript
'use client';

import { ProjectRequirementState } from '@/types/project';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IntelligencePanelProps {
  state: ProjectRequirementState | null;
}

const complexityConfig: Record<string, { label: string; className: string }> = {
  SIMPLE:     { label: 'Simple',     className: 'bg-emerald-950 text-emerald-400 border-emerald-800' },
  STANDARD:   { label: 'Standard',   className: 'bg-blue-950 text-blue-400 border-blue-800' },
  COMPLEX:    { label: 'Complex',    className: 'bg-amber-950 text-amber-400 border-amber-800' },
  ENTERPRISE: { label: 'Enterprise', className: 'bg-red-950 text-red-400 border-red-800' },
};

const priorityConfig: Record<string, { className: string }> = {
  MUST:   { className: 'bg-red-950 text-red-400 border-red-800' },
  SHOULD: { className: 'bg-amber-950 text-amber-400 border-amber-800' },
  COULD:  { className: 'bg-slate-800 text-slate-400 border-slate-700' },
};

function scoreColor(score: number) {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
      <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1f2d3d] flex items-center justify-center mb-4">
        <span className="text-3xl">🧠</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-400 mb-1">Project Intelligence</h3>
      <p className="text-xs text-slate-600 leading-relaxed">
        As you describe your project, structured intelligence will appear here in real-time.
      </p>
    </div>
  );
}

// ── Overview tab cards ────────────────────────────────────────────────────────

function LeadScoreCard({ state }: { state: ProjectRequirementState }) {
  if (!state.leadScore && !state.inferredComplexity) return null;

  return (
    <Card className="bg-emerald-950/20 border-emerald-900/50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          {/* Score */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Lead Score</p>
            {state.leadScore ? (
              <>
                <div className="flex items-end gap-1.5 mb-2">
                  <span className={cn('text-4xl font-bold tabular-nums', scoreColor(state.leadScore.score))}>
                    {state.leadScore.score}
                  </span>
                  <span className="text-sm text-slate-600 mb-1">/100</span>
                </div>
                <Badge className={cn(
                  'text-[10px] border',
                  state.leadScore.score >= 70
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : state.leadScore.score >= 40
                    ? 'bg-amber-950 text-amber-400 border-amber-800'
                    : 'bg-red-950 text-red-400 border-red-800',
                )}>
                  {state.leadScore.label}
                </Badge>
              </>
            ) : (
              <span className="text-sm text-slate-600">Awaiting data…</span>
            )}
          </div>

          {/* Complexity + completeness */}
          <div className="text-right space-y-3">
            {state.inferredComplexity && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Complexity</p>
                <Badge className={cn('text-[10px] border', complexityConfig[state.inferredComplexity]?.className)}>
                  {complexityConfig[state.inferredComplexity]?.label ?? state.inferredComplexity}
                </Badge>
              </div>
            )}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Completeness</p>
              <Progress value={state.completenessScore} className="h-1.5 w-20 bg-[#1f2d3d]" />
              <p className="text-[10px] text-slate-500 text-right mt-0.5 tabular-nums">
                {state.completenessScore}%
              </p>
            </div>
          </div>
        </div>

        {/* Score breakdown mini-bars */}
        {state.leadScore && (
          <div className="mt-4 space-y-2 border-t border-[#1f2d3d] pt-3">
            {Object.entries(state.leadScore.breakdown).map(([key, val]) => (
              <div key={key}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-slate-500 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <span className="text-[10px] text-slate-500 tabular-nums">{val}/20</span>
                </div>
                <Progress value={(val / 20) * 100} className="h-1 bg-[#1f2d3d]" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectDetailsCard({ state }: { state: ProjectRequirementState }) {
  const hasData =
    state.projectType || state.projectName || state.description ||
    state.industry || state.platforms.length > 0 ||
    state.targetUsers || state.userScale;
  if (!hasData) return null;

  return (
    <Card className="bg-[#111827] border-[#1f2d3d]">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
          Project Details
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        {(state.projectType || state.industry) && (
          <div className="flex flex-wrap gap-1.5">
            {state.projectType && (
              <Badge className="bg-blue-950 text-blue-300 border-blue-800 text-[10px] capitalize">
                {state.projectType.replace('_', ' ')}
              </Badge>
            )}
            {state.industry && (
              <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] capitalize">
                {state.industry}
              </Badge>
            )}
          </div>
        )}

        {state.projectName && (
          <p className="text-sm font-semibold text-slate-200">{state.projectName}</p>
        )}
        {state.description && (
          <p className="text-xs text-slate-500 leading-relaxed">{state.description}</p>
        )}

        {state.platforms.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1.5">Platforms</p>
            <div className="flex flex-wrap gap-1.5">
              {state.platforms.map((p) => (
                <Badge key={p} className="bg-[#1f2d3d] text-slate-300 border-[#374151] text-[10px] capitalize">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(state.targetUsers || state.userScale) && (
          <div className="border-t border-[#1f2d3d] pt-2 space-y-1">
            {state.targetUsers && (
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-600">Target users</span>
                <span className="text-[10px] text-slate-300">{state.targetUsers}</span>
              </div>
            )}
            {state.userScale && (
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-600">Scale</span>
                <span className="text-[10px] text-slate-300">{state.userScale}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QualificationCard({ state }: { state: ProjectRequirementState }) {
  const hasBudget = state.budgetRange.raw || state.budgetRange.min;
  if (!hasBudget && !state.timelineExpectation) return null;

  const budgetDisplay =
    state.budgetRange.raw ??
    (state.budgetRange.min
      ? `${state.budgetRange.currency} ${state.budgetRange.min.toLocaleString()}${
          state.budgetRange.max ? ` – ${state.budgetRange.max.toLocaleString()}` : '+'
        }`
      : null);

  return (
    <Card className="bg-[#111827] border-[#1f2d3d]">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
          Qualification
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 gap-3">
          {budgetDisplay && (
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-3 text-center">
              <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1">Budget</p>
              <p className="text-sm font-bold text-emerald-400 leading-tight">{budgetDisplay}</p>
            </div>
          )}
          {state.timelineExpectation && (
            <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-3 text-center">
              <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1">Timeline</p>
              <p className="text-sm font-bold text-blue-400 leading-tight">{state.timelineExpectation}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MissingInfoCard({ state }: { state: ProjectRequirementState }) {
  if (state.missingInformation.length === 0) return null;

  return (
    <Card className="bg-red-950/20 border-red-900/50">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-[10px] text-red-400 uppercase tracking-widest font-semibold">
          ⚠ Missing Information ({state.missingInformation.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-2">
          {state.missingInformation.slice(0, 6).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                item.priority === 'HIGH'   ? 'bg-red-400'   :
                item.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-500',
              )} />
              <span className="text-xs text-slate-400">{item.field}</span>
            </div>
          ))}
          {state.missingInformation.length > 6 && (
            <p className="text-[10px] text-slate-600 text-center pt-1">
              +{state.missingInformation.length - 6} more
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tab content components ────────────────────────────────────────────────────

function OverviewTab({ state }: { state: ProjectRequirementState }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <LeadScoreCard state={state} />
        <ProjectDetailsCard state={state} />
        <QualificationCard state={state} />

        {/* Compact features summary — full list is in Features tab */}
        {state.features.length > 0 && (
          <Card className="bg-[#111827] border-[#1f2d3d]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                Features ({state.features.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-1.5">
              {state.features.slice(0, 5).map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge className={cn('text-[9px] border flex-shrink-0 mt-0.5', priorityConfig[f.priority]?.className)}>
                    {f.priority}
                  </Badge>
                  <span className="text-xs text-slate-400">{f.name}</span>
                </div>
              ))}
              {state.features.length > 5 && (
                <p className="text-[10px] text-slate-600 text-center pt-1">
                  +{state.features.length - 5} more — see Features tab
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <MissingInfoCard state={state} />
      </div>
    </ScrollArea>
  );
}

function FeaturesTab({ state }: { state: ProjectRequirementState }) {
  if (state.features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
        <p className="text-sm text-slate-600">No features extracted yet.</p>
        <p className="text-xs text-slate-700 mt-1">Keep chatting to extract feature requirements.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {state.features.map((f, i) => (
          <Card key={i} className="bg-[#111827] border-[#1f2d3d]">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <Badge className={cn('text-[9px] border flex-shrink-0 mt-0.5', priorityConfig[f.priority]?.className)}>
                  {f.priority}
                </Badge>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200">{f.name}</p>
                  {f.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{f.description}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function ProposalTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
      <div className="w-12 h-12 rounded-xl bg-[#111827] border border-[#1f2d3d] flex items-center justify-center mb-3">
        <span className="text-xl">📄</span>
      </div>
      <p className="text-sm font-medium text-slate-400 mb-1">Proposal</p>
      <p className="text-xs text-slate-600 leading-relaxed">
        Use the "Generate Proposal" button in the chat header once enough
        requirements are gathered (60%+ completeness).
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function IntelligencePanel({ state }: IntelligencePanelProps) {
  const hasData =
    state &&
    (state.projectType ||
      state.platforms.length > 0 ||
      state.features.length > 0 ||
      state.description ||
      state.leadScore);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a]">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-[#1f2d3d] bg-[#0d1117] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-blue-500 text-xs">⚡</span>
          <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">
            Live Intelligence
          </span>
        </div>
        {state && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1 bg-[#1f2d3d] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{ width: `${state.completenessScore}%` }}
              />
            </div>
            <span className="text-[10px] text-blue-400 tabular-nums">
              {state.completenessScore}%
            </span>
          </div>
        )}
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="flex-shrink-0 w-full rounded-none bg-[#0d1117] border-b border-[#1f2d3d] h-9 p-0">
            <TabsTrigger
              value="overview"
              className="flex-1 rounded-none text-xs h-full
                data-[state=active]:bg-transparent data-[state=active]:text-blue-400
                data-[state=active]:border-b-2 data-[state=active]:border-blue-500
                data-[state=active]:shadow-none text-slate-500 hover:text-slate-300"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="features"
              className="flex-1 rounded-none text-xs h-full
                data-[state=active]:bg-transparent data-[state=active]:text-blue-400
                data-[state=active]:border-b-2 data-[state=active]:border-blue-500
                data-[state=active]:shadow-none text-slate-500 hover:text-slate-300"
            >
              Features{state.features.length > 0 ? ` (${state.features.length})` : ''}
            </TabsTrigger>
            <TabsTrigger
              value="proposal"
              className="flex-1 rounded-none text-xs h-full
                data-[state=active]:bg-transparent data-[state=active]:text-blue-400
                data-[state=active]:border-b-2 data-[state=active]:border-blue-500
                data-[state=active]:shadow-none text-slate-500 hover:text-slate-300"
            >
              Proposal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
            <OverviewTab state={state} />
          </TabsContent>
          <TabsContent value="features" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
            <FeaturesTab state={state} />
          </TabsContent>
          <TabsContent value="proposal" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
            <ProposalTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/intelligence-panel.tsx
git commit -m "feat: refactor IntelligencePanel with tabs, decorated cards, and dark theme"
```

---

## Task 7: Update ProposalView — dark theme

**Files:**
- Modify: `components/proposal-view.tsx`

- [ ] **Step 1: Replace `components/proposal-view.tsx` entirely**

```typescript
'use client';

import { ProposalContent } from '@/types/proposal';
import { X, Clock, DollarSign, Users, Layers, CheckCircle, AlertCircle } from 'lucide-react';

interface ProposalViewProps {
  proposal: ProposalContent;
  projectName?: string | null;
  onClose: () => void;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-blue-400">{icon}</span>}
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function ProposalView({ proposal, projectName, onClose }: ProposalViewProps) {
  const totalWeeks = proposal.timeline.phases.reduce((s, p) => s + p.durationWeeks, 0);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1f2d3d] bg-[#0d1117] flex items-start justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">
              Proposal
            </span>
            <span className="text-[10px] text-slate-700">·</span>
            <span className="text-[10px] text-slate-600 capitalize">
              {proposal.pricing.model.replace('_', ' ')}
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-100">
            {projectName ?? 'Project Proposal'}
          </h1>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-[#1f2d3d] hover:bg-[#374151] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* KPI bar */}
      <div className="px-6 py-3 bg-[#0d1117] border-b border-[#1f2d3d] grid grid-cols-3 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-blue-400" />
          <div>
            <p className="text-[10px] text-slate-600">Total Investment</p>
            <p className="text-sm font-bold text-slate-200">{formatUsd(proposal.pricing.totalUsd)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-blue-400" />
          <div>
            <p className="text-[10px] text-slate-600">Timeline</p>
            <p className="text-sm font-bold text-slate-200">{totalWeeks} weeks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users size={14} className="text-blue-400" />
          <div>
            <p className="text-[10px] text-slate-600">Team Size</p>
            <p className="text-sm font-bold text-slate-200">
              {proposal.team.reduce((s, m) => s + m.count, 0)} people
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        <Section title="Executive Summary">
          <p className="text-sm text-slate-400 leading-relaxed bg-[#111827] rounded-xl p-4 border border-[#1f2d3d]">
            {proposal.executiveSummary}
          </p>
        </Section>

        <Section title="Scope of Work" icon={<Layers size={14} />}>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-950/30 rounded-xl p-4 border border-emerald-900/50">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-2">
                Included
              </p>
              <ul className="space-y-1.5">
                {proposal.scope.included.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-300">
                    <CheckCircle size={11} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#111827] rounded-xl p-4 border border-[#1f2d3d]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Excluded
              </p>
              <ul className="space-y-1.5">
                {proposal.scope.excluded.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                    <AlertCircle size={11} className="mt-0.5 flex-shrink-0 text-slate-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section title="Project Timeline" icon={<Clock size={14} />}>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-[#1f2d3d]" />
            <div className="space-y-3">
              {proposal.timeline.phases.map((phase, i) => (
                <div key={i} className="flex gap-4 pl-8 relative">
                  <div className="absolute left-1.5 top-2.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-[#0d1117] ring-2 ring-blue-900" />
                  <div className="flex-1 bg-[#111827] rounded-xl border border-[#1f2d3d] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-slate-200">{phase.name}</p>
                      <span className="text-xs text-slate-600">{phase.durationWeeks}w</span>
                    </div>
                    <ul className="space-y-0.5">
                      {phase.deliverables.map((d, j) => (
                        <li key={j} className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-[#374151] flex-shrink-0" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Investment Breakdown" icon={<DollarSign size={14} />}>
          <div className="bg-[#111827] rounded-xl border border-[#1f2d3d] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0d1117] border-b border-[#1f2d3d]">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Item</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2d3d]">
                {proposal.pricing.breakdown.map((item, i) => (
                  <tr key={i} className="hover:bg-[#1f2d3d]/50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400">{item.item}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-300 tabular-nums">
                      {formatUsd(item.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#374151] bg-[#0d1117]">
                  <td className="px-4 py-3 font-bold text-slate-200">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-400 text-sm tabular-nums">
                    {formatUsd(proposal.pricing.totalUsd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        <Section title="Recommended Tech Stack" icon={<Layers size={14} />}>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(proposal.techStack).map(([key, value]) => (
              <div key={key} className="bg-[#111827] rounded-lg border border-[#1f2d3d] px-3 py-2.5">
                <p className="text-[10px] text-slate-600 capitalize mb-0.5">{key}</p>
                <p className="text-xs font-semibold text-slate-300">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Team Composition" icon={<Users size={14} />}>
          <div className="grid grid-cols-2 gap-2">
            {proposal.team.map((member, i) => (
              <div
                key={i}
                className="bg-[#111827] rounded-lg border border-[#1f2d3d] px-3 py-2.5 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-medium text-slate-300">{member.role}</p>
                  <p className="text-[10px] text-slate-600">{member.allocationPct}% allocation</p>
                </div>
                <span className="w-7 h-7 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center text-xs font-bold text-blue-400">
                  {member.count}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {proposal.assumptions.length > 0 && (
          <Section title="Assumptions">
            <ul className="space-y-1.5">
              {proposal.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                  <span className="text-slate-700 mt-0.5">—</span>
                  {a}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Terms & Conditions">
          <p className="text-xs text-slate-500 leading-relaxed bg-[#111827] rounded-xl p-4 border border-[#1f2d3d]">
            {proposal.terms}
          </p>
        </Section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/proposal-view.tsx
git commit -m "feat: apply dark enterprise theme to ProposalView"
```

---

## Task 8: Enable demo mode and run full verification

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add `NEXT_PUBLIC_DEMO_MODE` to `.env.local`**

Append to the existing `.env.local` file:

```bash
# Demo mode — shows the "👁 View Intelligence" toggle in the chat header.
# Remove or set to false for production deployments.
NEXT_PUBLIC_DEMO_MODE=true
```

- [ ] **Step 2: Final TypeScript check across entire project**

```bash
npx tsc --noEmit
```

Expected: `0 errors`.

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

- [ ] **Step 4: Verify all success criteria at http://localhost:3000**

Work through this checklist in the browser:

- [ ] Page background is `#0d1117` dark — no white flash on load
- [ ] Nav bar is dark with "DealGhost" and blue "AI Pre-Sales Intelligence" badge
- [ ] Chat empty state shows ghost avatar in blue ring
- [ ] **"👁 View Intelligence"** pill button is visible in the chat header
- [ ] Clicking it opens the intelligence panel — layout splits left/right
- [ ] ResizableHandle drag divider appears and is draggable
- [ ] Dragging the handle resizes both panels
- [ ] Clicking **"Hide Intelligence"** collapses the panel — chat fills full width
- [ ] Type `"I want to build a food delivery app"` and send — blue bubble appears right
- [ ] AI responds — dark card bubble appears left with ghost avatar
- [ ] Click "👁 View Intelligence" — Overview tab shows empty state initially
- [ ] Continue chatting about budget, platform, timeline — Overview cards populate:
  - [ ] Lead Score card appears (green-bordered) with score and breakdown bars
  - [ ] Project Details card appears with type/platform badges
  - [ ] Qualification card appears with budget + timeline side-by-side
  - [ ] Missing Information card appears (red-bordered) with gap list
- [ ] Click **Features** tab — shows extracted features or placeholder
- [ ] Click **Proposal** tab — shows 📄 placeholder with instructions
- [ ] At 60%+ completeness: **"Generate Proposal"** button appears in chat header
- [ ] Clicking it generates a proposal and auto-opens the panel with `ProposalView`
- [ ] ProposalView has dark theme — dark cards, blue accents, no white backgrounds

- [ ] **Step 5: Commit env change**

```bash
git add .env.local
git commit -m "chore: enable NEXT_PUBLIC_DEMO_MODE for local development"
```

---

## Summary

8 tasks, 14 files changed. All TypeScript checks run per task. The app remains fully functional after each commit — no broken intermediate states.

| Task | What it does |
|------|-------------|
| 1 | Installs shadcn/ui (8 components) + react-resizable-panels |
| 2 | Adds `structured=true` to Groq calls for extraction, scoring, proposal |
| 3 | Forces dark theme via CSS variables + `class="dark"` on html |
| 4 | Replaces hard-coded flex split with `ResizablePanelGroup` + toggle state |
| 5 | Adds "👁 View Intelligence" toggle button + dark theme to ChatPanel |
| 6 | Full refactor of IntelligencePanel — tabs + 4 decorated Cards |
| 7 | Updates ProposalView to dark theme |
| 8 | Enables demo mode env var + manual verification checklist |
