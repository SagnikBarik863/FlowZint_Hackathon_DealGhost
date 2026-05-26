import { callGroq, FAST_MODEL } from './groq';
import { INTENT_SYSTEM_PROMPT, buildIntentUserPrompt } from './prompts/intent';

// The five possible conversation states the classifier can return.
export type UserIntent =
  | 'COLLECTING_INFO'     // User is sharing project details or answering a question
  | 'REQUESTING_DONE'     // User signals they are done and want a summary
  | 'CONFIRMING_SUMMARY'  // User confirms the shown summary is correct
  | 'EDITING_SUMMARY'     // User wants to add/remove/change something in the summary
  | 'READY_FOR_PROPOSAL'; // User explicitly requests proposal generation

const VALID_INTENTS: UserIntent[] = [
  'COLLECTING_INFO',
  'REQUESTING_DONE',
  'CONFIRMING_SUMMARY',
  'EDITING_SUMMARY',
  'READY_FOR_PROPOSAL',
];

/**
 * Classify the user's latest message into one of the five conversation states.
 * Uses the fast model (8b) since the output is a single label — no heavy reasoning needed.
 * Always returns a valid UserIntent; falls back to COLLECTING_INFO on any error.
 */
export async function classifyIntent(
  lastUserMessage: string,
  summaryWasShown: boolean,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<UserIntent> {
  // Empty message — treat as info collection (edge case guard)
  if (!lastUserMessage.trim()) return 'COLLECTING_INFO';

  const userPrompt = buildIntentUserPrompt(
    lastUserMessage,
    summaryWasShown,
    conversationHistory,
  );

  try {
    const raw = await callGroq(INTENT_SYSTEM_PROMPT, userPrompt, false, FAST_MODEL);

    // Strip everything except uppercase letters and underscores, then match
    const cleaned = raw.trim().toUpperCase().replace(/[^A-Z_]/g, '');

    // Exact match first, then substring match (in case model adds surrounding text)
    const matched =
      VALID_INTENTS.find((i) => cleaned === i) ??
      VALID_INTENTS.find((i) => cleaned.includes(i));

    if (matched) {
      console.log(`[intent] "${lastUserMessage.slice(0, 60)}…" → ${matched}`);
      return matched;
    }

    console.warn(`[intent] Unexpected output: "${raw}" — defaulting to COLLECTING_INFO`);
    return 'COLLECTING_INFO';
  } catch (err) {
    console.error('[intent] Classification error:', err);
    return 'COLLECTING_INFO';
  }
}
