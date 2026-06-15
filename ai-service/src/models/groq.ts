import Groq from 'groq-sdk'

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  ...(process.env.GROQ_ORG_ID ? { organization: process.env.GROQ_ORG_ID } : {}),
})

// 8B — fast, 500K tokens/day free tier
export const GROQ_INTENT_MODEL = 'llama-3.1-8b-instant'
// 70B — accuracy-critical structured extraction and discovery
export const GROQ_MODEL = 'llama-3.3-70b-versatile'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Retry a Groq call on TPM rate-limit (429) errors.
 * Reads retry-after from the error headers; only retries for short waits (≤30s = TPM limit).
 * Daily-limit 429s (retry-after > 30s) are re-thrown immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const e = err as { status?: number; headers?: { get?: (k: string) => string | null } }
      if (e?.status === 429 && attempt < maxRetries) {
        const retryAfterSec = parseInt(e?.headers?.get?.('retry-after') ?? '2', 10)
        if (!isNaN(retryAfterSec) && retryAfterSec <= 30) {
          await sleep(retryAfterSec * 1000 + 200)
          continue
        }
      }
      throw err
    }
  }
  throw new Error('Groq retry limit exceeded')
}

/**
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
  const completion = await withRetry(() =>
    client.chat.completions.create({
      model: opts.model ?? GROQ_MODEL,
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 1024,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: opts.system },
        ...opts.messages,
      ],
    })
  )

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
  const response = await withRetry(() => client.chat.completions.create({
    model: GROQ_INTENT_MODEL,
    temperature: 0,
    max_tokens: 40,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a content moderator for a software agency's pre-sales discovery chatbot.
The chatbot helps clients describe software projects — apps, platforms, SaaS, APIs, marketplaces, etc.

APPROPRIATE (do NOT flag these):
- Describing what a platform will sell, list, manage, or host — e.g. "physical products", "second-hand items", "groceries", "cars", "clothes", "services", "digital content"
- Describing user actions in an app — "buy", "sell", "trade", "list", "book", "rent", "bid"
- Any software feature, tech stack, budget, timeline, integration, design, or scope discussion
- Business domains like food, retail, healthcare, education, real estate, finance, logistics

INAPPROPRIATE (flag these):
- Requests to facilitate clearly illegal activities (drug trafficking, weapons dealing, fraud)
- Dangerous or harmful content (explosives, self-harm instructions)
- Explicit adult/sexual content
- Messages completely unrelated to any software project (e.g. personal advice, political opinions)

KEY RULE: If the message describes WHAT a software platform will handle (even physical goods), it is APPROPRIATE. Only flag if the message itself is harmful or has nothing to do with building software.

Return ONLY valid JSON: {"flagged": boolean, "category": string}
category must be one of: "illegal_activity" | "dangerous_content" | "adult_content" | "off_topic" | ""
If not flagged, category is "".`,
      },
      {
        role: 'user',
        content: `User message: "${userMessage}"`,
      },
    ],
  }))

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
  const response = await withRetry(() => client.chat.completions.create({
    model: GROQ_INTENT_MODEL,
    temperature: 0,
    max_tokens: 20,
    messages: [
      {
        role: 'system',
        content: `You are an intent classifier. Given a client message in a pre-sales discovery conversation, return EXACTLY one of these labels with no other text:

COLLECTING_INFO     — client is describing their project, adding requirements, or answering discovery questions
REQUESTING_DONE     — client wants to finish the conversation, see a summary, or wrap up
CONFIRMING_SUMMARY  — client is confirming or agreeing with a summary that was shown
EDITING_SUMMARY     — client is correcting or modifying something in a summary
READY_FOR_PROPOSAL  — client wants a proposal, quote, or cost estimate generated RIGHT NOW. Examples: "prepare the proposal", "generate the proposal", "make the proposal", "create a proposal", "send me the proposal", "give me a quote", "I want the proposal", "go ahead and generate it", "let's do the proposal", "prepare it", "generate it now", "yes generate", "create the proposal"
SMALL_TALK          — client is making casual conversation: greetings ("hi", "hello", "hey"), pleasantries ("how are you", "what's up"), thank-yous, compliments, or anything not related to their project
ASKING_COMPANY_INFO — client is asking what the company/agency does, what services are offered, what CheatGPT builds, or general info about the development studio ("what do you do?", "what services do you provide?", "tell me about your company")

Return only the label. No explanation. No punctuation.`,
      },
      {
        role: 'user',
        content: `Recent conversation:\n${recentHistory}\n\nLatest message: "${userMessage}"`,
      },
    ],
  }))

  const text = response.choices[0]?.message?.content?.trim() ?? 'COLLECTING_INFO'
  const valid = ['COLLECTING_INFO', 'REQUESTING_DONE', 'CONFIRMING_SUMMARY', 'EDITING_SUMMARY', 'READY_FOR_PROPOSAL', 'SMALL_TALK', 'ASKING_COMPANY_INFO']
  return valid.includes(text) ? text : 'COLLECTING_INFO'
}
