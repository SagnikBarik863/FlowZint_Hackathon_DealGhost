import Groq from 'groq-sdk';

const globalForGroq = globalThis as unknown as {
  groq: Groq | undefined;
};

export const groq =
  globalForGroq.groq ?? new Groq({ apiKey: process.env.GROQ_API_KEY });

if (process.env.NODE_ENV !== 'production') {
  globalForGroq.groq = groq;
}

export const MODEL = 'llama-3.3-70b-versatile';

/**
 * Call Groq with a system prompt and user content.
 * @param systemPrompt - The system instruction for the model
 * @param userContent  - The user message / data to process
 * @param structured   - When true, enforces JSON output via response_format.
 *                       Pass true for extraction, scoring, and proposal calls.
 *                       Pass false (default) for plain-text calls (follow-up questions).
 */
export async function callGroq(
  systemPrompt: string,
  userContent: string,
  structured = false,
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    ...(structured ? { response_format: { type: 'json_object' } } : {}),
  });

  return completion.choices[0]?.message?.content ?? '';
}
