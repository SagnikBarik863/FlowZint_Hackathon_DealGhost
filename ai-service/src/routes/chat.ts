import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { PipelineInput } from '@dealghost/shared';

export const chatRoute = new Hono();

const MessageSchema = z.object({
  message: z.string().min(1),
  projectId: z.string(),
  // state and conversationHistory will be added when orchestrator is wired
});

chatRoute.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = MessageSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  // TODO: wire orchestrator in Task 14 (Phase 2 completion)
  return c.json({ message: 'Chat route placeholder — orchestrator not yet wired' }, 501);
});

// SSE endpoint — used by Live Intelligence Panel
chatRoute.post('/stream', async (c) => {
  const body = await c.req.json();
  const parsed = MessageSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: 'status',
      data: JSON.stringify({ stage: 'received', message: parsed.data.message }),
    });
    // TODO: wire SSE events from orchestrator in Task 14
    await stream.writeSSE({ event: 'done', data: '{}' });
  });
});
