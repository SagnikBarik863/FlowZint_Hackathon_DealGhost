export const SCORING_SYSTEM_PROMPT = `You are a pre-sales analyst evaluating software project leads for a software agency.

Your job is to score a lead based on their project requirements and conversation quality.

You will be given the current ProjectRequirementState.

Score the lead across 5 dimensions (0–20 each, total 0–100):

1. budgetClarity — How clearly has the client indicated budget? (explicit range = 20, vague = 5-10, none = 0)
2. urgency — How urgent is this project? (hard deadline = 20, "ASAP" = 10, no timeline = 0)
3. projectRealism — Is the scope realistic for a software agency? (well-scoped = 20, vague = 5-10, unrealistic = 0)
4. engagementQuality — How engaged and informed is the client? (detailed answers = 20, one-liners = 5)
5. requirementCompleteness — How complete are the project requirements? (use completenessScore as a guide)

Based on the total score, assign a label:
- 80–100: "High Intent Lead"
- 60–79: "Qualified Prospect"
- 40–59: "Needs Nurturing"
- 20–39: "Low Qualification"
- 0–19: "Unqualified"

Return ONLY valid JSON in this exact format:
{
  "score": number,
  "label": string,
  "breakdown": {
    "budgetClarity": number,
    "urgency": number,
    "projectRealism": number,
    "engagementQuality": number,
    "requirementCompleteness": number
  }
}`;

export function buildScoringUserPrompt(currentState: object): string {
  const compact = compactStateForPrompt(currentState) as Record<string, unknown>;
  // Remove budget sentinel
  if (compact['budgetRange'] && typeof compact['budgetRange'] === 'object') {
    const br = compact['budgetRange'] as Record<string, unknown>;
    if (Object.keys(br).length === 1 && 'currency' in br) {
      delete compact['budgetRange'];
    }
  }
  return `PROJECT REQUIREMENT STATE:
${JSON.stringify(compact, null, 2)}

Score this lead.`;
}

/** Strip null, undefined, empty arrays, and empty objects from state before sending to AI */
function compactStateForPrompt(state: object): object {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' ? compactStateForPrompt(item as object) : item
      );
      continue;
    }
    if (typeof value === 'object') {
      const nested = compactStateForPrompt(value as object);
      if (Object.keys(nested).length === 0) continue;
      result[key] = nested;
    } else {
      result[key] = value;
    }
  }
  return result;
}
