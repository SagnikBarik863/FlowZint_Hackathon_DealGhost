// ─────────────────────────────────────────────────────────────────────────────
// Pipeline layer I/O types — inputs/outputs for each layer in the 6-layer pipeline
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectState, FeatureEntry } from './project.js';

// ── L1: Semantic Understanding ────────────────────────────────────────────────

export type SemanticIntent =
  | 'providing'      // Adding new information
  | 'correcting'     // Fixing a prior misunderstanding — triggers replace semantics in L3
  | 'removing'       // Explicitly removing a feature/requirement
  | 'questioning'    // Asking a question, no state update needed
  | 'confirming'     // Agreeing with something AI said
  | 'other';

export interface SemanticUnderstanding {
  intent: SemanticIntent;
  confidence: number; // 0–1
  keyEntities: Array<{
    type: 'person' | 'system' | 'pain-point' | 'goal' | 'constraint' | 'other';
    value: string;
    context?: string;
  }>;
  uncertainFields: string[]; // field names user is unsure about e.g. ["budget", "timeline"]
  featuresToRemove: string[]; // feature IDs or names user explicitly removed
  rawReasoning?: string; // chain-of-thought from L1 (debug only)
}

// ── L2: Feature Extraction ────────────────────────────────────────────────────

export interface ExtractionResult {
  confirmedFeatures: FeatureEntry[];
  potentialFeatures: FeatureEntry[];
  integrations: Array<{
    name: string;
    type?: string;
    required: boolean;
    notes?: string;
  }>;
  constraints: Array<{
    type: 'technical' | 'compliance' | 'budget' | 'team' | 'other';
    value: string;
    certain: boolean;
  }>;
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
    raw?: string;
    uncertain?: boolean;
  };
  timeline?: {
    targetDate?: string;
    durationMonths?: number;
    raw?: string;
    uncertain?: boolean;
  };
  teamSize?: number;
  industry?: string;
}

// ── L3: State Merge ───────────────────────────────────────────────────────────

export interface MergeOptions {
  understanding?: SemanticUnderstanding; // Option B: intent-aware merge
}

// ── L4: Discovery ─────────────────────────────────────────────────────────────

export interface DiscoveryQuestion {
  id: string;
  question: string;
  rationale: string; // why this question matters (not shown to user)
  category: 'scope' | 'technical' | 'business' | 'timeline' | 'integration';
  priority: number; // 1 = highest
}

export interface DiscoveryResult {
  questions: DiscoveryQuestion[];
  gapSummary: string; // brief summary of what's still unknown
}

// ── L5: Scoring ───────────────────────────────────────────────────────────────

export interface ScoreCard {
  overall: number; // 0–100
  dimensions: {
    clarity: DimensionScore;
    completeness: DimensionScore;
    feasibility: DimensionScore;
    alignment: DimensionScore;
  };
  readinessLevel: 'early' | 'developing' | 'ready' | 'proposal-ready';
  summary: string;
}

export interface DimensionScore {
  score: number; // 0–100
  evidence: string; // specific quote or fact from state that drove this score
  gap?: string; // what would improve this score
}

// ── L6: Proposal ─────────────────────────────────────────────────────────────

export interface ProposalSection {
  title: string;
  content: string; // markdown
}

export interface ProposalResult {
  sections: ProposalSection[];
  generatedAt: string; // ISO timestamp
  stateSnapshotId?: string; // for audit trail
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface PipelineInput {
  message: string;
  projectId: string;
  state: ProjectState;
  conversationHistory: ConversationTurn[];
}

export interface PipelineOutput {
  updatedState: ProjectState;
  response: string; // AI reply to user
  scoreCard: ScoreCard;
  discoveryQuestions: DiscoveryQuestion[];
  understanding: SemanticUnderstanding; // for debugging/SSE
  turnDurationMs: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
