import { callClaude } from '../models/claude.js'
import { MODELS } from '../models/constants.js'

/**
 * Compress old conversation turns into a concise summary.
 *
 * Triggered when conversation exceeds MAX_FULL_TURNS. Keeps the most recent
 * turns verbatim and compresses older ones into a 3–5 sentence summary stored
 * in state.conversationSummary.
 *
 * Why this matters: at 30+ turns, the raw conversation history sent to L2/L4
 * would burn ~15k tokens per call. Compression keeps cost and latency flat.
 */

const MAX_FULL_TURNS = 12      // keep last N turns verbatim
const COMPRESS_THRESHOLD = 16  // trigger compression when total turns exceed this

export interface ConversationTurn {
  role: string
  content: string
}

/**
 * Returns the conversation history string to include in prompts.
 * Prepends any existing summary to keep full context.
 */
export function buildConversationContext(
  turns: ConversationTurn[],
  existingSummary: string | null
): string {
  if (turns.length <= MAX_FULL_TURNS) {
    const history = turns.map(t => `${t.role.toUpperCase()}: ${t.content}`).join('\n')
    return existingSummary
      ? `[EARLIER CONTEXT]\n${existingSummary}\n\n[RECENT CONVERSATION]\n${history}`
      : history
  }

  // More turns than MAX_FULL_TURNS — only show recent ones
  const recentTurns = turns.slice(-MAX_FULL_TURNS)
  const history = recentTurns.map(t => `${t.role.toUpperCase()}: ${t.content}`).join('\n')

  return existingSummary
    ? `[EARLIER CONTEXT]\n${existingSummary}\n\n[RECENT CONVERSATION]\n${history}`
    : history
}

/**
 * Compresses old turns into a concise summary using Haiku.
 * Call this when total turns exceed COMPRESS_THRESHOLD.
 * Returns { summary, recentTurns } — store summary in state, send recentTurns to prompts.
 */
export async function compressConversation(
  turns: ConversationTurn[],
  existingSummary: string | null
): Promise<{ summary: string; recentTurns: ConversationTurn[] }> {
  if (turns.length <= COMPRESS_THRESHOLD) {
    return { summary: existingSummary ?? '', recentTurns: turns }
  }

  const recentTurns = turns.slice(-MAX_FULL_TURNS)
  const olderTurns = turns.slice(0, -MAX_FULL_TURNS)

  const turnsToSummarise = olderTurns.map(t => `${t.role.toUpperCase()}: ${t.content}`).join('\n')

  const systemPrompt = `You are summarising a pre-sales discovery conversation about a software project.
Create a concise 3–5 sentence summary that captures:
- What type of project is being built
- The key features and requirements mentioned
- Any constraints (budget, timeline, tech preferences)
- Anything the client corrected or changed

Write in past tense. Be factual. No filler phrases. Return ONLY the summary text — no headers, no bullets.`

  const userPrompt = existingSummary
    ? `Previous summary:\n${existingSummary}\n\nNew turns to incorporate:\n${turnsToSummarise}\n\nWrite an updated summary.`
    : `Conversation turns to summarise:\n${turnsToSummarise}\n\nWrite the summary.`

  const response = await callClaude({
    model: MODELS.MEMORY_COMPRESSION,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 300,
    temperature: 0,
  })

  return {
    summary: response.content.trim(),
    recentTurns,
  }
}

export { COMPRESS_THRESHOLD }
