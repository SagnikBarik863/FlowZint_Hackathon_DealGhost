// ─────────────────────────────────────────────────────────────────────────────
// ProjectRequirementState — the central object that evolves throughout the
// conversation. Every AI pipeline step reads from and writes to this type.
// ─────────────────────────────────────────────────────────────────────────────

export type Priority = 'MUST' | 'SHOULD' | 'COULD';
export type ComplexityLevel = 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE';
export type MissingInfoPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Feature {
  // Legacy fields (old pipeline)
  name?: string;
  description?: string;
  // Current pipeline fields (CanonicalFeature shape from ai-service)
  canonicalId: string;
  rawText: string;
  confidence: number;
  category: string;
  priority: Priority;
  isConfirmed: boolean;
  dependencies: string[];
}

export interface MissingField {
  field: string;
  question: string;
  priority: MissingInfoPriority;
}

export interface TechStackPreference {
  frontend?: string;
  backend?: string;
  database?: string;
  hosting?: string;
  avoid?: string[];
}

export interface LeadScore {
  score: number; // 0–100
  label: string; // e.g. "High Intent Lead", "Low Budget Confidence"
  breakdown: {
    budgetClarity: number;
    urgency: number;
    projectRealism: number;
    engagementQuality: number;
    requirementCompleteness: number;
  };
}

export interface ProjectRequirementState {
  // ── Project Identity ───────────────────────────────────────────────────────
  projectType:
    | 'web_app'
    | 'mobile_app'
    | 'api'
    | 'integration'
    | 'redesign'
    | 'other'
    | null;
  projectName: string | null;
  description: string | null;

  // ── Scope ─────────────────────────────────────────────────────────────────
  platforms: string[];           // e.g. ["web", "ios", "android"]
  features: Feature[];
  integrations: string[];        // e.g. ["Stripe", "Google Maps"]
  authRequirements: string | null;       // e.g. "email + social login"
  realtimeRequirements: string | null;   // e.g. "live order tracking"
  adminPanelRequirements: string | null; // e.g. "vendor management dashboard"

  // ── Business Context ──────────────────────────────────────────────────────
  targetUsers: string | null;    // e.g. "SMB restaurant owners"
  userScale: string | null;      // e.g. "~500 DAU at launch"
  industry: string | null;       // e.g. "foodtech", "fintech"
  compliance: string[];          // e.g. ["GDPR", "HIPAA"]

  // ── Constraints ───────────────────────────────────────────────────────────
  technicalConstraints: string | null;
  timelineExpectation: string | null;  // e.g. "3 months", "ASAP"
  budgetRange: {
    min: number | null;
    max: number | null;
    currency: string;
    raw: string | null; // original string from client e.g. "around 50k"
  };

  // ── AI-Inferred ───────────────────────────────────────────────────────────
  inferredComplexity: ComplexityLevel | null;
  recommendedTechStack: TechStackPreference;
  completenessScore: number; // 0–100

  // ── Pipeline Outputs ──────────────────────────────────────────────────────
  missingInformation: MissingField[];
  leadScore: LeadScore | null;
  summary: string | null;
}

// Default empty state — used when starting a new conversation
export const emptyProjectRequirementState = (): ProjectRequirementState => ({
  projectType: null,
  projectName: null,
  description: null,
  platforms: [],
  features: [],
  integrations: [],
  authRequirements: null,
  realtimeRequirements: null,
  adminPanelRequirements: null,
  targetUsers: null,
  userScale: null,
  industry: null,
  compliance: [],
  technicalConstraints: null,
  timelineExpectation: null,
  budgetRange: { min: null, max: null, currency: 'USD', raw: null },
  inferredComplexity: null,
  recommendedTechStack: {},
  completenessScore: 0,
  missingInformation: [],
  leadScore: null,
  summary: null,
});
