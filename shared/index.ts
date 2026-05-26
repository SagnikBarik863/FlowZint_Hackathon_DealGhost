// @dealghost/shared — public API
// Re-exports all types used across frontend and ai-service

export type {
  ProjectState,
  BudgetInfo,
  TimelineInfo,
  FeatureEntry,
  IntegrationEntry,
  ConstraintEntry,
  EntityEntry,
} from './types/project.js';

export type {
  SemanticIntent,
  SemanticUnderstanding,
  ExtractionResult,
  MergeOptions,
  DiscoveryQuestion,
  DiscoveryResult,
  ScoreCard,
  DimensionScore,
  ProposalSection,
  ProposalResult,
  PipelineInput,
  PipelineOutput,
  ConversationTurn,
} from './types/pipeline.js';

export type {
  FeatureOntologyEntry,
  OntologyCategory,
  ComplexitySignal,
} from './types/ontology.js';

export type {
  ProposalRequest,
  Proposal,
  ProposalContent,
  ProposalMetadata,
  ProposalSectionId,
} from './types/proposal.js';
