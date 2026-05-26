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

export async function scoreLead(
  state: ProjectRequirementState,
  conversationHistory: Array<{ role: string; content: string }> = [],
): Promise<LeadScore> {
  const userPrompt = buildScoringUserPrompt(state, conversationHistory);
  const raw = await callGroq(SCORING_SYSTEM_PROMPT, userPrompt, true);

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[scoring] JSON parse failed:', raw);
    return defaultScore();
  }

  // Clamp all breakdown values to [0, 20] and total score to [0, 100]
  // before Zod validation — the LLM occasionally returns slightly out-of-range
  // values (e.g. 22/20) which would otherwise silently collapse to defaultScore().
  if (parsed && typeof parsed === 'object') {
    const p = parsed as Record<string, unknown>;
    if (p.breakdown && typeof p.breakdown === 'object') {
      const b = p.breakdown as Record<string, unknown>;
      const dims = ['budgetClarity', 'urgency', 'projectRealism', 'engagementQuality', 'requirementCompleteness'];
      for (const dim of dims) {
        if (typeof b[dim] === 'number') {
          b[dim] = Math.min(20, Math.max(0, Math.round(b[dim] as number)));
        }
      }
    }
    if (typeof p.score === 'number') {
      p.score = Math.min(100, Math.max(0, Math.round(p.score as number)));
    }
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
