export type CanonicalProjectType =
  | 'web_app'
  | 'mobile_app'
  | 'api'
  | 'saas_platform'
  | 'marketplace'
  | 'e_commerce'
  | 'dashboard'
  | 'integration'
  | 'redesign'
  | 'other'

export type ComplexityLevel = 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'

export type DiscoveryStrategy =
  | 'clarify_scope'
  | 'probe_complexity'
  | 'resolve_contradiction'
  | 'confirm_assumption'
  | 'discover_workflow'
  | 'ask_tech_preference'
  | 'offer_summary'

export interface BudgetRange {
  min: number | null
  max: number | null
  currency: string
}

export interface CanonicalFeature {
  canonicalId: string
  rawText: string
  confidence: number // 0–1
  category: string
  priority: 'MUST' | 'SHOULD' | 'COULD'
  isConfirmed: boolean
  dependencies: string[]
}

export interface TechPreference {
  frontend?: string
  backend?: string
  database?: string
  hosting?: string
  avoid: string[]
  existingSystems: string[]
}

export interface Workflow {
  name: string
  steps: string[]
  actors: string[]
  triggers: string[]
}

export interface UserRole {
  name: string
  permissions: string[]
  count?: string
}

export interface Contradiction {
  field: string
  existingFact: string
  newStatement: string
  turnNumber: number
  resolved: boolean
  resolution?: string
}

export interface Ambiguity {
  field: string
  statement: string
  possibleInterpretations: string[]
}

export interface DiscoveryTarget {
  field: string
  strategy: DiscoveryStrategy
  blockingScore: number // 0–1, higher = more blocking
  suggestedQuestion: string
}

export interface TechnicalRisk {
  area: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  mitigation: string
}

export interface MissingField {
  field: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string
}

export interface TechStackRecommendation {
  frontend: string
  backend: string
  database: string
  hosting: string
  reasoning: string
}

export interface LeadScore {
  score: number // 0–100
  label:
    | 'High Intent Lead'
    | 'Qualified Prospect'
    | 'Needs Nurturing'
    | 'Low Qualification'
    | 'Unqualified'
  breakdown: {
    businessMaturity: number      // 0–15
    projectClarity: number        // 0–15
    budgetRealism: number         // 0–15
    urgencyAndIntent: number      // 0–15
    engagementDepth: number       // 0–15
    technicalFeasibility: number  // 0–15
    commercialFit: number         // 0–10
  }
  narrative: string
}

export interface ProjectRequirementState {
  conversationId: string

  // ── Project Identity ─────────────────────────────────────────────────
  projectType: CanonicalProjectType | null
  projectName: string | null
  description: string | null
  businessModel: 'B2B' | 'B2C' | 'marketplace' | 'internal' | null
  industry: string | null

  // ── Canonical Features ────────────────────────────────────────────────
  features: CanonicalFeature[]
  integrations: string[]

  // ── Scope ────────────────────────────────────────────────────────────
  platforms: string[]
  authRequirements: string | null
  realtimeRequirements: string | null
  adminPanelRequirements: string | null

  // ── Business Context ──────────────────────────────────────────────────
  targetUsers: string | null
  userScale: string | null
  compliance: string[]

  // ── Constraints ───────────────────────────────────────────────────────
  technicalConstraints: string | null
  timelineExpectation: string | null
  budgetRange: BudgetRange

  // ── Client Tech Preferences ───────────────────────────────────────────
  clientTechPreferences: TechPreference | null

  // ── Workflow Intelligence ─────────────────────────────────────────────
  workflows: Workflow[]
  userRoles: UserRole[]

  // ── Confidence & Quality ──────────────────────────────────────────────
  fieldConfidence: Record<string, number> // 0–1 per field
  confirmedFacts: string[]
  assumptions: string[]
  contradictions: Contradiction[]
  ambiguities: Ambiguity[]

  // ── Conversation Memory ───────────────────────────────────────────────
  conversationSummary: string | null
  keyDiscoveries: string[]

  // ── Discovery Intelligence ────────────────────────────────────────────
  discoveryTargets: DiscoveryTarget[]
  technicalRisks: TechnicalRisk[]

  // ── Pipeline Outputs ──────────────────────────────────────────────────
  inferredComplexity: ComplexityLevel | null
  recommendedTechStack: TechStackRecommendation | null
  completenessScore: number // weighted 0–100
  missingInformation: MissingField[]
  leadScore: LeadScore | null
  summary: string | null
}

export function createEmptyState(conversationId: string): ProjectRequirementState {
  return {
    conversationId,
    projectType: null,
    projectName: null,
    description: null,
    businessModel: null,
    industry: null,
    features: [],
    integrations: [],
    platforms: [],
    authRequirements: null,
    realtimeRequirements: null,
    adminPanelRequirements: null,
    targetUsers: null,
    userScale: null,
    compliance: [],
    technicalConstraints: null,
    timelineExpectation: null,
    budgetRange: { min: null, max: null, currency: 'USD' },
    clientTechPreferences: null,
    workflows: [],
    userRoles: [],
    fieldConfidence: {},
    confirmedFacts: [],
    assumptions: [],
    contradictions: [],
    ambiguities: [],
    conversationSummary: null,
    keyDiscoveries: [],
    discoveryTargets: [],
    technicalRisks: [],
    inferredComplexity: null,
    recommendedTechStack: null,
    completenessScore: 0,
    missingInformation: [],
    leadScore: null,
    summary: null,
  }
}

/**
 * Confidence score thresholds for canonical feature mapping.
 * Claude must follow these definitions when assigning confidence to extracted features.
 *
 * ≥ 0.95  — explicitly stated by the client word-for-word
 * 0.80–0.95 — strong semantic equivalence (different words, same concept)
 * 0.60–0.80 — reasonable inference from context (implied, not stated)
 * < 0.60  — uncertain assumption (possible but not clearly indicated)
 */
export const CONFIDENCE_THRESHOLDS = {
  EXPLICIT: 0.95,   // "we need Stripe payments" → payment_processing
  SEMANTIC: 0.80,   // "handle money transfers" → payment_processing
  INFERRED: 0.60,   // marketplace context implies payment_processing
  UNCERTAIN: 0.0,   // lower bound — anything below 0.60 is an assumption
} as const
