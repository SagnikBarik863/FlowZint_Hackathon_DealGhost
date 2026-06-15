import { z } from 'zod'
import { callGroqJSON, GROQ_INTENT_MODEL } from '../models/groq.js'
import { buildUnderstandingSystemPrompt, buildUnderstandingUserPrompt } from '../prompts/understanding.js'
import { compactStateForPrompt } from '../prompts/extraction.js'
import type { SemanticUnderstanding, ProjectRequirementState } from '@dealghost/shared'

// ── Zod schema ───────────────────────────────────────────────────────────────

const SemanticUnderstandingSchema = z.object({
  semanticIntent: z.enum([
    'adding', 'correcting', 'removing', 'clarifying',
    'elaborating', 'questioning', 'done', 'confirming',
  ]).catch('adding'),
  businessDomain: z.string(),
  detectedLanguage: z.enum(['english', 'hindi', 'hinglish', 'mixed']).catch('english'),
  keyEntities: z.array(
    z.object({
      type: z.enum(['feature', 'integration', 'constraint', 'person', 'system']).catch('feature'),
      value: z.string(),
    })
  ).default([]),
  corrections: z.array(
    z.object({
      field: z.string(),
      oldValue: z.string(),
      newValue: z.string(),
    })
  ).default([]),
  contradictions: z.array(
    z.object({
      existingFact: z.string(),
      newStatement: z.string(),
      field: z.string(),
    })
  ).default([]),
  workflowsDescribed: z.array(z.string()).default([]),
  urgencySignals: z.array(z.string()).default([]),
  businessModelHints: z.array(z.string()).default([]),
  confidenceInUnderstanding: z.number().min(0).max(1),
})

// ── Layer function ────────────────────────────────────────────────────────────

export interface L1Input {
  latestMessage: string
  conversationHistory: string
  currentState: ProjectRequirementState
}

export async function runL1Understanding(input: L1Input): Promise<SemanticUnderstanding> {
  const systemPrompt = buildUnderstandingSystemPrompt()
  const userPrompt = buildUnderstandingUserPrompt(
    input.latestMessage,
    input.conversationHistory,
    compactStateForPrompt(input.currentState as unknown as Record<string, unknown>)
  )

  return callGroqJSON(
    {
      model: GROQ_INTENT_MODEL,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 800,
      temperature: 0,
    },
    (raw) => SemanticUnderstandingSchema.parse(JSON.parse(raw)) as SemanticUnderstanding
  )
}
