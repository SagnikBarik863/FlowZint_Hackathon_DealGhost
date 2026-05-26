import Groq from 'groq-sdk'

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

/**
 * Groq is used ONLY for intent classification (pre-flight).
 * Fast (~300ms), cheap (free tier), outputs a single label.
 */
export const GROQ_INTENT_MODEL = 'llama-3.1-8b-instant'

export async function callGroqIntent(userMessage: string, recentHistory: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: GROQ_INTENT_MODEL,
    temperature: 0,
    max_tokens: 20,
    messages: [
      {
        role: 'system',
        content: `You are an intent classifier. Given a client message in a pre-sales discovery conversation, return EXACTLY one of these labels with no other text:

COLLECTING_INFO     — client is describing their project, adding requirements, answering questions
REQUESTING_DONE     — client wants to finish the conversation, see a summary, or wrap up
CONFIRMING_SUMMARY  — client is confirming or agreeing with a summary that was shown
EDITING_SUMMARY     — client is correcting or modifying something in a summary
READY_FOR_PROPOSAL  — client is explicitly asking for a proposal or pricing

Return only the label. No explanation. No punctuation.`,
      },
      {
        role: 'user',
        content: `Recent conversation:\n${recentHistory}\n\nLatest message: "${userMessage}"`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content?.trim() ?? 'COLLECTING_INFO'
  const valid = ['COLLECTING_INFO', 'REQUESTING_DONE', 'CONFIRMING_SUMMARY', 'EDITING_SUMMARY', 'READY_FOR_PROPOSAL']
  return valid.includes(text) ? text : 'COLLECTING_INFO'
}
