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

// Thin wrapper — returns parsed JSON from a structured prompt.
// All AI pipeline functions go through this.
export async function callGroq(
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.3, // low temp = more deterministic extractions
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  return completion.choices[0]?.message?.content ?? '';
}
