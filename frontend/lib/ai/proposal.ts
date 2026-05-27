import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { PROPOSAL_SYSTEM_PROMPT, buildProposalUserPrompt } from './prompts/proposal';
import type { ProjectRequirementState } from '@/types/project';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
    // Field name is costUsd for schema compat but values are INR
    breakdown: z.array(z.object({ item: z.string(), costUsd: z.number() })),
    totalUsd: z.number(),   // INR value despite the field name
    currency: z.string(),   // Always "INR"
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
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    temperature: 0.3,
    system: PROPOSAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildProposalUserPrompt(state) }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';

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
    console.error('[proposal] schema validation failed:', result.error.flatten());
    throw new Error('Proposal generation failed — schema validation error');
  }

  return result.data;
}
