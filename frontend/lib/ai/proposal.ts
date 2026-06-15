import { z } from 'zod';
import { callGroq, FAST_MODEL } from './groq';
import { PROPOSAL_SYSTEM_PROMPT, buildProposalUserPrompt } from './prompts/proposal';
import type { ProjectRequirementState } from '@/types/project';

// Coerces null → [] before Zod validates (LLM may return null for empty arrays)
const arr = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => v ?? [], z.array(inner));

const ProposalSchema = z.object({
  executiveSummary: z.string().catch(''),
  scope: z.object({
    included: arr(z.string()),
    excluded: arr(z.string()),
  }).catch({ included: [], excluded: [] }),
  deliverables: arr(z.object({
    name: z.string().catch(''),
    description: z.string().catch(''),
    milestone: z.string().catch(''),
  })),
  timeline: z.object({
    phases: arr(z.object({
      name: z.string().catch(''),
      durationWeeks: z.number().catch(1),
      deliverables: arr(z.string()),
    })),
  }).catch({ phases: [] }),
  pricing: z.object({
    model: z.enum(['fixed', 'time_and_materials', 'retainer']).catch('fixed'),
    // Field name is costUsd for schema compat but values are INR
    breakdown: arr(z.object({ item: z.string().catch(''), costUsd: z.number().catch(0) })),
    totalUsd: z.number().catch(0),   // INR value despite the field name
    currency: z.string().catch('INR'),
  }).catch({ model: 'fixed', breakdown: [], totalUsd: 0, currency: 'INR' }),
  techStack: z.object({
    frontend: z.string().catch(''),
    backend: z.string().catch(''),
    database: z.string().catch(''),
    hosting: z.string().catch(''),
  }).catch({ frontend: '', backend: '', database: '', hosting: '' }),
  team: arr(z.object({
    role: z.string().catch(''),
    count: z.number().catch(1),
    allocationPct: z.number().catch(100),
  })),
  assumptions: arr(z.string()),
  terms: z.string().catch(''),
});

export type ProposalContent = z.infer<typeof ProposalSchema>;

export async function generateProposal(state: ProjectRequirementState): Promise<ProposalContent> {
  const raw = await callGroq(PROPOSAL_SYSTEM_PROMPT, buildProposalUserPrompt(state), true, FAST_MODEL);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[proposal] JSON parse failed:', raw.slice(0, 300));
    throw new Error('Proposal generation failed — invalid JSON from AI');
  }

  const result = ProposalSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[proposal] schema validation failed:', result.error.flatten());
    throw new Error('Proposal generation failed — schema validation error');
  }

  return result.data;
}
