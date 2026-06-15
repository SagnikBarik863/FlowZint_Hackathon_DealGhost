'use client';

import { useState, useCallback, useEffect } from 'react';
import { ChatPanel, ChatMessage, type HistoryEntry } from '@/components/chat-panel';
import { IntelligencePanel } from '@/components/intelligence-panel';
import { ProposalView } from '@/components/proposal-view';
import { ProposalContent } from '@/types/proposal';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import type { ProjectRequirementState } from '@/types/project';

// ── History helpers ────────────────────────────────────────────────────────────

const HISTORY_KEY = 'dealghost_history';
const MAX_HISTORY = 20;

function readHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function buildHistoryEntry(
  id: string,
  msgs: ChatMessage[],
  state: ProjectRequirementState | null,
): HistoryEntry {
  const firstUser = msgs.find((m) => m.role === 'user')?.content ?? '';
  const last = msgs[msgs.length - 1];
  return {
    id,
    title: state?.projectName ?? (firstUser.slice(0, 48) || 'New conversation'),
    preview: last ? last.content.replace(/[*_#`[\]]/g, '').slice(0, 70) : '',
    timestamp: Date.now(),
  };
}

function upsertHistory(
  entry: HistoryEntry,
  setHistoryState: (entries: HistoryEntry[]) => void,
): void {
  const entries = readHistory();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry; else entries.unshift(entry);
  saveHistory(entries);
  setHistoryState(entries.slice(0, MAX_HISTORY));
}

// ── Feature summary message ────────────────────────────────────────────────────

function buildFeatureSummaryMessage(state: ProjectRequirementState): string {
  const lines: string[] = [];

  const projectLabel = state.projectName
    ? `**${state.projectName}**`
    : state.projectType
    ? `your **${state.projectType.replace(/_/g, ' ')}**`
    : 'your project';

  lines.push(`Okay — here's what I've got on ${projectLabel} so far:\n`);

  if (state.projectType) {
    lines.push(`**Type:** ${state.projectType.replace(/_/g, ' ')}`);
  }
  if (state.platforms.length) {
    lines.push(`**Platforms:** ${state.platforms.join(', ')}`);
  }
  if (state.targetUsers) {
    lines.push(`**For:** ${state.targetUsers}`);
  }
  if (state.timelineExpectation) {
    lines.push(`**Timeline:** ${state.timelineExpectation}`);
  }

  if (state.features.length > 0) {
    lines.push('\n**Features:**');
    state.features.forEach((f) => {
      const icon = f.priority === 'MUST' ? '🔴' : f.priority === 'SHOULD' ? '🟡' : '🟢';
      lines.push(`${icon} ${(f.canonicalId ?? f.name ?? '').replace(/_/g, ' ')} *(${f.priority})*`);
    });
  }

  lines.push('\nDoes this look right? If anything\'s off or missing, just say so. When you\'re happy with it, hit **Generate Proposal** and I\'ll put together the full estimate. 🚀');

  return lines.join('\n');
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hey 👋 I'm DealGhost — I help founders turn software ideas into real, scoped proposals.\n\nNo generic quotes, no guesswork. Just smart questions until we know exactly what you want to build — then a detailed proposal lands in your inbox.\n\nWhat's the idea?",
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionKey, setSessionKey] = useState(0);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [projectState, setProjectState] = useState<ProjectRequirementState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalContent | null>(null);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  // isPanelOpen controls whether the intelligence panel is visible
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // Track how many messages the client has sent — used to gate the proposal button
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [readyForProposal, setReadyForProposal] = useState(false);
  const [featuresConfirmed, setFeaturesConfirmed] = useState(false);
  // Once true, proposal buttons re-appear after every bot response until email submitted
  const [stayReadyForProposal, setStayReadyForProposal] = useState(false);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // On mount: restore previous conversation from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem('dealghost_conv_id');
    if (!savedId) return;

    setIsLoading(true);
    fetch(`/api/chat?conversationId=${savedId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { messages: { role: 'user' | 'assistant'; content: string }[]; state: ProjectRequirementState | null }) => {
        if (data.messages?.length > 0) {
          setConversationId(savedId);
          setMessages(data.messages);
          if (data.state) setProjectState(data.state as ProjectRequirementState);
          upsertHistory(
            buildHistoryEntry(savedId, data.messages, data.state as ProjectRequirementState | null),
            setHistory,
          );
        } else {
          localStorage.removeItem('dealghost_conv_id');
        }
      })
      .catch(() => localStorage.removeItem('dealghost_conv_id'))
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load history list on mount (sync, no async needed)
  useEffect(() => {
    setHistory(readHistory());
  }, []);

  // Persist conversationId to localStorage whenever it is set
  useEffect(() => {
    if (conversationId) localStorage.setItem('dealghost_conv_id', conversationId);
  }, [conversationId]);

  // Animate welcome message in after a short delay — skip on initial mount if we have a saved session
  useEffect(() => {
    if (sessionKey === 0 && localStorage.getItem('dealghost_conv_id')) return;
    setMessages([]);
    const t = setTimeout(() => setMessages([WELCOME_MESSAGE]), 520);
    return () => clearTimeout(t);
  }, [sessionKey]);

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
      const justBecameReady = data.readyForProposal && !readyForProposal;
      if (typeof data.userMessageCount === 'number') {
        setUserMessageCount(data.userMessageCount);
      }

      let responseMsg: string;
      if (justBecameReady && data.intent === 'READY_FOR_PROPOSAL') {
        // User explicitly said "generate proposal" — skip summary, go straight to email
        setReadyForProposal(true);
        setFeaturesConfirmed(true);
        responseMsg = data.message as string;
      } else if (justBecameReady) {
        // Just crossed the completeness threshold — show feature summary + inline buttons
        setReadyForProposal(true);
        responseMsg = buildFeatureSummaryMessage(data.state);
      } else {
        responseMsg = data.message as string;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: responseMsg }]);

      // Re-show proposal buttons after every response once user has been in "add more details" mode
      if (stayReadyForProposal && !featuresConfirmed) {
        setReadyForProposal(true);
      }

      const convId = conversationId ?? data.conversationId;
      upsertHistory(
        buildHistoryEntry(
          convId,
          [...messages, { role: 'user', content: text }, { role: 'assistant', content: responseMsg }],
          data.state as ProjectRequirementState | null,
        ),
        setHistory,
      );
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Network error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId, readyForProposal, stayReadyForProposal, featuresConfirmed, messages]);

  const handleEmailSubmit = useCallback(async (email: string) => {
    if (!conversationId || isSubmittingEmail) return;
    setIsSubmittingEmail(true);
    try {
      const res = await fetch('/api/lead/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save email');
      setCustomerEmail(email);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant' as const,
          content: `Perfect! 🎉 Your project details have been sent to **CheatGPT**.\n\nWe're reviewing your requirements now and will send a detailed proposal to **${email}** within 24 hours.\n\nFeel free to ask me anything else in the meantime!`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: 'Something went wrong saving your email. Please try again.' },
      ]);
    } finally {
      setIsSubmittingEmail(false);
    }
  }, [conversationId, isSubmittingEmail]);

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

  const clearHistory = useCallback(() => {
    // Keep only the current session entry (if one exists)
    const entries = readHistory();
    const kept = entries.filter((e) => e.id === conversationId);
    saveHistory(kept);
    setHistory(kept);
  }, [conversationId]);

  const deleteHistoryEntry = useCallback(async (id: string) => {
    // Remove from localStorage immediately
    const entries = readHistory().filter((e) => e.id !== id);
    saveHistory(entries);
    setHistory(entries);

    // Delete from DB
    try { await fetch(`/api/chat/${id}`, { method: 'DELETE' }); } catch { /* best-effort */ }

    // If the deleted chat is the active one, reset to a fresh session
    if (id === conversationId) {
      localStorage.removeItem('dealghost_conv_id');
      setSessionKey((k) => k + 1);
      setConversationId(null);
      setProjectState(null);
      setProposal(null);
      setInput('');
      setIsPanelOpen(false);
      setUserMessageCount(0);
      setReadyForProposal(false);
      setFeaturesConfirmed(false);
      setStayReadyForProposal(false);
      setCustomerEmail(null);
      setIsSubmittingEmail(false);
    }
  }, [conversationId]);

  const loadHistorySession = useCallback(async (id: string) => {
    if (id === conversationId) return;
    setIsLoading(true);
    setMessages([]);
    setProjectState(null);
    setProposal(null);
    setReadyForProposal(false);
    setFeaturesConfirmed(false);
    setStayReadyForProposal(false);
    setCustomerEmail(null);
    setIsSubmittingEmail(false);
    setUserMessageCount(0);
    setInput('');
    setIsPanelOpen(false);

    fetch(`/api/chat?conversationId=${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { messages: ChatMessage[]; state: ProjectRequirementState | null }) => {
        if (data.messages?.length > 0) {
          setConversationId(id);
          localStorage.setItem('dealghost_conv_id', id);
          setMessages(data.messages);
          if (data.state) setProjectState(data.state as ProjectRequirementState);
        } else {
          setMessages([WELCOME_MESSAGE]);
        }
      })
      .catch(() => setMessages([WELCOME_MESSAGE]))
      .finally(() => setIsLoading(false));
  }, [conversationId]);

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      {/* Top Nav */}
      <nav className="h-12 bg-[#080d14]/90 backdrop-blur-sm border-b border-[#1f2d3d] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Home
          </a>
          <span className="text-[#1f2d3d]">|</span>
          <span className="text-sm font-bold text-slate-100 tracking-tight">CheatGPT</span>
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
          <button
            onClick={() => {
              localStorage.removeItem('dealghost_conv_id');
              setSessionKey((k) => k + 1);
              setConversationId(null);
              setProjectState(null);
              setProposal(null);
              setInput('');
              setIsPanelOpen(false);
              setUserMessageCount(0);
              setReadyForProposal(false);
              setFeaturesConfirmed(false);
              setStayReadyForProposal(false);
              setCustomerEmail(null);
              setIsSubmittingEmail(false);
            }}
            className="text-xs text-slate-400 hover:text-slate-100 transition-colors border border-[#1f2d3d] hover:border-slate-500 px-3 py-1 rounded-md flex items-center gap-1.5"
          >
            <span className="text-[11px]">＋</span> New Chat
          </button>
        </div>
      </nav>

      {/*
        ResizablePanelGroup replaces the old hard-coded flex split.
        key={String(isPanelOpen)} forces re-mount on toggle so panel sizes reset cleanly.
      */}
      <ResizablePanelGroup
        key={String(isPanelOpen)}
        orientation="horizontal"
        className="flex-1 overflow-hidden"
      >
        <ResizablePanel defaultSize={isPanelOpen ? 60 : 100} minSize={35}>
          <ChatPanel
            messages={messages}
            input={input}
            isLoading={isLoading}
            completeness={projectState?.completenessScore ?? 0}
            userMessageCount={userMessageCount}
            isPanelOpen={isPanelOpen}
            onInputChange={setInput}
            onSend={sendMessage}
            onTogglePanel={() => setIsPanelOpen((v) => !v)}
            onGenerateProposal={generateProposal}
            isGeneratingProposal={isGeneratingProposal}
            emailCollectionMode={readyForProposal && featuresConfirmed && !customerEmail}
            onEmailSubmit={handleEmailSubmit}
            isSubmittingEmail={isSubmittingEmail}
            showProposalButton={readyForProposal && !featuresConfirmed && !customerEmail}
            onConfirmFeatures={() => {
              setFeaturesConfirmed(true);
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant' as const,
                  content: "On it! 🚀 Just drop your email below and I'll send the full proposal straight to your inbox — usually within 24 hours.",
                },
              ]);
            }}
            onAddMoreDetails={() => {
              setReadyForProposal(false);
              setFeaturesConfirmed(false);
              setStayReadyForProposal(true);
            }}
            history={history}
            onLoadHistory={loadHistorySession}
            onClearHistory={clearHistory}
            onDeleteHistory={deleteHistoryEntry}
            currentConversationId={conversationId}
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
