import type { CanonicalFeature, TechPreference, Workflow, UserRole, BudgetRange, Contradiction } from './project.js'

// ── L1 Output ───────────────────────────────────────────────────────────────

export interface SemanticUnderstanding {
  semanticIntent:
    | 'adding'
    | 'correcting'
    | 'removing'
    | 'clarifying'
    | 'elaborating'
    | 'questioning'
    | 'done'
    | 'confirming'
  businessDomain: string
  keyEntities: Array<{
    type: 'feature' | 'integration' | 'constraint' | 'person' | 'system'
    value: string
  }>
  corrections: Array<{ field: string; oldValue: string; newValue: string }>
  contradictions: Array<{ existingFact: string; newStatement: string; field: string }>
  workflowsDescribed: string[]
  urgencySignals: string[]
  businessModelHints: string[]
  confidenceInUnderstanding: number // 0–1
}

// ── L2 Output ───────────────────────────────────────────────────────────────

export interface ExtractionResult {
  features: CanonicalFeature[]
  integrations: string[]
  platforms: string[]
  authRequirements: string | null
  realtimeRequirements: string | null
  adminPanelRequirements: string | null
  targetUsers: string | null
  userScale: string | null
  businessModel: 'B2B' | 'B2C' | 'marketplace' | 'internal' | null
  timelineExpectation: string | null
  budgetRange: BudgetRange | null
  clientTechPreferences: TechPreference | null
  compliance: string[]
  technicalConstraints: string | null
  workflows: Workflow[]
  userRoles: UserRole[]
  featuresToRemove: string[] // canonical IDs to remove from state
  assumptions: string[]
  newCanonicalEntries: Array<{
    id: string
    canonicalName: string
    category: string
    aliases: string[]
  }>
}

// ── L4 Output ───────────────────────────────────────────────────────────────

export interface DiscoveryResult {
  strategy:
    | 'clarify_scope'
    | 'probe_complexity'
    | 'resolve_contradiction'
    | 'confirm_assumption'
    | 'discover_workflow'
    | 'ask_tech_preference'
    | 'offer_summary'
  targetField: string
  reasoning: string
  question: string
  readyForSummary: boolean
}

// ── SSE Events ───────────────────────────────────────────────────────────────

export type PipelineLayer = 'preflight' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'

export type PipelineEventType =
  | 'pipeline_start'
  | 'layer_start'
  | 'layer_complete'
  | 'state_update'
  | 'response'
  | 'error'
  | 'pipeline_complete'

export interface PipelineEvent {
  type: PipelineEventType
  layer?: PipelineLayer
  data?: unknown
  timestamp: number
}

// ── Chat API ─────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string
  conversationId?: string
}

export interface ChatResponse {
  conversationId: string
  message: string
  state: import('./project.js').ProjectRequirementState
  intent: string
  readyForProposal: boolean
}
