import { Hono } from 'hono'
import { createEmptyState } from '@dealghost/shared'
import type { ChatRequest } from '@dealghost/shared'
import { callGroqIntent } from '../models/groq.js'
import { runFullPipeline } from '../pipeline/orchestrator.js'
import { formatConversationHistory } from '../state/manager.js'
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

  // ── 2. Load state from Redis → Supabase fallback → empty ─────────────────
  let state = await loadState(convId)
  if (!state) {
    const saved = await prisma.projectAnalysis.findUnique({ where: { conversationId: convId } })
    state = saved
      ? (saved.requirements as unknown as ReturnType<typeof createEmptyState>)
      : createEmptyState(convId)
  }

  // ── 3. Load recent messages from DB for conversation history ──────────────
  const recentMessages = await prisma.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  const conversationHistory = formatConversationHistory(
    recentMessages.map((m) => ({ role: m.role.toLowerCase(), content: m.content }))
  )

  // ── 4. Save user message to DB ────────────────────────────────────────────
  await prisma.message.create({
    data: { conversationId: convId, role: 'USER', content: message },
  })

  // ── 5. Pre-flight intent check (Groq — fast/cheap) ────────────────────────
  const intent = await callGroqIntent(message, conversationHistory)

  // ── 6. Route: READY_FOR_PROPOSAL bypasses the pipeline ───────────────────
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

  // ── 7. Full pipeline: L1 → L2 → L3 → L4 ─────────────────────────────────
  let result: Awaited<ReturnType<typeof runFullPipeline>>
  try {
    result = await runFullPipeline({
      latestMessage: message,
      conversationHistory,
      currentState: state,
    })
  } catch (pipelineErr) {
    console.error('[pipeline] runFullPipeline failed:', pipelineErr)
    const fallback = "I'm having a moment — could you send that again? 🙏"
    await prisma.message.create({
      data: { conversationId: convId, role: 'ASSISTANT', content: fallback },
    })
    return c.json({
      conversationId: convId,
      message: fallback,
      state,
      intent,
      readyForProposal: false,
    })
  }

  // ── 8. Save state to Redis ────────────────────────────────────────────────
  await saveState(convId, result.state)

  // ── 9. Persist intelligence to Supabase ──────────────────────────────────
  await prisma.projectAnalysis.upsert({
    where: { conversationId: convId },
    create: {
      conversationId: convId,
      requirements: result.state as unknown as object,
      completeness: result.state.completenessScore,
      fieldConfidence: result.state.fieldConfidence,
      confirmedFacts: result.state.confirmedFacts,
      assumptions: result.state.assumptions,
      workflows: result.state.workflows as unknown as object[],
      userRoles: result.state.userRoles as unknown as object[],
      discoveryTargets: result.state.discoveryTargets as unknown as object[],
      technicalRisks: result.state.technicalRisks as unknown as object[],
      keyDiscoveries: result.state.keyDiscoveries,
      contradictions: result.state.contradictions as unknown as object[],
      ambiguities: result.state.ambiguities as unknown as object[],
    },
    update: {
      requirements: result.state as unknown as object,
      completeness: result.state.completenessScore,
      fieldConfidence: result.state.fieldConfidence,
      confirmedFacts: result.state.confirmedFacts,
      assumptions: result.state.assumptions,
      workflows: result.state.workflows as unknown as object[],
      userRoles: result.state.userRoles as unknown as object[],
      discoveryTargets: result.state.discoveryTargets as unknown as object[],
      technicalRisks: result.state.technicalRisks as unknown as object[],
      keyDiscoveries: result.state.keyDiscoveries,
      contradictions: result.state.contradictions as unknown as object[],
      ambiguities: result.state.ambiguities as unknown as object[],
    },
  })

  // ── 10. Save assistant response to DB ────────────────────────────────────
  await prisma.message.create({
    data: { conversationId: convId, role: 'ASSISTANT', content: result.response },
  })

  return c.json({
    conversationId: convId,
    message: result.response,
    state: result.state,
    intent,
    readyForProposal: result.readyForProposal,
    debug: {
      l1_intent: result.l1.semanticIntent,
      l4_strategy: result.l4.strategy,
      l4_targetField: result.l4.targetField,
      completeness: result.state.completenessScore,
    },
  })
})
