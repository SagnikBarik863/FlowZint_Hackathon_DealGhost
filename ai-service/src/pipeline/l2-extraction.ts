import { z } from 'zod'
import { callGroqJSON, GROQ_MODEL } from '../models/groq.js'
import { getOntologyPromptSection } from '../ontology/feature-mapper.js'
import {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  compactStateForPrompt,
} from '../prompts/extraction.js'
import type { ExtractionResult, ProjectRequirementState } from '@dealghost/shared'

// ── Zod validation schema ────────────────────────────────────────────────────

// Coerces null → [] before Zod validates, so the model returning null doesn't crash
const arr = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => v ?? [], z.array(inner))

const FeatureSchema = z.object({
  canonicalId: z.string(),
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.string(),
  priority: z.enum(['MUST', 'SHOULD', 'COULD']),
  isConfirmed: z.boolean(),
  dependencies: arr(z.string()),
})

const ExtractionResultSchema = z.object({
  features: arr(FeatureSchema),
  integrations: arr(z.string()),
  platforms: arr(z.string()),
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
      frontend: z.string().nullish(),
      backend: z.string().nullish(),
      database: z.string().nullish(),
      hosting: z.string().nullish(),
      avoid: arr(z.string()),
      existingSystems: arr(z.string()),
    })
    .nullable()
    .default(null),
  compliance: arr(z.string()),
  technicalConstraints: z.string().nullable().default(null),
  workflows: arr(
    z.object({
      name: z.string(),
      steps: arr(z.string()),
      actors: arr(z.string()),
      triggers: arr(z.string()),
    })
  ),
  userRoles: arr(
    z.object({
      name: z.string(),
      permissions: arr(z.string()),
      count: z.string().optional().nullable(),
    })
  ),
  featuresToRemove: arr(z.string()),
  platformsToRemove: arr(z.string()),
  assumptions: arr(z.string()),
  newCanonicalEntries: arr(
    z.object({
      id: z.string(),
      canonicalName: z.string(),
      category: z.string(),
      aliases: arr(z.string()),
    })
  ),
})

// ── Layer function ───────────────────────────────────────────────────────────

export interface L2Input {
  latestMessage: string
  conversationHistory: string
  currentState: ProjectRequirementState
  /** Optional context string from L1 — injected before the user message for correction-aware extraction */
  l1Context?: string
}

export async function runL2Extraction(input: L2Input): Promise<ExtractionResult> {
  const ontologySection = await getOntologyPromptSection()

  const systemPrompt = buildExtractionSystemPrompt(ontologySection)
  const baseUserPrompt = buildExtractionUserPrompt(
    input.latestMessage,
    input.conversationHistory,
    compactStateForPrompt(input.currentState as unknown as Record<string, unknown>)
  )
  // Prepend L1 context when provided (correction/intent awareness)
  const userPrompt = input.l1Context
    ? `${input.l1Context}\n\n${baseUserPrompt}`
    : baseUserPrompt

  const result = await callGroqJSON(
    {
      model: GROQ_MODEL,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 2500,
      temperature: 0.1,
    },
    (raw) => ExtractionResultSchema.parse(JSON.parse(raw))
  )

  return result as ExtractionResult
}
