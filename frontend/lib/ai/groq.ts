import Groq from 'groq-sdk';

const globalForGroq = globalThis as unknown as {
  groq: Groq | undefined;
};

export const groq =
  globalForGroq.groq ?? new Groq({ apiKey: process.env.GROQ_API_KEY });

if (process.env.NODE_ENV !== 'production') {
  globalForGroq.groq = groq;
}

// Primary model — used for extraction, follow-up questions, scoring, proposals.
// 70B is significantly smarter at instruction-following and nuanced reasoning.
export const MODEL = 'llama-3.3-70b-versatile';

// Fast model — used for intent classification only (output is a single label,
// so a smaller model is sufficient and saves quota on the 70B tier).
export const FAST_MODEL = 'llama-3.1-8b-instant';

/**
 * Call Groq with a system prompt and user content.
 * @param systemPrompt - The system instruction for the model
 * @param userContent  - The user message / data to process
 * @param structured   - When true, enforces JSON output via response_format.
 *                       Pass true for extraction, scoring, and proposal calls.
 *                       Pass false (default) for plain-text calls (follow-up questions).
 * @param model        - Override the model. Defaults to MODEL (70b). Pass FAST_MODEL for
 *                       quick classification calls that don't need heavy reasoning.
 */
export async function callGroq(
  systemPrompt: string,
  userContent: string,
  structured = false,
  model = MODEL,
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    ...(structured ? { response_format: { type: 'json_object' } } : {}),
  });

  return completion.choices[0]?.message?.content ?? '';
}
