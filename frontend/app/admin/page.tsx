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

const PW = '123456';

function normalizeContent(raw: unknown): ProposalContent {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    executiveSummary: (c.executiveSummary as string) ?? '',
    scope: {
      included: Array.isArray((c.scope as Record<string, unknown>)?.included) ? (c.scope as Record<string, unknown>).included as string[] : [],
      excluded: Array.isArray((c.scope as Record<string, unknown>)?.excluded) ? (c.scope as Record<string, unknown>).excluded as string[] : [],
    },
    deliverables: Array.isArray(c.deliverables) ? c.deliverables as ProposalContent['deliverables'] : [],
    timeline: {
      phases: Array.isArray((c.timeline as Record<string, unknown>)?.phases)
        ? (c.timeline as Record<string, unknown>).phases as ProposalContent['timeline']['phases']
        : [],
    },
    pricing: {
      model: ((c.pricing as Record<string, unknown>)?.model as ProposalContent['pricing']['model']) ?? 'fixed',
      breakdown: Array.isArray((c.pricing as Record<string, unknown>)?.breakdown) ? (c.pricing as Record<string, unknown>).breakdown as ProposalContent['pricing']['breakdown'] : [],
      totalUsd: ((c.pricing as Record<string, unknown>)?.totalUsd as number) ?? 0,
      currency: ((c.pricing as Record<string, unknown>)?.currency as string) ?? 'INR',
    },
    techStack: {
      frontend: ((c.techStack as Record<string, unknown>)?.frontend as string) ?? '',
      backend: ((c.techStack as Record<string, unknown>)?.backend as string) ?? '',
      database: ((c.techStack as Record<string, unknown>)?.database as string) ?? '',
      hosting: ((c.techStack as Record<string, unknown>)?.hosting as string) ?? '',
      reasoning: ((c.techStack as Record<string, unknown>)?.reasoning as string) ?? '',
    },
    team: Array.isArray(c.team) ? c.team as ProposalContent['team'] : [],
    assumptions: Array.isArray(c.assumptions) ? c.assumptions as string[] : [],
    risks: Array.isArray(c.risks) ? c.risks as ProposalContent['risks'] : [],
    terms: (c.terms as string) ?? '',
  };
}

const INR = (n: number | null | undefined) =>
  n != null ? `₹${n.toLocaleString('en-IN')}` : '—';

function statusBadge(s: string) {
  if (s === 'SENT')  return 'bg-emerald-900/50 text-emerald-400';
  if (s === 'DRAFT') return 'bg-amber-900/50 text-amber-400';
  return 'bg-slate-800 text-slate-400';
}

// ── Form UI helpers ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4 space-y-3">
      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1">
      <span className="text-[11px] text-slate-500">{label}</span>
      {hint && <span className="text-[10px] text-amber-400/80 italic">{hint}</span>}
    </div>
  );
}

// inputCls has NO w-full — flex-row inputs need flex-1+min-w-0, not w-full which breaks flex layout
const inputCls = 'bg-[#080d14] border border-[#1f2d3d] rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-600/50 placeholder:text-slate-600';
const inputFullCls = 'w-full ' + inputCls;
const textareaCls = inputFullCls + ' resize-none leading-relaxed';

function ColHeader({ cols }: { cols: string[] }) {
  return (
    <div className="flex gap-2 mb-1 px-0.5">
      {cols.map((c, i) => (
        <span key={i} className={`text-[10px] text-slate-600 ${i === 0 ? 'flex-1 min-w-0' : ''}`}>{c}</span>
      ))}
    </div>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] text-blue-400 hover:text-blue-300 border border-blue-900/40 hover:border-blue-700 px-2 py-1 rounded-md transition-colors">
      + Add
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 text-[11px] text-slate-600 hover:text-red-400 px-1.5 py-1 rounded transition-colors">
      ✕
    </button>
  );
}

// ── Proposal Form Editor ──────────────────────────────────────────────────────

