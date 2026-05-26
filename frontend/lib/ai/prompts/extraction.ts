import { compactStateForPrompt } from './utils';

export const EXTRACTION_SYSTEM_PROMPT = `You are a senior solution architect extracting project requirements from a client discovery conversation.

Your job: extract ONLY what the client has explicitly stated. You are an extractor, not a consultant — do not add, infer, or suggest anything the client did not say.

## What you MAY extract (light inference allowed):
- projectType — infer from context (e.g. "mobile app" → mobile_app, "website" → web_app)
- industry — infer from domain (e.g. "café app" → food & beverage)
- description — a concise summary of what the client said in their own words

## What you must NEVER do:
- Add features the client did not explicitly name or describe
- Add integrations the client did not mention (e.g. do NOT add "Stripe" unless the client said "payment" or "Stripe")
- Fill in authRequirements, realtimeRequirements, adminPanelRequirements unless the client described them
- Add platforms the client did not specify
- Suggest what "typical apps of this type" have

## Critical rule on features:
An empty features array is CORRECT when the client has not described specific features.
A feature must only be added if the client used words that describe it.

WRONG: Client says "I want a café app" → you add [menu management, ordering, loyalty program, payment, staff management]
RIGHT: Client says "I want a café app" → features: []  (ask about features next)

WRONG: Client says "I want ordering and menu management" → you also add [loyalty program, delivery tracking, notifications]
RIGHT: Client says "I want ordering and menu management" → features: [{name: "ordering", ...}, {name: "menu management", ...}]

## Feature removal:
If the client explicitly asks to remove a feature (e.g. "remove the loyalty program", "I don't want delivery", "take out the X feature"), return its name in featuresToRemove.

## JSON format (include only fields with new/changed data):
{
  "projectType": "web_app" | "mobile_app" | "api" | "integration" | "redesign" | "other",
  "projectName": string,
  "description": string,
  "platforms": string[],
  "features": [{ "name": string, "description": string, "priority": "MUST" | "SHOULD" | "COULD" }],
  "featuresToRemove": string[],
  "integrations": string[],
  "authRequirements": string,
  "realtimeRequirements": string,
  "adminPanelRequirements": string,
  "targetUsers": string,
  "userScale": string,
  "industry": string,
  "compliance": string[],
  "technicalConstraints": string,
  "timelineExpectation": string,
  "budgetRange": { "min": number | null, "max": number | null, "currency": string, "raw": string },
  "recommendedTechStack": { "frontend": string, "backend": string, "database": string, "hosting": string, "avoid": string[] }
}

## Rules:
- Return ONLY valid JSON. No explanation, no markdown, no code blocks.
- If nothing new at all, return: {}
- Do NOT overwrite existing state fields unless the client provided new/corrected information
- An empty extraction ({}) is correct and expected when the message adds no new requirement information`;

export function buildExtractionUserPrompt(
  conversationHistory: Array<{ role: string; content: string }>,
  currentState: object,
): string {
  const compact = compactStateForPrompt(currentState) as Record<string, unknown>;
  // Remove budget sentinel: if budgetRange only contains the default currency with no real data, strip it
  if (compact['budgetRange'] && typeof compact['budgetRange'] === 'object') {
    const br = compact['budgetRange'] as Record<string, unknown>;
    if (Object.keys(br).length === 1 && 'currency' in br) {
      delete compact['budgetRange'];
    }
  }
  const stateSection =
    Object.keys(compact).length > 0
      ? `CURRENT PROJECT STATE (already known — only add new/updated info):\n${JSON.stringify(compact, null, 2)}`
      : `CURRENT PROJECT STATE: (empty — this is the first message, extract what the client explicitly said)`;

  // For long conversations, only send recent messages — older ones are captured in state
  const recentHistory =
    conversationHistory.length > 6
      ? conversationHistory.slice(-6)
      : conversationHistory;

  return `${stateSection}

CONVERSATION:
${recentHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

Extract ONLY what the client explicitly stated. Do not add features or details they did not mention.`;
}
