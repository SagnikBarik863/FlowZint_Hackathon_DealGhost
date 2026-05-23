import { z } from 'zod';
import { callGroq } from './groq';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './prompts/extraction';
import { ProjectRequirementState } from '@/types/project';

// Zod schema for the partial extraction output
const FeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  priority: z.enum(['MUST', 'SHOULD', 'COULD']),
});

const ExtractionSchema = z.object({
  projectType: z.enum(['web_app', 'mobile_app', 'api', 'integration', 'redesign', 'other']).optional(),
  projectName: z.string().optional(),
  description: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  features: z.array(FeatureSchema).optional(),
  integrations: z.array(z.string()).optional(),
  authRequirements: z.string().optional(),
  realtimeRequirements: z.string().optional(),
  adminPanelRequirements: z.string().optional(),
  targetUsers: z.string().optional(),
  userScale: z.string().optional(),
  industry: z.string().optional(),
  compliance: z.array(z.string()).optional(),
  technicalConstraints: z.string().optional(),
  timelineExpectation: z.string().optional(),
  budgetRange: z.object({
    min: z.number().nullable().optional(),
    max: z.number().nullable().optional(),
    currency: z.string().optional(),
    raw: z.string().nullable().optional(),
  }).optional(),
  recommendedTechStack: z.object({
    frontend: z.string().optional(),
    backend: z.string().optional(),
    database: z.string().optional(),
    hosting: z.string().optional(),
    avoid: z.array(z.string()).optional(),
  }).optional(),
});

type ExtractionResult = z.infer<typeof ExtractionSchema>;

export async function extractRequirements(
  conversationHistory: Array<{ role: string; content: string }>,
  currentState: ProjectRequirementState,
): Promise<ExtractionResult> {
  const userPrompt = buildExtractionUserPrompt(conversationHistory, currentState);
  const raw = await callGroq(EXTRACTION_SYSTEM_PROMPT, userPrompt);

  let parsed: unknown;
  try {
    // Strip markdown code fences if the model wraps output anyway
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // If parsing fails, return empty extraction — don't crash the pipeline
    console.error('[extraction] JSON parse failed:', raw);
    return {};
  }

  const result = ExtractionSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[extraction] Zod validation failed:', result.error.flatten());
    return {};
  }

  return result.data;
}
