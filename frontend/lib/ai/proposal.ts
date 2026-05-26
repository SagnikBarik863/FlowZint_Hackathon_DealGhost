import { z } from 'zod';
import { callGroq } from './groq';
import { PROPOSAL_SYSTEM_PROMPT, buildProposalUserPrompt } from './prompts/proposal';
import { ProjectRequirementState } from '@/types/project';

const ProposalSchema = z.object({
  executiveSummary: z.string(),
  scope: z.object({
    included: z.array(z.string()),
    excluded: z.array(z.string()),
  }),
  deliverables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    milestone: z.string(),
  })),
  timeline: z.object({
    phases: z.array(z.object({
      name: z.string(),
      durationWeeks: z.number(),
      deliverables: z.array(z.string()),
    })),
  }),
  pricing: z.object({
    model: z.enum(['fixed', 'time_and_materials', 'retainer']),
    breakdown: z.array(z.object({
      item: z.string(),
      costUsd: z.number(),
    })),
    totalUsd: z.number(),
    currency: z.string(),
  }),
  techStack: z.object({
    frontend: z.string(),
    backend: z.string(),
    database: z.string(),
    hosting: z.string(),
  }),
  team: z.array(z.object({
    role: z.string(),
    count: z.number(),
    allocationPct: z.number(),
  })),
  assumptions: z.array(z.string()),
  terms: z.string(),
});

export type ProposalContent = z.infer<typeof ProposalSchema>;

export async function generateProposal(state: ProjectRequirementState): Promise<ProposalContent> {
  const userPrompt = buildProposalUserPrompt(state);
  const raw = await callGroq(PROPOSAL_SYSTEM_PROMPT, userPrompt, true);

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[proposal] JSON parse failed:', raw.slice(0, 300));
    throw new Error('Proposal generation failed — invalid JSON from AI');
  }

  const result = ProposalSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[proposal] Zod validation failed:', result.error.flatten());
    throw new Error('Proposal generation failed — schema validation error');
  }

  return result.data;
}
