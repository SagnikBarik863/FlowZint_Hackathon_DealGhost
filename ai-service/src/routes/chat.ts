import { Hono } from 'hono'
import { createEmptyState } from '@dealghost/shared'
import type { ChatRequest } from '@dealghost/shared'
import { callGroqIntent } from '../models/groq.js'
import { runL2Extraction } from '../pipeline/l2-extraction.js'
import { mergeExtractionIntoState, formatConversationHistory } from '../state/manager.js'
import { loadState, saveState } from '../db/redis.js'
import { prisma } from '../db/prisma.js'

export const chatRoute = new Hono()

chatRoute.post('/', async (c) => {
  const body = await c.req.json<ChatRequest>()
  const { message, conversationId } = body

  if (!message?.trim()) {
    return c.json({ error: 'message is required' }, 400)
  }

  // ── 1. Load or create conversation ────────────────────────────────────────
  let convId = conversationId
  let isNewConversation = false

  if (!convId) {
    // Create a new conversation in DB (requires a Lead — use anonymous lead)
    const conv = await prisma.conversation.create({
      data: {
        lead: {
          create: {
            name: 'Anonymous',
            email: `anon-${Date.now()}@dealghost.internal`,
          },
        },
      },
    })
    convId = conv.id
    isNewConversation = true
  }

  // ── 2. Load state from Redis → Supabase fallback → empty ────────────────
  let state = await loadState(convId)
  if (!state) {
    // Redis miss (expired or first load) — try Supabase before creating blank
    const saved = await prisma.projectAnalysis.findUnique({ where: { conversationId: convId } })
    state = saved
      ? (saved.requirements as unknown as ReturnType<typeof createEmptyState>)
      : createEmptyState(convId)
  }

  // ── 3. Load recent messages from DB for context ───────────────────────────
  const recentMessages = await prisma.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  const conversationHistory = formatConversationHistory(
    recentMessages.map((m) => ({ role: m.role.toLowerCase(), content: m.content }))
  )

  // ── 4. Save the user message to DB ────────────────────────────────────────
  await prisma.message.create({
    data: {
      conversationId: convId,
      role: 'USER',
      content: message,
    },
  })

  // ── 5. Pre-flight: intent classification (Groq — fast, cheap) ────────────
  const intent = await callGroqIntent(message, conversationHistory)

  // ── 6. Route by intent ────────────────────────────────────────────────────
  if (intent === 'READY_FOR_PROPOSAL') {
    const responseMsg = "Great — I have enough information to generate a detailed proposal. Click **Generate Proposal** when you're ready."
    await prisma.message.create({
      data: { conversationId: convId, role: 'ASSISTANT', content: responseMsg },
    })
    return c.json({
      conversationId: convId,
      message: responseMsg,
      state,
      intent,
      readyForProposal: true,
    })
  }

  // ── 7. L2 — Canonical extraction ─────────────────────────────────────────
  const extraction = await runL2Extraction({
    latestMessage: message,
    conversationHistory,
    currentState: state,
  })

  // ── 8. L3 — State merge ───────────────────────────────────────────────────
  const updatedState = mergeExtractionIntoState(state, extraction)

  // ── 9. Generate follow-up question (basic version — replaced by L4 in Phase 3)
  const responseMsg = generateBasicFollowup(updatedState)

  // ── 10. Save state to Redis ───────────────────────────────────────────────
  await saveState(convId, updatedState)

  // ── 11. Persist to Supabase ───────────────────────────────────────────────
  await prisma.projectAnalysis.upsert({
    where: { conversationId: convId },
    create: {
      conversationId: convId,
      requirements: updatedState as unknown as object,
      completeness: updatedState.completenessScore,
      fieldConfidence: updatedState.fieldConfidence,
      confirmedFacts: updatedState.confirmedFacts,
      assumptions: updatedState.assumptions,
      workflows: updatedState.workflows as unknown as object[],
      userRoles: updatedState.userRoles as unknown as object[],
      discoveryTargets: updatedState.discoveryTargets as unknown as object[],
      technicalRisks: updatedState.technicalRisks as unknown as object[],
      keyDiscoveries: updatedState.keyDiscoveries,
      contradictions: updatedState.contradictions as unknown as object[],
      ambiguities: updatedState.ambiguities as unknown as object[],
    },
    update: {
      requirements: updatedState as unknown as object,
      completeness: updatedState.completenessScore,
      fieldConfidence: updatedState.fieldConfidence,
      confirmedFacts: updatedState.confirmedFacts,
      assumptions: updatedState.assumptions,
      workflows: updatedState.workflows as unknown as object[],
      userRoles: updatedState.userRoles as unknown as object[],
      discoveryTargets: updatedState.discoveryTargets as unknown as object[],
      technicalRisks: updatedState.technicalRisks as unknown as object[],
      keyDiscoveries: updatedState.keyDiscoveries,
      contradictions: updatedState.contradictions as unknown as object[],
      ambiguities: updatedState.ambiguities as unknown as object[],
    },
  })

  // ── 12. Save assistant response to DB ────────────────────────────────────
  await prisma.message.create({
    data: { conversationId: convId, role: 'ASSISTANT', content: responseMsg },
  })

  return c.json({
    conversationId: convId,
    message: responseMsg,
    state: updatedState,
    intent,
    readyForProposal: updatedState.completenessScore >= 80,
  })
})

// ── Basic follow-up generator (Phase 2 placeholder — replaced by L4 in Phase 3) ──

const FOLLOW_UP_PRIORITY: Array<{ field: string; question: string }> = [
  { field: 'projectType', question: "What type of project is this — web app, mobile app, marketplace, SaaS platform, or something else?" },
  { field: 'targetUsers', question: "Who are the main users of this platform? Walk me through the key user types." },
  { field: 'platforms', question: "Which platforms do you need — web, iOS, Android, or a combination?" },
  { field: 'features', question: "What are the core features you absolutely need in the first version?" },
  { field: 'authRequirements', question: "How will users log in — email/password, social login (Google, Apple), or something else?" },
  { field: 'budgetRange', question: "Do you have a rough budget in mind for this project?" },
  { field: 'timelineExpectation', question: "When do you need this launched by? Is there a hard deadline?" },
  { field: 'realtimeRequirements', question: "Does anything in the app need to update in real-time — live tracking, chat, notifications?" },
  { field: 'userScale', question: "How many users are you expecting at launch, and where do you see it in a year?" },
]

function generateBasicFollowup(state: ReturnType<typeof createEmptyState>): string {
  // Find the first high-priority field that's still missing
  for (const item of FOLLOW_UP_PRIORITY) {
    const val = (state as Record<string, unknown>)[item.field]
    if (!val || (Array.isArray(val) && val.length === 0)) {
      return item.question
    }
  }

  // All key fields filled — acknowledge and prepare for proposal
  const featureCount = state.features.length
  const platforms = state.platforms.join(' and ')
  return `I have a good picture of your project now — ${featureCount} feature${featureCount !== 1 ? 's' : ''} across ${platforms || 'your platform'}. Completeness is at ${state.completenessScore}%. Would you like me to generate a detailed proposal?`
}
