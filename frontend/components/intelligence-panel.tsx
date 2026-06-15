'use client';

import React from 'react';

import { ProjectRequirementState } from '@/types/project';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IntelligencePanelProps {
  state: ProjectRequirementState | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function formatBudget(budgetRange: ProjectRequirementState['budgetRange']): string | null {
  if (budgetRange.raw) return budgetRange.raw;
  if (budgetRange.min != null) {
    const curr = budgetRange.currency ?? 'INR';
    const minStr = budgetRange.min.toLocaleString('en-IN');
    if (budgetRange.max != null && budgetRange.max !== budgetRange.min) {
      return `${curr} ${minStr} – ${budgetRange.max.toLocaleString('en-IN')}`;
    }
    return `${curr} ${minStr}`;
  }
  return null;
}

function camelToLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

// ─── Mini score bar (raw div, not Progress component) ───────────────────────

function MiniBar({
  value,
  max = 20,
  colorClass = 'bg-emerald-500',
}: {
  value: number;
  max?: number;
  colorClass?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
        <span className="text-3xl">🧠</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-300 mb-1">Project Intelligence</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        As you describe your project, structured intelligence will appear here in real-time.
      </p>
    </div>
  );
}

// ─── Completeness Card ───────────────────────────────────────────────────────

function CompletenessCard({ state }: { state: ProjectRequirementState }) {
  const { inferredComplexity, completenessScore } = state;

  return (
    <Card className="bg-emerald-950/20 border border-emerald-900/50">
      <CardHeader>
        <CardTitle className="text-xs font-bold text-slate-200 uppercase tracking-widest">
          Completeness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className={cn('text-2xl font-bold tabular-nums', scoreColor(completenessScore))}>
              {completenessScore}%
            </span>
          </div>
          <Progress value={completenessScore} className="[&_[data-slot=progress-track]]:bg-slate-800 [&_[data-slot=progress-indicator]]:bg-emerald-500" />
        </div>
        {inferredComplexity && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Complexity</span>
            <Badge className={cn(
              inferredComplexity === 'SIMPLE' ? 'bg-emerald-900/60 text-emerald-300 border-emerald-800' :
              inferredComplexity === 'STANDARD' ? 'bg-blue-900/60 text-blue-300 border-blue-800' :
              inferredComplexity === 'COMPLEX' ? 'bg-amber-900/60 text-amber-300 border-amber-800' :
              'bg-red-900/60 text-red-300 border-red-800'
            )}>
              {inferredComplexity}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Project Details Card ────────────────────────────────────────────────────

function ProjectDetailsCard({ state }: { state: ProjectRequirementState }) {
  return (
    <Card className="bg-[#111827] border border-[#1f2d3d]">
      <CardHeader>
        <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Project Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Type + Industry badges */}
        {(state.projectType || state.industry) && (
          <div className="flex flex-wrap gap-1.5">
            {state.projectType && (
              <Badge variant="outline" className="border-slate-700 text-slate-300 capitalize">
                {state.projectType.replace('_', ' ')}
              </Badge>
            )}
            {state.industry && (
              <Badge variant="outline" className="border-slate-700 text-slate-300 capitalize">
                {state.industry}
              </Badge>
            )}
          </div>
        )}

        {/* Project name */}
        {state.projectName && (
          <p className="text-sm font-semibold text-slate-200">{state.projectName}</p>
        )}

        {/* Description */}
        {state.description && (
          <p className="text-xs text-slate-400 leading-relaxed">{state.description}</p>
        )}

        {/* Platforms */}
        {state.platforms.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Platforms</p>
            <div className="flex flex-wrap gap-1">
              {state.platforms.map((p) => (
                <span
                  key={p}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 capitalize"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Target users + scale */}
        {(state.targetUsers || state.userScale) && (
          <div className="space-y-1.5">
            {state.targetUsers && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Target Users</p>
                <p className="text-xs text-slate-300 mt-0.5">{state.targetUsers}</p>
              </div>
            )}
            {state.userScale && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Scale</p>
                <p className="text-xs text-slate-300 mt-0.5">{state.userScale}</p>
              </div>
            )}
          </div>
        )}

        {!(state.projectType || state.industry || state.projectName || state.description || state.platforms.length > 0 || state.targetUsers || state.userScale) && (
          <p className="text-xs text-slate-600">Project details will populate as you chat.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Qualification Card ───────────────────────────────────────────────────────

function QualificationCard({ state }: { state: ProjectRequirementState }) {
  const budget = formatBudget(state.budgetRange);
  const timeline = state.timelineExpectation;

  return (
    <Card className="bg-[#111827] border border-[#1f2d3d]">
      <CardHeader>
        <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Qualification
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* Budget box */}
          <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 p-3">
            <p className="text-[10px] text-emerald-500 uppercase tracking-wide mb-1">Budget</p>
            {budget ? (
              <p className="text-xs font-semibold text-emerald-300">{budget}</p>
            ) : (
              <p className="text-xs text-slate-600">—</p>
            )}
          </div>

          {/* Timeline box */}
          <div className="rounded-lg bg-blue-950/30 border border-blue-900/40 p-3">
            <p className="text-[10px] text-blue-500 uppercase tracking-wide mb-1">Timeline</p>
            {timeline ? (
              <p className="text-xs font-semibold text-blue-300">{timeline}</p>
            ) : (
              <p className="text-xs text-slate-600">—</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Missing Info Card ────────────────────────────────────────────────────────

function MissingInfoCard({ state }: { state: ProjectRequirementState }) {
  const items = state.missingInformation;

  return (
    <Card className="bg-red-950/20 border border-red-900/50">
      <CardHeader>
        <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Still Needed {items.length > 0 && <span className="text-red-400">({items.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-slate-600">No missing information detected yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  item.priority === 'HIGH' ? 'bg-red-400' :
                  item.priority === 'MEDIUM' ? 'bg-amber-400' :
                  'bg-slate-500'
                )} />
                <span className={cn(
                  'text-xs',
                  item.priority === 'HIGH' ? 'text-red-300' :
                  item.priority === 'MEDIUM' ? 'text-amber-300' :
                  'text-slate-400'
                )}>
                  {item.field}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ state }: { state: ProjectRequirementState }) {
  return (
    <div className="space-y-4">
      <CompletenessCard state={state} />
      <ProjectDetailsCard state={state} />
      <QualificationCard state={state} />
    </div>
  );
}

// ─── Features Tab ─────────────────────────────────────────────────────────────

function FeaturesTab({ state }: { state: ProjectRequirementState }) {
  const { features, clientTechPreferences: tech } = state;

  const techEntries: { label: string; value: string }[] = [];
  if (tech) {
    if (tech.frontend)  techEntries.push({ label: 'Frontend', value: tech.frontend });
    if (tech.backend)   techEntries.push({ label: 'Backend',  value: tech.backend });
    if (tech.database)  techEntries.push({ label: 'Database', value: tech.database });
    if (tech.hosting)   techEntries.push({ label: 'Hosting',  value: tech.hosting });
    tech.existingSystems?.forEach(s => techEntries.push({ label: 'Existing', value: s }));
  }

  if (features.length === 0 && techEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-3xl mb-3">📋</span>
        <p className="text-sm text-slate-400">No features identified yet.</p>
        <p className="text-xs text-slate-600 mt-1">Describe what your project should do.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Tech preferences — client-specified tools */}
      {techEntries.length > 0 && (
        <>
          {techEntries.map((entry, i) => (
            <Card key={`tech-${i}`} className="bg-[#0d1f35] border border-blue-900/40">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <Badge className="flex-shrink-0 text-[10px] bg-blue-900/60 text-blue-300 border-blue-800">
                    CLIENT CHOICE
                  </Badge>
                  <p className="text-xs font-medium text-slate-200 min-w-0">
                    {entry.value}
                    <span className="text-slate-500 font-normal ml-1">({entry.label})</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          {tech?.avoid && tech.avoid.length > 0 && tech.avoid.map((t, i) => (
            <Card key={`avoid-${i}`} className="bg-[#1a0d0d] border border-red-900/40">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <Badge className="flex-shrink-0 text-[10px] bg-red-900/60 text-red-300 border-red-800">
                    AVOID
                  </Badge>
                  <p className="text-xs font-medium text-slate-200 min-w-0">{t}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {features.length > 0 && <div className="border-t border-slate-800/60 pt-1" />}
        </>
      )}

      {features.map((feature, i) => (
        <Card key={i} className="bg-[#111827] border border-[#1f2d3d]">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <Badge className={cn(
                'flex-shrink-0 mt-0.5 text-[10px]',
                feature.priority === 'MUST' ? 'bg-red-900/60 text-red-300 border-red-800' :
                feature.priority === 'SHOULD' ? 'bg-amber-900/60 text-amber-300 border-amber-800' :
                'bg-slate-800 text-slate-400 border-slate-700'
              )}>
                {feature.priority}
              </Badge>
              <p className="text-xs font-medium text-slate-200 capitalize min-w-0">
                {(feature.canonicalName ?? feature.canonicalId).replace(/_/g, ' ')}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Proposal Tab ─────────────────────────────────────────────────────────────

function ProposalTab({ state }: { state: ProjectRequirementState }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <span className="text-3xl mb-3">📄</span>
      <p className="text-sm font-medium text-slate-300 mb-1">Proposal Not Ready</p>
      <p className="text-xs text-slate-500 leading-relaxed">
        Use the Generate Proposal button at 60%+ completeness.
        {state.completenessScore > 0 && (
          <span className="block mt-1 text-slate-400">
            Current:{' '}
            <span className={cn('font-semibold', scoreColor(state.completenessScore))}>
              {state.completenessScore}%
            </span>
          </span>
        )}
      </p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function IntelligencePanel({ state }: IntelligencePanelProps) {
  const hasData = state && (
    state.projectType !== null ||
    state.platforms.length > 0 ||
    state.features.length > 0 ||
    state.description !== null
  );

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-slate-200">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-[#0d1117] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-200 tracking-wider uppercase">
              ⚡ LIVE INTELLIGENCE
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Real-time project extraction</p>
          </div>
          {state && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${state.completenessScore}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
                {state.completenessScore}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {!hasData ? (
          <EmptyState />
        ) : (
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            {/* Tab List */}
            <div className="px-5 pt-3 flex-shrink-0">
              <TabsList className="bg-slate-800/60 border border-slate-700/50 w-full">
                <TabsTrigger value="overview" className="flex-1 text-xs">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="features" className="flex-1 text-xs">
                  Features
                  {state.features.length > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">({state.features.length})</span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Panels */}
            <TabsContent value="overview" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-5 py-4">
                  <OverviewTab state={state} />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="features" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-5 py-4">
                  <FeaturesTab state={state} />
                </div>
              </ScrollArea>
            </TabsContent>

          </Tabs>
        )}
      </div>
    </div>
  );
}
