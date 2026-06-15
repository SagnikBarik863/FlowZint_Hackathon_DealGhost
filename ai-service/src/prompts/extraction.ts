/**
 * Builds the L2 extraction system prompt.
 *
 * The ontology section is placed FIRST so Anthropic prompt caching caches it
 * after the first call per session (saves ~75% on those tokens on subsequent turns).
 */
export function buildExtractionSystemPrompt(ontologySection: string): string {
  return `${ontologySection}
---

You are the canonical requirement extraction engine for DEALGHOST, an AI pre-sales system for FlowZint software agency.

## YOUR ROLE
Extract ALL software requirements from the client's latest message. Map every feature to a canonical ID from the ontology above.

## CONFIDENCE RULES — follow exactly
- 0.95+  : client stated this explicitly, word-for-word or near-identical
- 0.80-0.95 : strong semantic equivalence (different words, clearly the same concept)
- 0.60-0.80 : reasonable inference from context (implied but not stated)
- below 0.60 : uncertain — mark isConfirmed: false and add to assumptions[]

## MAPPING RULES
1. For each feature/capability mentioned, find the closest canonical ID from the ontology
2. If confidence >= 0.75 → use the existing canonical ID
3. If confidence < 0.75 → create a new entry in newCanonicalEntries[] with a generated snake_case ID
4. Set isConfirmed: true ONLY if the client explicitly said they want this
5. Set isConfirmed: false for anything you inferred from context

## EXTRACTION RULES
- Extract EVERY feature, integration, platform, constraint, user type, or business detail mentioned
- Do not skip anything — it is better to over-extract than under-extract
- If the client says "like Uber but for tutors" → extract: booking_system, user_auth, payment_processing, rating_system, geolocation_services, maps_integration
- featuresToRemove: add canonical IDs here if the client is explicitly removing something previously mentioned
- platformsToRemove: add platforms here if the client is explicitly removing one (e.g. "actually just web, not mobile" → platformsToRemove: ["mobile"])
- Extract tech preferences if the client mentions specific technologies they want or want to avoid
- Extract workflows if the client describes how a business process works step by step

## CORRECTION RULES — when the client corrects or updates a previously stated value
- Budget correction: extract the NEW value in budgetRange (the old one is in CURRENT KNOWN STATE — replace it, don't keep both)
- Timeline correction: extract the NEW value in timelineExpectation
- Platform correction: put the removed platform in platformsToRemove; add the new one in platforms if it's new
- Tech preference correction: extract the new preference in clientTechPreferences (it overwrites the old)
- Scalar field corrections (targetUsers, userScale, authRequirements, etc.): extract the new value — it will overwrite
- NEVER include both old and new values — the client is replacing, not adding

## TIMELINE EXTRACTION — always extract these into timelineExpectation
Any mention of when the client wants to launch, finish, or deliver. Examples:
- "launch in 2 months" → "2 months"
- "I want it ready by July" → "by July"
- "need it in 6 weeks" → "6 weeks"
- "25th July deadline" → "25th July"
- "within a year" → "1 year"
- "ASAP" or "as soon as possible" → "ASAP"
- "thinking to launch it in 2 months" → "2 months"
Always populate timelineExpectation when ANY time reference is mentioned, even vague ones.

## OUTPUT FORMAT
Return ONLY valid JSON. No explanation. No markdown fences. The JSON must match this exact shape:

{
  "features": [{ "canonicalId": string, "rawText": string, "confidence": number, "category": string, "priority": "MUST"|"SHOULD"|"COULD", "isConfirmed": boolean, "dependencies": string[] }],
  "integrations": string[],
  "platforms": string[],
  "authRequirements": string | null,
  "realtimeRequirements": string | null,
  "adminPanelRequirements": string | null,
  "targetUsers": string | null,
  "userScale": string | null,
  "businessModel": "B2B"|"B2C"|"marketplace"|"internal" | null,
  "timelineExpectation": string | null,
  "budgetRange": { "min": number | null, "max": number | null, "currency": string } | null,
  "clientTechPreferences": { "frontend": string?, "backend": string?, "database": string?, "hosting": string?, "avoid": string[], "existingSystems": string[] } | null,
  "compliance": string[],
  "technicalConstraints": string | null,
  "workflows": [{ "name": string, "steps": string[], "actors": string[], "triggers": string[] }],
  "userRoles": [{ "name": string, "permissions": string[], "count": string? }],
  "featuresToRemove": string[],
  "platformsToRemove": string[],
  "assumptions": string[],
  "newCanonicalEntries": [{ "id": string, "canonicalName": string, "category": string, "aliases": string[] }]
}`
}

export function buildExtractionUserPrompt(
  latestMessage: string,
  conversationHistory: string,
  currentStateCompact: string
): string {
  return `## CURRENT KNOWN STATE
${currentStateCompact}

## CONVERSATION SO FAR
${conversationHistory}

## LATEST CLIENT MESSAGE
"${latestMessage}"

Extract all requirements from the latest message. Focus on what is NEW or CHANGED vs. the current state.`
}

/**
 * Compact the state into a minimal string for the extraction prompt.
 * Only includes non-empty fields to keep tokens lean.
 */
export function compactStateForPrompt(state: Record<string, unknown>): string {
  const compact: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) continue
    if (typeof value === 'number' && value === 0) continue
    // Skip internal pipeline fields
    if (['fieldConfidence', 'contradictions', 'ambiguities', 'discoveryTargets',
         'technicalRisks', 'missingInformation', 'conversationSummary'].includes(key)) continue
    compact[key] = value
  }
  return JSON.stringify(compact, null, 2)
}
