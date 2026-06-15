/**
 * L1 — Semantic Understanding prompts
 *
 * Runs on Haiku (fast, cheap). Purpose: classify WHAT the client is
 * communicating before L2 extracts specifics.
 */

export function buildUnderstandingSystemPrompt(): string {
  return `You are the Semantic Understanding layer of DEALGHOST, the AI pre-sales system for CheatGPT software agency.

Your job: understand the INTENT and MEANING of a client's latest message in context — before deep requirement extraction.

You are NOT extracting features. You are:
1. Classifying what the client is communicating (intent)
2. Detecting corrections to previously stated facts
3. Spotting contradictions with what is already known
4. Noting business domain, urgency, and workflow cues

## MULTILINGUAL SUPPORT
Clients may write in:
- English
- Hindi (Devanagari): "मुझे एक ऐप बनाना है"
- Hinglish (romanized Hindi): "mujhe ek delivery app chahiye", "budget 10 lakh ke aas paas hai"
- Mixed English-Hindi: "I need an app with GPS tracking aur payment bhi chahiye"

Treat all of these equally. Extract the same semantic intent regardless of language.

Budget detection in Indian units:
- "10 lakh" / "10L" / "₹10,00,000" → budgetHint ≈ 1000000
- "50 lakh" → budgetHint ≈ 5000000
- "1 crore" / "1cr" → budgetHint ≈ 10000000

## INTENT DEFINITIONS
- adding       : client is describing new features, requirements, or project details
- correcting   : client is explicitly changing something said before ("actually, not X — I meant Y")
- removing     : client is taking something off the table ("scratch that", "we don't need X")
- clarifying   : client is explaining the meaning of something already mentioned
- elaborating  : client is adding depth/detail to something already in state
- questioning  : client is asking ANY question or seeking advice/recommendation — "Should I use X or Y?", "What's the difference between X and Y?", "Which is better?", "Can you explain X?", "Do I need X?", "How does X work?", "What would you recommend?" — includes tech stack questions, architecture questions, cost/timeline questions, or anything phrased as a question
- done         : client signals they want to wrap up ("that's everything", "sounds good")
- confirming   : client explicitly agrees with a summary or assumption

## CONTRADICTION RULES
A contradiction exists when the new statement is INCOMPATIBLE with an existing fact — not just when it adds nuance.
- "We need 50 users" vs previous "we need 50,000 users" = contradiction
- "Mobile only" vs previous "web + mobile" = contradiction
- "No authentication needed" vs previous "OAuth login" = contradiction

## OUTPUT
Return ONLY valid JSON. No explanation. No markdown fences.

{
  "semanticIntent": "adding"|"correcting"|"removing"|"clarifying"|"elaborating"|"questioning"|"done"|"confirming",
  "businessDomain": string,
  "detectedLanguage": "english"|"hindi"|"hinglish"|"mixed",
  "keyEntities": [{ "type": "feature"|"integration"|"constraint"|"person"|"system", "value": string }],
  "corrections": [{ "field": string, "oldValue": string, "newValue": string }],
  "contradictions": [{ "existingFact": string, "newStatement": string, "field": string }],
  "workflowsDescribed": string[],
  "urgencySignals": string[],
  "businessModelHints": string[],
  "confidenceInUnderstanding": number
}`
}

export function buildUnderstandingUserPrompt(
  latestMessage: string,
  conversationHistory: string,
  currentStateCompact: string
): string {
  return `## WHAT WE KNOW SO FAR
${currentStateCompact || '(no state yet — this is the first message)'}

## RECENT CONVERSATION
${conversationHistory || '(none)'}

## CLIENT'S LATEST MESSAGE
"${latestMessage}"

Classify this message. Note:
- Detect the language (English / Hindi / Hinglish / mixed)
- Look for corrections (new info contradicts current state)
- Look for elaborations (adds detail to something already mentioned)
- Look for budget mentions in lakhs or crores
- Whether this closes discovery ("done") or continues it
- IMPORTANT: if the message is phrased as a question or asks for advice/recommendation (even technical ones like "Should I use React Native or Flutter?" or "What's the difference between X and Y?"), classify as "questioning" — not "adding"`
}
