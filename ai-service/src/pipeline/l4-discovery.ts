import { z } from 'zod'
import { callGroqJSON, GROQ_MODEL } from '../models/groq.js'
import { buildDiscoverySystemPrompt, buildDiscoveryUserPrompt } from '../prompts/discovery.js'
import type { DiscoveryResult, ProjectRequirementState, SemanticUnderstanding } from '@dealghost/shared'

// ── Zod schema ────────────────────────────────────────────────────────────────

const DiscoveryResultSchema = z.object({
  strategy: z.enum([
    'clarify_scope',
    'probe_complexity',
    'resolve_contradiction',
    'confirm_assumption',
    'discover_workflow',
    'ask_tech_preference',
    'offer_summary',
    'answer_question',
    'answer_services',
  ]),
  targetField: z.string(),
  reasoning: z.string(),
  question: z.string(),
  readyForSummary: z.boolean(),
})

// ── Layer function ────────────────────────────────────────────────────────────

export interface L4Input {
  state: ProjectRequirementState
  l1Understanding: SemanticUnderstanding | null
  conversationHistory: string
  latestMessage: string
  /** Last 3 bot questions — L4 must not repeat any of them */
  recentBotQuestions?: string[]
}

export async function runL4Discovery(input: L4Input): Promise<DiscoveryResult> {
  const systemPrompt = buildDiscoverySystemPrompt()
  const userPrompt = buildDiscoveryUserPrompt(
    input.state,
    input.l1Understanding,
    input.conversationHistory,
    input.latestMessage,
    input.recentBotQuestions,
  )

  return callGroqJSON(
    {
      model: GROQ_MODEL,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1400,
      temperature: 0.2,
    },
    (raw) => DiscoveryResultSchema.parse(JSON.parse(raw)) as DiscoveryResult
  )
}
