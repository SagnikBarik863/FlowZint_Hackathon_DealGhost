import { Hono } from 'hono'
import { createEmptyState } from '@dealghost/shared'
import type { ChatRequest } from '@dealghost/shared'
import { callGroqIntent, callGroqModerate } from '../models/groq.js'
import { runFullPipeline } from '../pipeline/orchestrator.js'
import { formatConversationHistory } from '../state/manager.js'
import { loadState, saveState, getRedis } from '../db/redis.js'
import { prisma } from '../db/prisma.js'

// 20 requests per IP per minute
async function checkChatRateLimit(ip: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const key = `dealghost:rl:chat:${ip}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 60)
    return count <= 20
  } catch {
    return true // if Redis is down, don't block requests
  }
}

function buildRefusalMessage(category: string, contactEmail: string): string {
  const categoryLabel: Record<string, string> = {
    illegal_activity: 'requests involving illegal activities',
    dangerous_content: 'requests involving dangerous or harmful content',
    adult_content: 'adult or explicit content',
    off_topic: 'topics unrelated to software development',
  }
  const reason = categoryLabel[category] ?? 'that type of request'

  return `I'm here to help with **software project discovery** — scoping out apps, platforms, APIs, and digital products. I'm not able to assist with ${reason}.

If you have a **software project** in mind, I'd love to hear about it — just describe what you're looking to build!

For anything else, feel free to reach the team directly: **${contactEmail}**`
}

export const chatRoute = new Hono()

chatRoute.post('/', async (c) => {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'unknown'

  if (!(await checkChatRateLimit(ip))) {
    return c.json({ error: 'Too many requests. Please wait a moment before sending another message.' }, 429)
  }

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

  // Last 3 bot questions — passed to L4 to prevent repeating recently asked topics
  const recentBotQuestions = [...recentMessages]
    .reverse()
    .filter((m) => m.role === 'ASSISTANT')
    .slice(0, 3)
    .map((m) => m.content)

  // ── 4. Save user message to DB ────────────────────────────────────────────
  await prisma.message.create({
    data: { conversationId: convId, role: 'USER', content: message },
  })

  // ── 5. Content moderation (Groq 8B — fast, runs before pipeline) ────────────
  const moderation = await callGroqModerate(message)
  if (moderation.flagged) {
    const contactEmail = process.env.CONTACT_EMAIL ?? 'hello@dealghost.io'
    const refusal = buildRefusalMessage(moderation.category, contactEmail)
    await prisma.message.create({
      data: { conversationId: convId, role: 'ASSISTANT', content: refusal },
    })
    return c.json({
      conversationId: convId,
      message: refusal,
      state,
      intent: 'MODERATED',
      readyForProposal: false,
    })
  }

  // ── 6. Pre-flight intent check (Groq — fast/cheap) ────────────────────────
  const intent = await callGroqIntent(message, conversationHistory)

  // ── 7a. Route: SMALL_TALK — respond warmly, skip the pipeline ───────────────
  if (intent === 'SMALL_TALK') {
    const isFirstMessage = recentMessages.length <= 1 // only the message we just saved
    const responseMsg = isFirstMessage
      ? "Hey! 👋 Doing well, thanks. I'm DealGhost — I help scope out software ideas into proper proposals.\n\nWhat are you looking to build?"
      : "Ha, all good! 😄 You?\n\nAnyway — where were we. Anything to add or change on what we've got so far?"
    await prisma.message.create({
      data: { conversationId: convId, role: 'ASSISTANT', content: responseMsg },
    })
    return c.json({
      conversationId: convId,
      message: responseMsg,
      state,
      intent,
      readyForProposal: false,
    })
  }

  // ── 7b. Route: ASKING_COMPANY_INFO — describe services, skip pipeline ───────
  if (intent === 'ASKING_COMPANY_INFO') {
    const hasContext = recentMessages.length > 1
    const responseMsg = hasContext
      ? "We build software — web apps, mobile apps, SaaS platforms, marketplaces, APIs, AI features, the works. Design and cloud infra too if needed.\n\nAnyway — back to your project. Anything to add or change on what we've got so far?"
      : "CheatGPT builds software — web apps, mobile apps, SaaS platforms, marketplaces, APIs, AI-powered products. UI/UX design and cloud infra too.\n\nMost clients come in with an idea they want to actually ship — and I help scope that out properly so there are no surprises.\n\nSo — what are you looking to build?"
    await prisma.message.create({
      data: { conversationId: convId, role: 'ASSISTANT', content: responseMsg },
    })
    return c.json({
      conversationId: convId,
      message: responseMsg,
      state,
      intent,
      readyForProposal: false,
    })
  }

  // ── 7c. Route: READY_FOR_PROPOSAL bypasses the pipeline ──────────────────
  if (intent === 'READY_FOR_PROPOSAL') {
    const lines: string[] = []

    // Features
    if (state.features.length > 0) {
      lines.push(`**Here's what we've captured so far:**\n`)
      if (state.features.length > 0) {
        lines.push('**Features**')
        for (const f of state.features) {
          const name = f.canonicalId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          lines.push(`- ${name}`)
        }
      }
    }

    // Platforms
    if (state.platforms.length > 0) {
      lines.push(`\n**Platform** — ${state.platforms.join(', ')}`)
    }

    // Budget
    if (state.budgetRange && (state.budgetRange.min !== null || state.budgetRange.max !== null)) {
      const { min, max, currency } = state.budgetRange
      const budgetStr = min !== null && max !== null
        ? `${currency} ${min.toLocaleString()} – ${max.toLocaleString()}`
        : min !== null
        ? `${currency} ${min.toLocaleString()}+`
        : `Up to ${currency} ${max!.toLocaleString()}`
      lines.push(`**Budget** — ${budgetStr}`)
    }

    // Timeline
    if (state.timelineExpectation) {
      lines.push(`**Timeline** — ${state.timelineExpectation}`)
    }

    const summaryBlock = lines.length > 0 ? lines.join('\n') + '\n\n' : ''
    const responseMsg = `${summaryBlock}On it! 🚀 Just drop your email below and I'll send the full detailed proposal straight to your inbox — usually within 24 hours.`

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
      recentBotQuestions,
    })
  } catch (pipelineErr) {
    console.error('[pipeline] runFullPipeline failed:', pipelineErr)
    const fallback = "Hmm, something went sideways on my end — mind sending that again? 🙏"
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
