// ─────────────────────────────────────────────────────────────────────────────
// Proposal types — structures for L6 proposal generation and persistence
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectState } from './project.js';
import type { ScoreCard } from './pipeline.js';

export interface ProposalRequest {
  projectId: string;
  stateSnapshot: ProjectState;
  scoreCard: ScoreCard;
  customInstructions?: string; // optional user-provided additions
}

export interface Proposal {
  id: string;
  projectId: string;
  version: number;
  sections: ProposalContent[];
  metadata: ProposalMetadata;
  createdAt: string;
}

export interface ProposalContent {
  id: string;
  title: string;
  content: string; // markdown
  order: number;
}

export interface ProposalMetadata {
  stateHash: string; // fingerprint of state used to generate this proposal
  modelUsed: string;
  tokensUsed?: number;
  generationMs: number;
}

// Section identifiers for standard proposal structure
export type ProposalSectionId =
  | 'executive-summary'
  | 'problem-statement'
  | 'proposed-solution'
  | 'feature-scope'
  | 'technical-approach'
  | 'integrations'
  | 'timeline'
  | 'investment'
  | 'next-steps';
