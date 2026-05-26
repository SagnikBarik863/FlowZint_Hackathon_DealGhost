// Model assignments per pipeline layer
// Cost rationale: Haiku for classification/rubric tasks (~5x cheaper than Sonnet),
// Sonnet for accuracy-critical extraction and generation.
// Target: ~$0.037/turn → $0.37–$0.51 per 8–12 turn conversation.

export const MODELS = {
  // Haiku 4.5 — fast, cheap, good for classification
  L1_UNDERSTANDING: 'claude-haiku-4-5-20251001',
  L5_SCORING: 'claude-haiku-4-5-20251001',
  MEMORY_COMPRESSION: 'claude-haiku-4-5-20251001',

  // Sonnet 4.6 — accuracy-critical tasks
  L2_EXTRACTION: 'claude-sonnet-4-6',
  L4_DISCOVERY: 'claude-sonnet-4-6',
  L6_PROPOSAL: 'claude-sonnet-4-6',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
