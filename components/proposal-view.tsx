'use client';

import { ProposalContent } from '@/types/proposal';
import { cn } from '@/lib/utils';
import { X, Clock, DollarSign, Users, Layers, CheckCircle, AlertCircle } from 'lucide-react';

interface ProposalViewProps {
  proposal: ProposalContent;
  projectName?: string | null;
  onClose: () => void;
}

function Section({ title, icon, children }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-violet-500">{icon}</span>}
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function ProposalView({ proposal, projectName, onClose }: ProposalViewProps) {
  const totalWeeks = proposal.timeline.phases.reduce((s, p) => s + p.durationWeeks, 0);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-100 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-widest">
              Proposal
            </span>
            <span className="text-[10px] text-zinc-300">·</span>
            <span className="text-[10px] text-zinc-400 capitalize">
              {proposal.pricing.model.replace('_', ' ')}
            </span>
          </div>
          <h1 className="text-base font-bold text-zinc-900">
            {projectName ?? 'Project Proposal'}
          </h1>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* KPI Bar */}
      <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-100 grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-violet-500" />
          <div>
            <p className="text-[10px] text-zinc-400">Total Investment</p>
            <p className="text-sm font-bold text-zinc-800">{formatUsd(proposal.pricing.totalUsd)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-violet-500" />
          <div>
            <p className="text-[10px] text-zinc-400">Timeline</p>
            <p className="text-sm font-bold text-zinc-800">{totalWeeks} weeks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users size={14} className="text-violet-500" />
          <div>
            <p className="text-[10px] text-zinc-400">Team Size</p>
            <p className="text-sm font-bold text-zinc-800">
              {proposal.team.reduce((s, m) => s + m.count, 0)} people
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

        {/* Executive Summary */}
        <Section title="Executive Summary">
          <p className="text-sm text-zinc-600 leading-relaxed bg-zinc-50 rounded-xl p-4 border border-zinc-100">
            {proposal.executiveSummary}
          </p>
        </Section>

        {/* Scope */}
        <Section title="Scope of Work" icon={<Layers size={14} />}>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                Included
              </p>
              <ul className="space-y-1.5">
                {proposal.scope.included.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-800">
                    <CheckCircle size={11} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Excluded
              </p>
              <ul className="space-y-1.5">
                {proposal.scope.excluded.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-500">
                    <AlertCircle size={11} className="mt-0.5 flex-shrink-0 text-zinc-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Timeline */}
        <Section title="Project Timeline" icon={<Clock size={14} />}>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-200" />
            <div className="space-y-3">
              {proposal.timeline.phases.map((phase, i) => (
                <div key={i} className="flex gap-4 pl-8 relative">
                  <div className="absolute left-1.5 top-2.5 w-3 h-3 rounded-full bg-violet-500 border-2 border-white ring-2 ring-violet-100" />
                  <div className="flex-1 bg-white rounded-xl border border-zinc-100 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-zinc-800">{phase.name}</p>
                      <span className="text-xs text-zinc-400">{phase.durationWeeks}w</span>
                    </div>
                    <ul className="space-y-0.5">
                      {phase.deliverables.map((d, j) => (
                        <li key={j} className="text-xs text-zinc-500 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-zinc-300 flex-shrink-0" />
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

        {/* Pricing */}
        <Section title="Investment Breakdown" icon={<DollarSign size={14} />}>
          <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">Item</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {proposal.pricing.breakdown.map((item, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-700">{item.item}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-zinc-800 tabular-nums">
                      {formatUsd(item.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                  <td className="px-4 py-3 font-bold text-zinc-900">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-violet-700 text-sm tabular-nums">
                    {formatUsd(proposal.pricing.totalUsd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        {/* Tech Stack */}
        <Section title="Recommended Tech Stack" icon={<Layers size={14} />}>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(proposal.techStack).map(([key, value]) => (
              <div key={key} className="bg-zinc-50 rounded-lg border border-zinc-100 px-3 py-2.5">
                <p className="text-[10px] text-zinc-400 capitalize mb-0.5">{key}</p>
                <p className="text-xs font-semibold text-zinc-800">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Team */}
        <Section title="Team Composition" icon={<Users size={14} />}>
          <div className="grid grid-cols-2 gap-2">
            {proposal.team.map((member, i) => (
              <div key={i} className="bg-white rounded-lg border border-zinc-100 px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-800">{member.role}</p>
                  <p className="text-[10px] text-zinc-400">{member.allocationPct}% allocation</p>
                </div>
                <span className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-xs font-bold text-violet-700">
                  {member.count}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Assumptions */}
        {proposal.assumptions.length > 0 && (
          <Section title="Assumptions">
            <ul className="space-y-1.5">
              {proposal.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                  <span className="text-zinc-300 mt-0.5">—</span>
                  {a}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Terms */}
        <Section title="Terms & Conditions">
          <p className="text-xs text-zinc-500 leading-relaxed bg-zinc-50 rounded-xl p-4 border border-zinc-100">
            {proposal.terms}
          </p>
        </Section>
      </div>
    </div>
  );
}
