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
        orientation="horizontal"
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
