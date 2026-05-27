'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { ProposalContent } from '@/types/proposal';

// ── Types ────────────────────────────────────────────────────────────────────

interface ListItem {
  id: string;
  status: string;
  version: number;
  totalMax: number | null;
  createdAt: string;
  sentAt: string | null;
  completeness: number;
  projectName: string | null;
  projectType: string | null;
  description: string | null;
  lead: { email: string; name: string };
}

interface Detail {
  id: string;
  status: string;
  version: number;
  content: ProposalContent;
  lead: { email: string; name: string };
  analysis: {
    completeness: number;
    requirements: Record<string, unknown>;
    conversation: {
      messages: Array<{ role: string; content: string; createdAt: string }>;
    };
  } | null;
}

const PW = 'CheatGPT@435';
const INR = (n: number | null | undefined) =>
  n != null ? `₹${n.toLocaleString('en-IN')}` : '—';

function statusBadge(s: string) {
  if (s === 'SENT')  return 'bg-emerald-900/50 text-emerald-400';
  if (s === 'DRAFT') return 'bg-amber-900/50 text-amber-400';
  return 'bg-slate-800 text-slate-400';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed]       = useState(false);
  const [pwInput, setPwInput]     = useState('');
  const [pwError, setPwError]     = useState(false);
  const [proposals, setProposals] = useState<ListItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<Detail | null>(null);
  const [loadingDet, setLoadingDet] = useState(false);
  const [editJson, setEditJson]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [sending, setSending]     = useState(false);
  const [feedback, setFeedback]   = useState<string | null>(null);

  function login() {
    if (pwInput === PW) { setAuthed(true); setPwError(false); }
    else setPwError(true);
  }

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/proposals', { headers: { 'x-admin-password': PW } });
      const d = await r.json();
      setProposals(d.proposals ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authed) fetchList(); }, [authed, fetchList]);

  async function openDetail(id: string) {
    setLoadingDet(true); setFeedback(null);
    try {
      const r = await fetch(`/api/admin/proposals/${id}`, { headers: { 'x-admin-password': PW } });
      const d = await r.json();
      setSelected(d.proposal);
      setEditJson(JSON.stringify(d.proposal.content, null, 2));
    } finally { setLoadingDet(false); }
  }

  async function saveEdits() {
    if (!selected) return;
    setSaving(true); setFeedback(null);
    try {
      const content = JSON.parse(editJson);
      await fetch(`/api/admin/proposals/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': PW },
        body: JSON.stringify({ content }),
      });
      setFeedback('✓ Saved');
    } catch { setFeedback('✗ Invalid JSON — fix before saving'); }
    finally { setSaving(false); }
  }

  async function sendProposal() {
    if (!selected || sending) return;
    setSending(true); setFeedback(null);
    try {
      const r = await fetch(`/api/admin/proposals/${selected.id}/send`, {
        method: 'POST', headers: { 'x-admin-password': PW },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Send failed');
      setFeedback(`✓ Sent to ${selected.lead.email}`);
      fetchList();
    } catch (e: unknown) {
      setFeedback(`✗ ${e instanceof Error ? e.message : 'Send failed'}`);
    } finally { setSending(false); }
  }

  // ── Password gate ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="bg-[#0f1724] border border-[#1e2d40] rounded-2xl p-8 w-full max-w-sm space-y-5">
          <div className="text-center">
            <span className="text-3xl">👻</span>
            <h1 className="text-lg font-bold text-slate-100 mt-2">Admin Access</h1>
            <p className="text-xs text-slate-500 mt-1">Team CheatGPT · DealGhost Dashboard</p>
          </div>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="Password"
            className="w-full bg-[#080d14] border border-[#1f2d3d] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-600/60"
          />
          {pwError && <p className="text-xs text-red-400 text-center">Incorrect password</p>}
          <button
            onClick={login}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100">

      <nav className="sticky top-0 z-50 h-12 bg-[#080d14]/90 backdrop-blur-sm border-b border-[#1f2d3d] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Site</Link>
          <span className="text-[#1f2d3d]">|</span>
          <span className="text-sm font-bold text-slate-100">Admin Dashboard</span>
          <span className="text-[10px] font-medium text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-900">
            Team CheatGPT
          </span>
        </div>
        <button
          onClick={fetchList}
          className="text-xs text-slate-500 hover:text-slate-300 border border-[#1f2d3d] hover:border-slate-600 px-2.5 py-1 rounded-md transition-colors"
        >
          ↺ Refresh
        </button>
      </nav>

      <div className="flex h-[calc(100vh-48px)]">

        {/* Sidebar — proposal list */}
        <div className="w-72 flex-shrink-0 border-r border-[#1f2d3d] overflow-y-auto bg-[#080d14]/40">
          <div className="px-4 py-3 border-b border-[#1f2d3d]">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Proposals ({proposals.length})
            </p>
          </div>

          {loading && <p className="p-6 text-center text-xs text-slate-500">Loading…</p>}

          {!loading && proposals.length === 0 && (
            <p className="p-6 text-center text-xs text-slate-600">
              No proposals yet. When a customer completes a chat, their proposal appears here.
            </p>
          )}

          {proposals.map((p) => (
            <button
              key={p.id}
              onClick={() => openDetail(p.id)}
              className={`w-full text-left px-4 py-3 border-b border-[#1f2d3d] hover:bg-[#0f1724] transition-colors ${
                selected?.id === p.id ? 'bg-[#0f1724] border-l-2 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-slate-200 truncate max-w-[140px]">
                  {p.lead.email}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadge(p.status)}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {p.projectName ?? p.projectType ?? p.description?.slice(0, 38) ?? 'Unnamed project'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-600">
                  {new Date(p.createdAt).toLocaleDateString('en-IN')}
                </span>
                <span className="text-[10px] text-blue-500">{p.completeness}%</span>
                {p.totalMax != null && (
                  <span className="text-[10px] text-emerald-600">{INR(p.totalMax)}</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Main — detail view */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingDet && (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading…</div>
          )}

          {!selected && !loadingDet && (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2">
              <span className="text-4xl">👻</span>
              <p className="text-sm">Select a proposal from the sidebar</p>
            </div>
          )}

          {selected && !loadingDet && (
            <div className="max-w-4xl mx-auto space-y-5">

              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">
                    {(selected.analysis?.requirements?.projectName as string) ?? 'Project Proposal'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {selected.lead.email} · v{selected.version} · {selected.status}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {feedback && (
                    <span className={`text-xs ${feedback.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                      {feedback}
                    </span>
                  )}
                  <button
                    onClick={saveEdits}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs bg-[#1a2535] border border-[#2a3d52] hover:border-slate-500 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Edits'}
                  </button>
                  <button
                    onClick={sendProposal}
                    disabled={sending || selected.status === 'SENT'}
                    className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : selected.status === 'SENT' ? '✓ Already Sent' : 'Send to Customer'}
                  </button>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Completeness', value: `${selected.analysis?.completeness ?? 0}%` },
                  { label: 'Total (INR)', value: INR(selected.content.pricing.totalUsd) },
                  { label: 'Timeline', value: `${selected.content.timeline.phases.reduce((s, p) => s + p.durationWeeks, 0)} weeks` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
                  </div>
                ))}
              </div>

              {/* Features discovered */}
              {Array.isArray(selected.analysis?.requirements?.features) && (
                <div className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Features Discovered
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(selected.analysis!.requirements.features as Array<{ canonicalId: string; priority: string }>)
                      .map((f) => (
                        <span
                          key={f.canonicalId}
                          className="text-[11px] bg-blue-950/50 border border-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full"
                        >
                          {f.canonicalId} [{f.priority}]
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {(selected.analysis?.conversation?.messages?.length ?? 0) > 0 && (
                <div className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Transcript ({selected.analysis!.conversation.messages.length} messages)
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selected.analysis!.conversation.messages.map((m, i) => (
                      <div key={i} className={`flex text-xs ${m.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-xl ${
                          m.role === 'USER'
                            ? 'bg-blue-700/30 text-blue-200'
                            : 'bg-[#0a0f1a] border border-[#1f2d3d] text-slate-300'
                        }`}>
                          <span className="font-semibold opacity-50 mr-1.5">
                            {m.role === 'USER' ? 'Customer' : 'DealGhost'}:
                          </span>
                          {m.content.length > 220 ? m.content.slice(0, 220) + '…' : m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable proposal JSON */}
              <div className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Proposal Content — edit JSON then click Save Edits
                </h3>
                <textarea
                  value={editJson}
                  onChange={(e) => setEditJson(e.target.value)}
                  rows={28}
                  spellCheck={false}
                  className="w-full bg-[#080d14] border border-[#1f2d3d] rounded-lg p-3 text-xs font-mono text-slate-300 outline-none focus:border-blue-600/50 resize-none leading-relaxed"
                />
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