function ProposalFormEditor({
  form,
  onChange,
  suggestedBudget,
  suggestedTimeline,
}: {
  form: ProposalContent;
  onChange: (f: ProposalContent) => void;
  suggestedBudget?: string;
  suggestedTimeline?: string;
}) {
  function upd(fn: (f: ProposalContent) => ProposalContent) {
    onChange(fn(form));
  }

  return (
    <div className="space-y-4">

      {/* Executive Summary */}
      <SectionCard title="Executive Summary">
        <textarea
          value={form.executiveSummary}
          onChange={e => upd(f => ({ ...f, executiveSummary: e.target.value }))}
          rows={4}
          className={textareaCls}
        />
      </SectionCard>

      {/* Pricing */}
      <SectionCard title="Pricing">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel label="Total Budget" hint={suggestedBudget ? `Client suggested: ${suggestedBudget}` : undefined} />
            <div className="flex gap-2">
              <input
                type="number"
                value={form.pricing.totalUsd}
                onChange={e => upd(f => ({ ...f, pricing: { ...f.pricing, totalUsd: Number(e.target.value) } }))}
                className={inputFullCls + ' flex-1 min-w-0'}
              />
              <select
                value={form.pricing.currency}
                onChange={e => upd(f => ({ ...f, pricing: { ...f.pricing, currency: e.target.value } }))}
                className="bg-[#080d14] border border-[#1f2d3d] rounded-lg px-2 py-2 text-xs text-slate-200 outline-none focus:border-blue-600/50 flex-shrink-0"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <FieldLabel label="Pricing Model" />
            <select
              value={form.pricing.model}
              onChange={e => upd(f => ({ ...f, pricing: { ...f.pricing, model: e.target.value as ProposalContent['pricing']['model'] } }))}
              className={inputFullCls}
            >
              <option value="fixed">Fixed Price</option>
              <option value="time_and_materials">Time & Materials</option>
              <option value="retainer">Retainer</option>
            </select>
          </div>
        </div>

        {/* Breakdown */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Cost Breakdown</span>
            <AddBtn onClick={() => upd(f => ({ ...f, pricing: { ...f.pricing, breakdown: [...f.pricing.breakdown, { item: '', costUsd: 0 }] } }))} />
          </div>
          <ColHeader cols={['Item Description', 'Amount', '']} />
          <div className="space-y-2">
            {form.pricing.breakdown.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={row.item}
                  onChange={e => upd(f => {
                    const bd = [...f.pricing.breakdown];
                    bd[i] = { ...bd[i], item: e.target.value };
                    return { ...f, pricing: { ...f.pricing, breakdown: bd } };
                  })}
                  placeholder="e.g. Frontend Development"
                  className={inputCls + ' flex-1 min-w-0'}
                />
                <input
                  type="number"
                  value={row.costUsd}
                  onChange={e => upd(f => {
                    const bd = [...f.pricing.breakdown];
                    bd[i] = { ...bd[i], costUsd: Number(e.target.value) };
                    return { ...f, pricing: { ...f.pricing, breakdown: bd } };
                  })}
                  placeholder="0"
                  className={inputCls + ' w-28 flex-shrink-0'}
                />
                <RemoveBtn onClick={() => upd(f => {
                  const bd = [...f.pricing.breakdown];
                  bd.splice(i, 1);
                  return { ...f, pricing: { ...f.pricing, breakdown: bd } };
                })} />
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Timeline */}
      <SectionCard title="Timeline">
        <div className="flex items-center justify-between mb-1">
          <FieldLabel label={`Phases${suggestedTimeline ? ` — client requested: ${suggestedTimeline}` : ''}`} />
          <AddBtn onClick={() => upd(f => ({
            ...f,
            timeline: { phases: [...f.timeline.phases, { name: '', durationWeeks: 1, deliverables: [] }] },
          }))} />
        </div>
        <ColHeader cols={['Phase Name', 'Weeks', '', '']} />
        <div className="space-y-3">
          {form.timeline.phases.map((phase, i) => (
            <div key={i} className="bg-[#080d14] border border-[#1a2535] rounded-lg p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  value={phase.name}
                  onChange={e => upd(f => {
                    const phases = [...f.timeline.phases];
                    phases[i] = { ...phases[i], name: e.target.value };
                    return { ...f, timeline: { phases } };
                  })}
                  placeholder="e.g. Design & Planning"
                  className={inputCls + ' flex-1 min-w-0'}
                />
                <input
                  type="number"
                  value={phase.durationWeeks}
                  onChange={e => upd(f => {
                    const phases = [...f.timeline.phases];
                    phases[i] = { ...phases[i], durationWeeks: Number(e.target.value) };
                    return { ...f, timeline: { phases } };
                  })}
                  placeholder="1"
                  className={inputCls + ' w-16 flex-shrink-0'}
                />
                <span className="text-[11px] text-slate-500 flex-shrink-0">wks</span>
                <RemoveBtn onClick={() => upd(f => {
                  const phases = [...f.timeline.phases];
                  phases.splice(i, 1);
                  return { ...f, timeline: { phases } };
                })} />
              </div>
              {/* Phase deliverables */}
              <div className="pl-2 border-l border-[#1f2d3d] space-y-1">
                <span className="text-[10px] text-slate-600">Deliverables in this phase:</span>
                {phase.deliverables.map((d, j) => (
                  <div key={j} className="flex gap-2 items-center">
                    <input
                      value={d}
                      onChange={e => upd(f => {
                        const phases = [...f.timeline.phases];
                        const dels = [...phases[i].deliverables];
                        dels[j] = e.target.value;
                        phases[i] = { ...phases[i], deliverables: dels };
                        return { ...f, timeline: { phases } };
                      })}
                      placeholder="Deliverable description"
                      className={inputCls + ' flex-1 min-w-0'}
                    />
                    <RemoveBtn onClick={() => upd(f => {
                      const phases = [...f.timeline.phases];
                      const dels = [...phases[i].deliverables];
                      dels.splice(j, 1);
                      phases[i] = { ...phases[i], deliverables: dels };
                      return { ...f, timeline: { phases } };
                    })} />
                  </div>
                ))}
                <button
                  onClick={() => upd(f => {
                    const phases = [...f.timeline.phases];
                    phases[i] = { ...phases[i], deliverables: [...phases[i].deliverables, ''] };
                    return { ...f, timeline: { phases } };
                  })}
                  className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors"
                >
                  + add deliverable
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          Total: <strong className="text-slate-300">{form.timeline.phases.reduce((s, p) => s + p.durationWeeks, 0)} weeks</strong>
        </p>
      </SectionCard>

      {/* Tech Stack */}
      <SectionCard title="Tech Stack">
        <div className="grid grid-cols-2 gap-3">
          {(['frontend', 'backend', 'database', 'hosting'] as const).map(key => (
            <div key={key}>
              <FieldLabel label={key.charAt(0).toUpperCase() + key.slice(1)} />
              <input
                value={form.techStack[key]}
                onChange={e => upd(f => ({ ...f, techStack: { ...f.techStack, [key]: e.target.value } }))}
                className={inputFullCls}
              />
            </div>
          ))}
        </div>
        <div>
          <FieldLabel label="Reasoning" />
          <textarea
            value={form.techStack.reasoning}
            onChange={e => upd(f => ({ ...f, techStack: { ...f.techStack, reasoning: e.target.value } }))}
            rows={2}
            className={textareaCls}
          />
        </div>
      </SectionCard>

      {/* Scope */}
      <SectionCard title="Scope">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-emerald-500/80">✓ Included</span>
              <AddBtn onClick={() => upd(f => ({ ...f, scope: { ...f.scope, included: [...f.scope.included, ''] } }))} />
            </div>
            <div className="space-y-1.5">
              {form.scope.included.map((item, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    value={item}
                    onChange={e => upd(f => {
                      const included = [...f.scope.included];
                      included[i] = e.target.value;
                      return { ...f, scope: { ...f.scope, included } };
                    })}
                    placeholder="Included item"
                    className={inputCls + ' flex-1 min-w-0'}
                  />
                  <RemoveBtn onClick={() => upd(f => {
                    const included = [...f.scope.included];
                    included.splice(i, 1);
                    return { ...f, scope: { ...f.scope, included } };
                  })} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-red-400/80">✕ Excluded</span>
              <AddBtn onClick={() => upd(f => ({ ...f, scope: { ...f.scope, excluded: [...f.scope.excluded, ''] } }))} />
            </div>
            <div className="space-y-1.5">
              {form.scope.excluded.map((item, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    value={item}
                    onChange={e => upd(f => {
                      const excluded = [...f.scope.excluded];
                      excluded[i] = e.target.value;
                      return { ...f, scope: { ...f.scope, excluded } };
                    })}
                    placeholder="Excluded item"
                    className={inputCls + ' flex-1 min-w-0'}
                  />
                  <RemoveBtn onClick={() => upd(f => {
                    const excluded = [...f.scope.excluded];
                    excluded.splice(i, 1);
                    return { ...f, scope: { ...f.scope, excluded } };
                  })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Team */}
      <SectionCard title="Team">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-600">Role · Count · Allocation %</span>
          <AddBtn onClick={() => upd(f => ({ ...f, team: [...f.team, { role: '', count: 1, allocationPct: 100 }] }))} />
        </div>
        <ColHeader cols={['Role', 'Count', 'Alloc %', '', '']} />
        <div className="space-y-2">
          {form.team.map((member, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={member.role}
                onChange={e => upd(f => {
                  const team = [...f.team];
                  team[i] = { ...team[i], role: e.target.value };
                  return { ...f, team };
                })}
                placeholder="e.g. Frontend Developer"
                className={inputCls + ' flex-1 min-w-0'}
              />
              <input
                type="number"
                value={member.count}
                onChange={e => upd(f => {
                  const team = [...f.team];
                  team[i] = { ...team[i], count: Number(e.target.value) };
                  return { ...f, team };
                })}
                placeholder="1"
                className={inputCls + ' w-14 flex-shrink-0'}
              />
              <input
                type="number"
                value={member.allocationPct}
                onChange={e => upd(f => {
                  const team = [...f.team];
                  team[i] = { ...team[i], allocationPct: Number(e.target.value) };
                  return { ...f, team };
                })}
                placeholder="100"
                className={inputCls + ' w-16 flex-shrink-0'}
              />
              <span className="text-[11px] text-slate-600 flex-shrink-0">%</span>
              <RemoveBtn onClick={() => upd(f => {
                const team = [...f.team];
                team.splice(i, 1);
                return { ...f, team };
              })} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Deliverables */}
      <SectionCard title="Deliverables">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-600">Name · Milestone (e.g. "Week 2") · Description</span>
          <AddBtn onClick={() => upd(f => ({ ...f, deliverables: [...f.deliverables, { name: '', description: '', milestone: '' }] }))} />
        </div>
        <ColHeader cols={['Deliverable Name', 'Milestone', '']} />
        <div className="space-y-2">
          {form.deliverables.map((d, i) => (
            <div key={i} className="bg-[#080d14] border border-[#1a2535] rounded-lg p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  value={d.name}
                  onChange={e => upd(f => {
                    const deliverables = [...f.deliverables];
                    deliverables[i] = { ...deliverables[i], name: e.target.value };
                    return { ...f, deliverables };
                  })}
                  placeholder="e.g. Android Application Build"
                  className={inputCls + ' flex-1 min-w-0'}
                />
                <input
                  value={d.milestone}
                  onChange={e => upd(f => {
                    const deliverables = [...f.deliverables];
                    deliverables[i] = { ...deliverables[i], milestone: e.target.value };
                    return { ...f, deliverables };
                  })}
                  placeholder="Week 2"
                  className={inputCls + ' w-24 flex-shrink-0'}
                />
                <RemoveBtn onClick={() => upd(f => {
                  const deliverables = [...f.deliverables];
                  deliverables.splice(i, 1);
                  return { ...f, deliverables };
                })} />
              </div>
              <textarea
                value={d.description}
                onChange={e => upd(f => {
                  const deliverables = [...f.deliverables];
                  deliverables[i] = { ...deliverables[i], description: e.target.value };
                  return { ...f, deliverables };
                })}
                rows={2}
                placeholder="What this deliverable includes…"
                className={textareaCls}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Assumptions */}
      <SectionCard title="Assumptions">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-600">Things assumed to be true for this proposal</span>
          <AddBtn onClick={() => upd(f => ({ ...f, assumptions: [...f.assumptions, ''] }))} />
        </div>
        <div className="space-y-1.5">
          {form.assumptions.map((a, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={a}
                onChange={e => upd(f => {
                  const assumptions = [...f.assumptions];
                  assumptions[i] = e.target.value;
                  return { ...f, assumptions };
                })}
                placeholder="e.g. Client provides all content and assets"
                className={inputCls + ' flex-1 min-w-0'}
              />
              <RemoveBtn onClick={() => upd(f => {
                const assumptions = [...f.assumptions];
                assumptions.splice(i, 1);
                return { ...f, assumptions };
              })} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Risks */}
      <SectionCard title="Risks">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-600">Severity · Description · Mitigation</span>
          <AddBtn onClick={() => upd(f => ({ ...f, risks: [...f.risks, { description: '', severity: 'MEDIUM' as const, mitigation: '' }] }))} />
        </div>
        <div className="space-y-2">
          {form.risks.map((risk, i) => (
            <div key={i} className="bg-[#080d14] border border-[#1a2535] rounded-lg p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <select
                  value={risk.severity}
                  onChange={e => upd(f => {
                    const risks = [...f.risks];
                    risks[i] = { ...risks[i], severity: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' };
                    return { ...f, risks };
                  })}
                  className="bg-[#0d1420] border border-[#1f2d3d] rounded-lg px-2 py-2 text-xs text-slate-200 outline-none focus:border-blue-600/50 w-24 flex-shrink-0"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
                <input
                  value={risk.description}
                  onChange={e => upd(f => {
                    const risks = [...f.risks];
                    risks[i] = { ...risks[i], description: e.target.value };
                    return { ...f, risks };
                  })}
                  placeholder="e.g. Third-party API downtime"
                  className={inputCls + ' flex-1 min-w-0'}
                />
                <RemoveBtn onClick={() => upd(f => {
                  const risks = [...f.risks];
                  risks.splice(i, 1);
                  return { ...f, risks };
                })} />
              </div>
              <input
                value={risk.mitigation}
                onChange={e => upd(f => {
                  const risks = [...f.risks];
                  risks[i] = { ...risks[i], mitigation: e.target.value };
                  return { ...f, risks };
                })}
                placeholder="Mitigation strategy…"
                className={inputFullCls}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Terms */}
      <SectionCard title="Terms & Conditions">
        <textarea
          value={form.terms}
          onChange={e => upd(f => ({ ...f, terms: e.target.value }))}
          rows={3}
          className={textareaCls}
        />
      </SectionCard>

    </div>
  );
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
  const [editForm, setEditForm]   = useState<ProposalContent | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJson, setRawJson]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [sending, setSending]     = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    setLoadingDet(true); setFeedback(null); setShowRawJson(false);
    try {
      const r = await fetch(`/api/admin/proposals/${id}`, { headers: { 'x-admin-password': PW } });
      const d = await r.json();
      setSelected(d.proposal);
      const normalized = normalizeContent(d.proposal.content);
      setEditForm(normalized);
      setRawJson(JSON.stringify(normalized, null, 2));
    } finally { setLoadingDet(false); }
  }

  function toggleRawJson() {
    if (!showRawJson) {
      // switching to raw — serialize current form state
      setRawJson(JSON.stringify(editForm, null, 2));
    } else {
      // switching back to form — try to parse raw
      try {
        setEditForm(JSON.parse(rawJson));
      } catch {
        setFeedback('✗ Invalid JSON — cannot switch back to form view');
        return;
      }
    }
    setShowRawJson(v => !v);
  }

  async function saveEdits() {
    if (!selected) return;
    setSaving(true); setFeedback(null);
    try {
      let content: ProposalContent;
      if (showRawJson) {
        content = JSON.parse(rawJson);
        setEditForm(content);
      } else {
        content = editForm!;
      }
      await fetch(`/api/admin/proposals/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': PW },
        body: JSON.stringify({ content }),
      });
      setFeedback('✓ Saved');
    } catch { setFeedback('✗ Save failed — check for invalid values'); }
    finally { setSaving(false); }
  }

  async function deleteProposal() {
    if (!selected || deleting) return;
    setDeleting(true); setFeedback(null);
    try {
      const r = await fetch(`/api/admin/proposals/${selected.id}`, {
        method: 'DELETE', headers: { 'x-admin-password': PW },
      });
      if (!r.ok) throw new Error('Delete failed');
      setSelected(null);
      setEditForm(null);
      setConfirmDelete(false);
      fetchList();
    } catch {
      setFeedback('✗ Delete failed');
    } finally { setDeleting(false); }
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

  // Derive user-suggested budget/timeline from requirements
  const reqBudget = (() => {
    const br = selected?.analysis?.requirements?.budgetRange as { min?: number; max?: number; currency?: string } | null;
    if (!br) return undefined;
    const { min, max, currency = 'INR' } = br;
    if (min != null && max != null) return `${currency} ${min.toLocaleString()} – ${max.toLocaleString()}`;
    if (min != null) return `${currency} ${min.toLocaleString()}+`;
    if (max != null) return `up to ${currency} ${max.toLocaleString()}`;
    return undefined;
  })();
  const reqTimeline = selected?.analysis?.requirements?.timelineExpectation as string | undefined;

  // ── Password gate ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="bg-[#0f1724] border border-[#1e2d40] rounded-2xl p-8 w-full max-w-sm space-y-5">
          <div className="text-center">
            <span className="text-3xl">👻</span>
            <h1 className="text-lg font-bold text-slate-100 mt-2">Admin Access</h1>
            <p className="text-xs text-slate-500 mt-1">CheatGPT · DealGhost Dashboard</p>
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
          <p className="text-[11px] text-slate-600 text-center">Password: 123456</p>
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
            CheatGPT
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

          {selected && editForm && !loadingDet && (
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
                <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
                  {feedback && (
                    <span className={`text-xs ${feedback.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                      {feedback}
                    </span>
                  )}
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400">Delete this proposal?</span>
                      <button
                        onClick={deleteProposal}
                        disabled={deleting}
                        className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 text-xs bg-[#1a2535] border border-[#2a3d52] text-slate-400 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="px-3 py-1.5 text-xs bg-[#1a2535] border border-red-900/50 hover:border-red-600 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
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
                  { label: `Total (${editForm.pricing.currency})`, value: INR(editForm.pricing.totalUsd) },
                  { label: 'Timeline', value: `${editForm.timeline.phases.reduce((s, p) => s + p.durationWeeks, 0)} weeks` },
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

              {/* Proposal Editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Proposal Content
                  </h3>
                  <button
                    onClick={toggleRawJson}
                    className="text-[11px] text-slate-500 hover:text-slate-300 border border-[#1f2d3d] hover:border-slate-600 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {showRawJson ? 'Form View' : 'Raw JSON'}
                  </button>
                </div>

                {showRawJson ? (
                  <div className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                    <textarea
                      value={rawJson}
                      onChange={(e) => setRawJson(e.target.value)}
                      rows={28}
                      spellCheck={false}
                      className="w-full bg-[#080d14] border border-[#1f2d3d] rounded-lg p-3 text-xs font-mono text-slate-300 outline-none focus:border-blue-600/50 resize-none leading-relaxed"
                    />
                  </div>
                ) : (
                  <ProposalFormEditor
                    form={editForm}
                    onChange={setEditForm}
                    suggestedBudget={reqBudget}
                    suggestedTimeline={reqTimeline}
                  />
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
