import { ProjectRequirementState, MissingField, ComplexityLevel } from '@/types/project';

// Fields that are required for a complete project state
const REQUIRED_FIELDS: Array<{ field: keyof ProjectRequirementState; label: string; priority: MissingField['priority'] }> = [
  { field: 'projectType',           label: 'Project type (web app, mobile, API, etc.)',   priority: 'HIGH' },
  { field: 'description',           label: 'Project description and core purpose',         priority: 'HIGH' },
  { field: 'platforms',             label: 'Target platforms (web, iOS, Android)',          priority: 'HIGH' },
  { field: 'features',              label: 'Core features list',                            priority: 'HIGH' },
  { field: 'targetUsers',           label: 'Target users / customer segment',              priority: 'HIGH' },
  { field: 'authRequirements',      label: 'Authentication requirements',                  priority: 'MEDIUM' },
  { field: 'realtimeRequirements',  label: 'Realtime / live update requirements',          priority: 'MEDIUM' },
  { field: 'adminPanelRequirements','label': 'Admin panel / dashboard requirements',        priority: 'MEDIUM' },
  { field: 'integrations',          label: 'Third-party integrations (payment, maps, etc.)', priority: 'MEDIUM' },
  { field: 'timelineExpectation',   label: 'Expected timeline or launch date',             priority: 'MEDIUM' },
  { field: 'userScale',             label: 'Expected user scale at launch',                priority: 'LOW' },
  { field: 'budgetRange',           label: 'Budget range or constraints',                  priority: 'LOW' },
  { field: 'technicalConstraints',  label: 'Technical constraints or existing systems',    priority: 'LOW' },
];

// Merge a partial extraction result into the current state.
// Existing values are never overwritten with null/undefined.
// Arrays are merged (deduplicated), not replaced.
export function mergeState(
  current: ProjectRequirementState,
  extracted: Partial<ProjectRequirementState> & { featuresToRemove?: string[] },
): ProjectRequirementState {
  const next = { ...current };

  // Handle explicit feature removals first (user said "remove X")
  if (extracted.featuresToRemove && extracted.featuresToRemove.length > 0) {
    const toRemove = new Set(extracted.featuresToRemove.map((n) => n.toLowerCase()));
    next.features = next.features.filter((f) => !toRemove.has(f.name.toLowerCase()));
  }

  for (const [key, value] of Object.entries(extracted)) {
    if (value === null || value === undefined) continue;

    const k = key as keyof ProjectRequirementState;

    if (Array.isArray(value) && Array.isArray(next[k])) {
      // Merge arrays: for features/missingInformation use name dedup,
      // for simple string arrays use Set dedup
      if (k === 'features') {
        const existingNames = new Set((next.features ?? []).map((f) => f.name.toLowerCase()));
        const newFeatures = (value as typeof next.features).filter(
          (f) => !existingNames.has(f.name.toLowerCase()),
        );
        next.features = [...(next.features ?? []), ...newFeatures];
      } else if (k === 'platforms' || k === 'integrations' || k === 'compliance') {
        const existing = new Set((next[k] as string[]).map((s) => s.toLowerCase()));
        const merged = [...(next[k] as string[])];
        for (const item of value as string[]) {
          if (!existing.has((item as string).toLowerCase())) merged.push(item as string);
        }
        (next as Record<string, unknown>)[k] = merged;
      }
    } else if (k === 'budgetRange' && value && typeof value === 'object') {
      next.budgetRange = { ...next.budgetRange, ...(value as typeof next.budgetRange) };
    } else if (k === 'recommendedTechStack' && value && typeof value === 'object') {
      next.recommendedTechStack = { ...next.recommendedTechStack, ...(value as typeof next.recommendedTechStack) };
    } else {
      (next as Record<string, unknown>)[k] = value;
    }
  }

  return next;
}

// Detect which required fields are still missing.
export function detectMissingInfo(state: ProjectRequirementState): MissingField[] {
  const missing: MissingField[] = [];

  for (const { field, label, priority } of REQUIRED_FIELDS) {
    const value = state[field];
    const isEmpty =
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0) ||
      (field === 'budgetRange' && state.budgetRange.raw === null && state.budgetRange.min === null);

    if (isEmpty) {
      missing.push({ field: label, question: '', priority });
    }
  }

  return missing;
}

// Infer complexity from the current state.
export function inferComplexity(state: ProjectRequirementState): ComplexityLevel {
  let score = 0;

  score += state.platforms.length * 10;
  score += state.features.filter((f) => f.priority === 'MUST').length * 5;
  score += state.integrations.length * 8;
  if (state.realtimeRequirements) score += 20;
  if (state.adminPanelRequirements) score += 10;
  if (state.compliance.length > 0) score += 15;
  if (state.technicalConstraints) score += 10;

  if (score >= 80) return 'ENTERPRISE';
  if (score >= 50) return 'COMPLEX';
  if (score >= 20) return 'STANDARD';
  return 'SIMPLE';
}

// Calculate how complete the state is (0–100).
export function calculateCompleteness(state: ProjectRequirementState): number {
  const total = REQUIRED_FIELDS.length;
  let filled = 0;

  for (const { field } of REQUIRED_FIELDS) {
    const value = state[field];
    const isFilled =
      value !== null &&
      value !== undefined &&
      !(Array.isArray(value) && value.length === 0) &&
      !(field === 'budgetRange' && state.budgetRange.raw === null && state.budgetRange.min === null);

    if (isFilled) filled++;
  }

  return Math.round((filled / total) * 100);
}
