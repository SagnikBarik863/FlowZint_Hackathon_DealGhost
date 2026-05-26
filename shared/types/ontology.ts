// ─────────────────────────────────────────────────────────────────────────────
// Feature Ontology — the structured knowledge base of known software features
// loaded from the database and used by L4 discovery to generate smart questions
// ─────────────────────────────────────────────────────────────────────────────

export interface FeatureOntologyEntry {
  id: string;
  name: string;
  category: OntologyCategory;
  description: string;

  // Discovery relationships
  commonlyPairedWith: string[]; // other feature IDs often requested together
  impliedBy: string[]; // if these features are confirmed, this one is likely needed
  requiresDiscussion: boolean; // flag: needs clarifying questions before scoping

  // Complexity signals
  complexitySignals: ComplexitySignal[];
  defaultComplexity: 'low' | 'medium' | 'high' | 'variable';

  // Integration hints
  integrationHints: string[]; // e.g. ["Stripe", "Braintree"] for payment feature

  // Question templates for L4
  discoveryQuestions: string[]; // template questions to ask if this feature is mentioned

  // Metadata
  tags: string[];
  updatedAt: string;
}

export type OntologyCategory =
  | 'auth'
  | 'payments'
  | 'notifications'
  | 'media'
  | 'search'
  | 'analytics'
  | 'admin'
  | 'api'
  | 'realtime'
  | 'ai-ml'
  | 'compliance'
  | 'infrastructure'
  | 'other';

export interface ComplexitySignal {
  signal: string; // e.g. "multi-tenant", "SSO", "PCI compliance"
  addsComplexity: 'low' | 'medium' | 'high';
  explanation: string;
}
