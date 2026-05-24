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
