import { z } from 'zod'
import { callClaudeJSON } from '../models/claude.js'
import { getOntologyPromptSection } from '../ontology/feature-mapper.js'
import {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  compactStateForPrompt,
} from '../prompts/extraction.js'
import { MODELS } from '../models/constants.js'
import type { ExtractionResult, ProjectRequirementState } from '@dealghost/shared'

// ── Zod validation schema ────────────────────────────────────────────────────

const FeatureSchema = z.object({
  canonicalId: z.string(),
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.string(),
  priority: z.enum(['MUST', 'SHOULD', 'COULD']),
  isConfirmed: z.boolean(),
  dependencies: z.array(z.string()).default([]),
})

const ExtractionResultSchema = z.object({
  features: z.array(FeatureSchema).default([]),
  integrations: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default([]),
  authRequirements: z.string().nullable().default(null),
  realtimeRequirements: z.string().nullable().default(null),
  adminPanelRequirements: z.string().nullable().default(null),
  targetUsers: z.string().nullable().default(null),
  userScale: z.string().nullable().default(null),
  businessModel: z.enum(['B2B', 'B2C', 'marketplace', 'internal']).nullable().default(null),
  timelineExpectation: z.string().nullable().default(null),
  budgetRange: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      currency: z.string(),
    })
    .nullable()
    .default(null),
  clientTechPreferences: z
    .object({
      frontend: z.string().optional(),
      backend: z.string().optional(),
      database: z.string().optional(),
      hosting: z.string().optional(),
      avoid: z.array(z.string()).default([]),
      existingSystems: z.array(z.string()).default([]),
    })
    .nullable()
    .default(null),
  compliance: z.array(z.string()).default([]),
  technicalConstraints: z.string().nullable().default(null),
  workflows: z
    .array(
      z.object({
        name: z.string(),
        steps: z.array(z.string()),
        actors: z.array(z.string()),
        triggers: z.array(z.string()),
      })
    )
    .default([]),
  userRoles: z
    .array(
      z.object({
        name: z.string(),
        permissions: z.array(z.string()),
        count: z.string().optional().nullable(),
      })
    )
    .default([]),
  featuresToRemove: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  newCanonicalEntries: z
    .array(
      z.object({
        id: z.string(),
        canonicalName: z.string(),
        category: z.string(),
        aliases: z.array(z.string()),
      })
    )
    .default([]),
})

// ── Layer function ───────────────────────────────────────────────────────────

export interface L2Input {
  latestMessage: string
  conversationHistory: string
  currentState: ProjectRequirementState
}

export async function runL2Extraction(input: L2Input): Promise<ExtractionResult> {
  const ontologySection = await getOntologyPromptSection()

  const systemPrompt = buildExtractionSystemPrompt(ontologySection)
  const userPrompt = buildExtractionUserPrompt(
    input.latestMessage,
    input.conversationHistory,
    compactStateForPrompt(input.currentState as unknown as Record<string, unknown>)
  )

  const result = await callClaudeJSON(
    {
      model: MODELS.L2_EXTRACTION,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 2500,
      temperature: 0.1, // low temperature for consistent structured output
      cacheSystemPrompt: true, // ontology section cached after first call
    },
    (raw) => ExtractionResultSchema.parse(JSON.parse(raw))
  )

  return result as ExtractionResult
}
