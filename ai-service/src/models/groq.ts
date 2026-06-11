import Groq from 'groq-sdk'

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

// 8B — fast, 500K tokens/day free tier
export const GROQ_INTENT_MODEL = 'llama-3.1-8b-instant'
// 70B — accuracy-critical structured extraction and discovery
export const GROQ_MODEL = 'llama-3.3-70b-versatile'

/**
 * Drop-in replacement for callClaudeJSON.
 * Enforces JSON output via response_format and runs an optional Zod parser.
 */
export async function callGroqJSON<T>(
  opts: {
    model?: string
    system: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    maxTokens?: number
    temperature?: number
  },
  parser?: (raw: string) => T,
): Promise<T> {
  const completion = await client.chat.completions.create({
    model: opts.model ?? GROQ_MODEL,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? 1024,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages,
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? ''

  if (parser) return parser(raw)

  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`Groq returned invalid JSON.\nRaw: ${raw.slice(0, 300)}`)
  }
}

export interface ModerationResult {
  flagged: boolean
  category: string // e.g. "illegal_activity", "adult_content", "off_topic", ""
}

export async function callGroqModerate(userMessage: string): Promise<ModerationResult> {
  const response = await client.chat.completions.create({
    model: GROQ_INTENT_MODEL,
    temperature: 0,
    max_tokens: 40,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a content moderator for a software agency's pre-sales discovery chatbot.
The chatbot exists ONLY to help clients describe software projects (web apps, mobile apps, SaaS, APIs, platforms, etc.).

APPROPRIATE: anything about software — features, tech stack, budget, timeline, integrations, design, project scope.
INAPPROPRIATE: illegal activities, dangerous substances, weapons, explosives, explicit sexual content, violence, self-harm, hate speech, or requests completely unrelated to software development.

Return ONLY valid JSON: {"flagged": boolean, "category": string}
category must be one of: "illegal_activity" | "dangerous_content" | "adult_content" | "off_topic" | ""
If not flagged, category is "".`,
      },
      {
        role: 'user',
        content: `User message: "${userMessage}"`,
      },
    ],
  })

  try {
    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { flagged?: boolean; category?: string }
    return {
      flagged: Boolean(parsed.flagged),
      category: typeof parsed.category === 'string' ? parsed.category : '',
    }
  } catch {
    return { flagged: false, category: '' }
  }
}

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
