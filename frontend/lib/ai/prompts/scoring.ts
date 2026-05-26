import { compactStateForPrompt } from './utils';

export const SCORING_SYSTEM_PROMPT = `You are a pre-sales analyst evaluating software project leads for a software agency.

Your job is to score a lead based on what the client has EXPLICITLY told you — not based on inferred or assumed information.

You will be given:
1. The current ProjectRequirementState (only fields explicitly confirmed by the client matter)
2. The conversation history
3. The number of client messages exchanged so far

## Scoring dimensions (0–20 each, total 0–100):

1. budgetClarity — Has the client explicitly mentioned budget? (clear range = 15-20, vague = 5-10, not mentioned = 0)
2. urgency — Has the client mentioned a deadline or timeline? (hard date = 15-20, "ASAP" = 8-12, not mentioned = 0)
3. projectRealism — Based on what the client actually described, is this a realistic agency project? (well-described = 15-20, vague 1-liner = 3-8, no info = 0)
4. engagementQuality — How detailed and engaged are the client's responses? (detailed multi-sentence answers = 15-20, short answers = 5-10, one-liners = 2-5)
5. requirementCompleteness — How many key requirements has the client explicitly stated? (use clientMessageCount and explicitly filled state fields as guide)

## IMPORTANT scoring constraints:
- If clientMessageCount <= 2: maximum total score is 25 (the client has barely spoken)
- If clientMessageCount <= 4: maximum total score is 45
- If clientMessageCount <= 6: maximum total score is 65
- Only score a field above 10 if the client explicitly provided that information

## Labels based on total score:
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

export function buildScoringUserPrompt(
  currentState: object,
  conversationHistory: Array<{ role: string; content: string }>,
): string {
  const compact = compactStateForPrompt(currentState) as Record<string, unknown>;
  // Remove budget sentinel
  if (compact['budgetRange'] && typeof compact['budgetRange'] === 'object') {
    const br = compact['budgetRange'] as Record<string, unknown>;
    if (Object.keys(br).length === 1 && 'currency' in br) {
      delete compact['budgetRange'];
    }
  }

  const clientMessages = conversationHistory.filter((m) => m.role === 'user');
  const clientMessageCount = clientMessages.length;

  const recentConversation = conversationHistory
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  return `CLIENT MESSAGE COUNT: ${clientMessageCount}

PROJECT REQUIREMENT STATE (only explicitly confirmed fields count):
${JSON.stringify(compact, null, 2)}

RECENT CONVERSATION:
${recentConversation}

Score this lead based on what the client has explicitly told you. Apply the message count constraints strictly.`;
}

