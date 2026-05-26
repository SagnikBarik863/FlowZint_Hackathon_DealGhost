import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { chatRoute } from './routes/chat.js'

const app = new Hono()

// ── Middleware ────────────────────────────────────────────────────────────────
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'dealghost-ai', timestamp: new Date().toISOString() })
)

// ── Chat ──────────────────────────────────────────────────────────────────────
app.route('/chat', chatRoute)

// ── Debug pipeline (runs L2 + L3 on a test message, returns each layer's output) ─
app.post('/debug/pipeline', async (c) => {
  const body = await c.req.json<{ message: string; conversationId?: string }>()
  const message = body.message ?? 'I need a food delivery app with GPS tracking and Stripe payments'

  const { createEmptyState } = await import('@dealghost/shared')
  const { runL2Extraction } = await import('./pipeline/l2-extraction.js')
  const { mergeExtractionIntoState, calculateCompleteness } = await import('./state/manager.js')

  const state = createEmptyState(body.conversationId ?? 'debug-session')

  const l2Output = await runL2Extraction({
    latestMessage: message,
    conversationHistory: '',
    currentState: state,
  })

  const l3Output = mergeExtractionIntoState(state, l2Output)

  return c.json({
    message,
    layers: {
      l2_extraction: l2Output,
      l3_state: l3Output,
    },
    completenessScore: calculateCompleteness(l3Output),
  })
})

const port = Number(process.env.PORT ?? 3001)
console.log(`AI service starting on port ${port}`)

serve({ fetch: app.fetch, port })

export default app
