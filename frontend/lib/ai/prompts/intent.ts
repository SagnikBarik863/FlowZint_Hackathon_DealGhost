export const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a pre-sales discovery chatbot.

Classify the user's latest message into EXACTLY ONE of these labels:

  COLLECTING_INFO     — User is sharing project details, requirements, or answering a discovery question
  REQUESTING_DONE     — User signals they are finished sharing and want to see a project summary
  CONFIRMING_SUMMARY  — User confirms the shown project summary is correct
  EDITING_SUMMARY     — User wants to add, remove, or change something in the shown summary
  READY_FOR_PROPOSAL  — User explicitly requests the proposal to be generated now

Rules:
- Output ONLY the label. One word/phrase, nothing else. No punctuation. No explanation.
- Default to COLLECTING_INFO when genuinely unsure.
- CONFIRMING_SUMMARY and EDITING_SUMMARY are only valid when a project summary was previously shown.
- A short "yes" or "no" mid-conversation (not after a summary) is COLLECTING_INFO.
- "proceed" or "go ahead" mid-conversation means COLLECTING_INFO unless a summary was shown.

Examples (no summary shown):
"I want to build a food delivery app"           → COLLECTING_INFO
"it needs real-time GPS tracking"               → COLLECTING_INFO
"yes, it should support iOS and Android"        → COLLECTING_INFO
"no, I don't need delivery"                     → COLLECTING_INFO
"I think that covers everything"                → REQUESTING_DONE
"that's all I have for now"                     → REQUESTING_DONE
"wrap it up"                                    → REQUESTING_DONE
"yeah I think we're good"                       → REQUESTING_DONE
"I'm done sharing"                              → REQUESTING_DONE
"can we move forward"                           → REQUESTING_DONE
"generate the proposal"                         → READY_FOR_PROPOSAL
"let's create the proposal now"                 → READY_FOR_PROPOSAL

Examples (summary WAS shown):
"yes looks right"                               → CONFIRMING_SUMMARY
"that looks good to me"                         → CONFIRMING_SUMMARY
"perfect, proceed"                              → CONFIRMING_SUMMARY
"all correct"                                   → CONFIRMING_SUMMARY
"looks good, go ahead"                          → CONFIRMING_SUMMARY
"remove the loyalty program"                    → EDITING_SUMMARY
"add dark mode as a feature"                    → EDITING_SUMMARY
"the budget should be $30k not $50k"            → EDITING_SUMMARY
"that's not right, I said iOS only"             → EDITING_SUMMARY
"I want to add one more thing"                  → EDITING_SUMMARY`;

export function buildIntentUserPrompt(
  lastUserMessage: string,
  summaryWasShown: boolean,
  recentHistory: Array<{ role: string; content: string }>,
): string {
  const historyText = recentHistory
    .slice(-4)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  return `CONTEXT:
Project summary was shown to the user before this message: ${
    summaryWasShown
      ? 'YES — the previous assistant message displayed the full project summary ending with "Does this look right?"'
      : 'NO — this is a normal discovery conversation, no summary has been shown yet'
  }

RECENT CONVERSATION:
${historyText}

USER'S LATEST MESSAGE: "${lastUserMessage}"

Classify:`;
}
