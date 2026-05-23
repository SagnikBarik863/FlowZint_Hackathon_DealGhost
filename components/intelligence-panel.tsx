'use client';

import { ProjectRequirementState } from '@/types/project';
import { cn } from '@/lib/utils';

interface IntelligencePanelProps {
  state: ProjectRequirementState | null;
}

const complexityColors = {
  SIMPLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  STANDARD: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLEX: 'bg-amber-50 text-amber-700 border-amber-200',
  ENTERPRISE: 'bg-red-50 text-red-700 border-red-200',
};

const priorityColors = {
  MUST: 'bg-red-50 text-red-600 border-red-100',
  SHOULD: 'bg-amber-50 text-amber-600 border-amber-100',
  COULD: 'bg-zinc-50 text-zinc-500 border-zinc-200',
};

function scoreColor(score: number) {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function ScoreBar({ value, max = 20 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-violet-400 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
        <span className="text-3xl">🧠</span>
      </div>
      <h3 className="text-sm font-semibold text-zinc-600 mb-1">Project Intelligence</h3>
      <p className="text-xs text-zinc-400 leading-relaxed">
        As you describe your project, structured intelligence will appear here in real-time.
      </p>
    </div>
  );
}

export function IntelligencePanel({ state }: IntelligencePanelProps) {
  const hasData = state && (
    state.projectType ||
    state.platforms.length > 0 ||
    state.features.length > 0 ||
    state.description
  );

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 tracking-wide uppercase">
              Project Intelligence
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Live extraction from conversation</p>
          </div>
          {state && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-700"
                  style={{ width: `${state.completenessScore}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-violet-600 tabular-nums">
                {state.completenessScore}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            {/* Project Overview */}
            {(state.projectType || state.projectName || state.description || state.industry) && (
              <Section title="Project">
                <div className="bg-white rounded-xl border border-zinc-100 p-4 space-y-3">
                  <div className="flex items-start gap-2 flex-wrap">
                    {state.projectType && (
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-100 capitalize">
                        {state.projectType.replace('_', ' ')}
                      </span>
                    )}
                    {state.industry && (
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-zinc-50 text-zinc-600 border border-zinc-100 capitalize">
                        {state.industry}
                      </span>
                    )}
                    {state.inferredComplexity && (
                      <span className={cn(
                        'text-xs font-semibold px-2 py-1 rounded-md border capitalize',
                        complexityColors[state.inferredComplexity],
                      )}>
                        {state.inferredComplexity}
                      </span>
                    )}
                  </div>
                  {state.projectName && (
                    <p className="text-sm font-semibold text-zinc-800">{state.projectName}</p>
                  )}
                  {state.description && (
                    <p className="text-xs text-zinc-500 leading-relaxed">{state.description}</p>
                  )}
                </div>
              </Section>
            )}

            {/* Platforms */}
            {state.platforms.length > 0 && (
              <Section title="Platforms">
                <div className="flex flex-wrap gap-1.5">
                  {state.platforms.map((p) => (
                    <span
                      key={p}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-700 capitalize"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Features */}
            {state.features.length > 0 && (
              <Section title={`Features (${state.features.length})`}>
                <div className="space-y-1.5">
                  {state.features.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 bg-white rounded-lg border border-zinc-100 px-3 py-2"
                    >
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5',
                        priorityColors[f.priority],
                      )}>
                        {f.priority}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-800 truncate">{f.name}</p>
                        {f.description && (
                          <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                            {f.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Integrations */}
            {state.integrations.length > 0 && (
              <Section title="Integrations">
                <div className="flex flex-wrap gap-1.5">
                  {state.integrations.map((i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-600"
                    >
                      {i}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Technical Requirements */}
            {(state.authRequirements || state.realtimeRequirements || state.adminPanelRequirements) && (
              <Section title="Technical Requirements">
                <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-50">
                  {state.authRequirements && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Auth</p>
                      <p className="text-xs text-zinc-700 mt-0.5">{state.authRequirements}</p>
                    </div>
                  )}
                  {state.realtimeRequirements && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Realtime</p>
                      <p className="text-xs text-zinc-700 mt-0.5">{state.realtimeRequirements}</p>
                    </div>
                  )}
                  {state.adminPanelRequirements && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Admin</p>
                      <p className="text-xs text-zinc-700 mt-0.5">{state.adminPanelRequirements}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Business Context */}
            {(state.targetUsers || state.userScale) && (
              <Section title="Business Context">
                <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-50">
                  {state.targetUsers && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Target Users</p>
                      <p className="text-xs text-zinc-700 mt-0.5">{state.targetUsers}</p>
                    </div>
                  )}
                  {state.userScale && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Expected Scale</p>
                      <p className="text-xs text-zinc-700 mt-0.5">{state.userScale}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Timeline & Budget */}
            {(state.timelineExpectation || state.budgetRange.raw || state.budgetRange.min) && (
              <Section title="Constraints">
                <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-50">
                  {state.timelineExpectation && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Timeline</p>
                      <p className="text-xs text-zinc-700 mt-0.5">{state.timelineExpectation}</p>
                    </div>
                  )}
                  {(state.budgetRange.raw || state.budgetRange.min) && (
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Budget</p>
                      <p className="text-xs text-zinc-700 mt-0.5">
                        {state.budgetRange.raw ??
                          `${state.budgetRange.currency} ${state.budgetRange.min?.toLocaleString()}${state.budgetRange.max ? ` – ${state.budgetRange.max.toLocaleString()}` : '+'}`}
                      </p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Recommended Stack */}
            {Object.keys(state.recommendedTechStack).length > 0 && (
              <Section title="Recommended Stack">
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(state.recommendedTechStack)
                    .filter(([, v]) => v && !Array.isArray(v))
                    .map(([key, value]) => (
                      <div key={key} className="bg-white rounded-lg border border-zinc-100 px-3 py-2">
                        <p className="text-[10px] text-zinc-400 capitalize">{key}</p>
                        <p className="text-xs font-medium text-zinc-700 truncate">{value as string}</p>
                      </div>
                    ))}
                </div>
              </Section>
            )}

            {/* Lead Score */}
            {state.leadScore && (
              <Section title="Lead Intelligence">
                <div className="bg-white rounded-xl border border-zinc-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('text-2xl font-bold tabular-nums', scoreColor(state.leadScore.score))}>
                      {state.leadScore.score}
                      <span className="text-sm font-normal text-zinc-400">/100</span>
                    </span>
                    <span className={cn(
                      'text-xs font-semibold px-2 py-1 rounded-lg',
                      state.leadScore.score >= 70
                        ? 'bg-emerald-50 text-emerald-700'
                        : state.leadScore.score >= 40
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700',
                    )}>
                      {state.leadScore.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(state.leadScore.breakdown).map(([key, val]) => (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-zinc-400 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </span>
                          <span className="text-[10px] font-semibold text-zinc-600">{val}/20</span>
                        </div>
                        <ScoreBar value={val} max={20} />
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {/* Missing Information */}
            {state.missingInformation.length > 0 && (
              <Section title={`Still Needed (${state.missingInformation.length})`}>
                <div className="space-y-1.5">
                  {state.missingInformation.slice(0, 5).map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-zinc-100"
                    >
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        item.priority === 'HIGH' ? 'bg-red-400' :
                        item.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-zinc-300',
                      )} />
                      <span className="text-xs text-zinc-500">{item.field}</span>
                    </div>
                  ))}
                  {state.missingInformation.length > 5 && (
                    <p className="text-xs text-zinc-400 text-center py-1">
                      +{state.missingInformation.length - 5} more
                    </p>
                  )}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
