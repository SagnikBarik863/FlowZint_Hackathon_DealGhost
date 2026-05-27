import { z } from 'zod'
import { callClaudeJSON } from '../models/claude.js'
import { buildDiscoverySystemPrompt, buildDiscoveryUserPrompt } from '../prompts/discovery.js'
import { MODELS } from '../models/constants.js'
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
  /** The last question the bot asked — L4 must not repeat it */
  lastBotQuestion?: string
}

export async function runL4Discovery(input: L4Input): Promise<DiscoveryResult> {
  const systemPrompt = buildDiscoverySystemPrompt()
  const userPrompt = buildDiscoveryUserPrompt(
    input.state,
    input.l1Understanding,
    input.conversationHistory,
    input.lastBotQuestion,
  )

  return callClaudeJSON(
    {
      model: MODELS.L4_DISCOVERY,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 900,
      temperature: 0.2, // slight creativity for varied question phrasing
    },
    (raw) => DiscoveryResultSchema.parse(JSON.parse(raw)) as DiscoveryResult
  )
}
