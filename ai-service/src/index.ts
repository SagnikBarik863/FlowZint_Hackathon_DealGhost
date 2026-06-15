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


const port = Number(process.env.PORT ?? 3001)
console.log(`AI service starting on port ${port}`)

serve({ fetch: app.fetch, port })

export default app
