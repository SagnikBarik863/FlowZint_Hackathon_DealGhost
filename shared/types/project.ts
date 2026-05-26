// ─────────────────────────────────────────────────────────────────────────────
// Project state — the central accumulator updated after every turn
// ARCHITECTURAL CONTRACT: Do not mutate these interfaces without reviewing all
// layers that read/write them (L2 extraction, L3 merge, L4 discovery, L5 scoring,
// L6 proposal, chat route, memory module).
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectState {
  // Core identity
  projectId: string;
  companyName?: string;
  projectName?: string;

  // Extracted structured data
  budget?: BudgetInfo;
  timeline?: TimelineInfo;
  teamSize?: number;
  industry?: string;

  // Feature landscape
  confirmedFeatures: FeatureEntry[];
  potentialFeatures: FeatureEntry[];
  excludedFeatures: FeatureEntry[];

  // Integration requirements
  integrations: IntegrationEntry[];

  // Technical constraints
  constraints: ConstraintEntry[];

  // Key entities mentioned (people, systems, pain points)
  keyEntities: EntityEntry[];

  // Conversation metadata
  turnCount: number;
  lastUpdated: string; // ISO timestamp
  confidenceScore: number; // 0–1 aggregate
}

export interface BudgetInfo {
  min?: number;
  max?: number;
  currency?: string;
  raw?: string; // original user text
  uncertain?: boolean;
}

export interface TimelineInfo {
  targetDate?: string; // ISO date
  durationMonths?: number;
  raw?: string;
  uncertain?: boolean;
}

export interface FeatureEntry {
  id: string; // stable slug e.g. "user-auth"
  name: string;
  description?: string;
  priority?: 'must-have' | 'nice-to-have' | 'future';
  source: 'user-stated' | 'ai-inferred' | 'confirmed';
  turnAdded: number;
}

export interface IntegrationEntry {
  name: string; // e.g. "Salesforce", "Stripe"
  type?: string; // e.g. "CRM", "payment"
  required: boolean;
  notes?: string;
}

export interface ConstraintEntry {
  type: 'technical' | 'compliance' | 'budget' | 'team' | 'other';
  value: string;
  certain: boolean;
}

export interface EntityEntry {
  type: 'person' | 'system' | 'pain-point' | 'goal' | 'constraint' | 'other';
  value: string;
  context?: string;
}
