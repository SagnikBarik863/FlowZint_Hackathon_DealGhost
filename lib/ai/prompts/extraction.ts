export const EXTRACTION_SYSTEM_PROMPT = `You are a senior solution architect extracting project requirements from a client discovery conversation.

Your job: extract AND intelligently infer structured requirements from everything the client has said.

You will be given:
1. The current known project state (fields already extracted — skip these unless there's new/better info)
2. The recent conversation

Extraction rules:
- Extract what is clearly stated
- ALSO infer what is strongly implied by domain knowledge (e.g. "food delivery app" → industry=foodtech, payments integration, real-time tracking)
- For EVERY first message: always extract projectType, description, industry if you can determine them at all
- For features: list the core features that ANY app of this type MUST have, even if not explicitly mentioned
- Only omit a field if you genuinely have no basis to populate it
- Do NOT overwrite existing state fields unless you have new/better information
- Return ONLY the fields with new or updated values — omit fields already in state

JSON format (include only fields with new data):
{
  "projectType": "web_app" | "mobile_app" | "api" | "integration" | "redesign" | "other",
  "projectName": string,
  "description": string,
  "platforms": string[],
  "features": [{ "name": string, "description": string, "priority": "MUST" | "SHOULD" | "COULD" }],
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

Rules:
- Return ONLY valid JSON. No explanation, no markdown, no code blocks.
- If nothing new at all, return: {}
- Features: MUST = core/defining functionality, SHOULD = important but not blocking, COULD = nice to have
- budgetRange.raw = exact phrase client used (e.g. "around 50k")
- Be generous with inference — a partially correct extraction is far better than an empty one`;

/** Remove null, undefined, and empty-array/empty-object values from state before serialising */
function compactState(state: object): object {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      // Recursively compact object items within arrays
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' ? compactState(item as object) : item
      );
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = compactState(value as object);
      if (Object.keys(nested).length === 0) continue;
      result[key] = nested;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function buildExtractionUserPrompt(
  conversationHistory: Array<{ role: string; content: string }>,
  currentState: object,
): string {
  const compact = compactState(currentState) as Record<string, unknown>;
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
      : `CURRENT PROJECT STATE: (empty — this is the first message, extract everything you can)`;

  // For long conversations, only send recent messages — older ones are captured in state
  const recentHistory =
    conversationHistory.length > 4
      ? conversationHistory.slice(-4)
      : conversationHistory;

  return `${stateSection}

CONVERSATION:
${recentHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

Extract any new project requirement information. Be generous with inference.`;
}
