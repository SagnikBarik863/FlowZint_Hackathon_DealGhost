import { z } from 'zod';
import { callGroq } from './groq';
import { SCORING_SYSTEM_PROMPT, buildScoringUserPrompt } from './prompts/scoring';
import { ProjectRequirementState, LeadScore } from '@/types/project';

const LeadScoreSchema = z.object({
  score: z.number().min(0).max(100),
  label: z.string(),
  breakdown: z.object({
    budgetClarity: z.number().min(0).max(20),
    urgency: z.number().min(0).max(20),
    projectRealism: z.number().min(0).max(20),
    engagementQuality: z.number().min(0).max(20),
    requirementCompleteness: z.number().min(0).max(20),
  }),
});

export async function scoreLead(state: ProjectRequirementState): Promise<LeadScore> {
  const userPrompt = buildScoringUserPrompt(state);
  const raw = await callGroq(SCORING_SYSTEM_PROMPT, userPrompt);

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[scoring] JSON parse failed:', raw);
    return defaultScore();
  }

  const result = LeadScoreSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[scoring] Zod validation failed:', result.error.flatten());
    return defaultScore();
  }

  return result.data;
}

function defaultScore(): LeadScore {
  return {
    score: 0,
    label: 'Unqualified',
    breakdown: {
      budgetClarity: 0,
      urgency: 0,
      projectRealism: 0,
      engagementQuality: 0,
      requirementCompleteness: 0,
    },
  };
}
