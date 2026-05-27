import { NextRequest, NextResponse } from 'next/server';

/**
 * Thin proxy — forwards every chat request straight to the ai-service
 * (Hono/Node.js on port 3001) which runs the full L1→L2→L3→L4 pipeline.
 *
 * Request shape (passed through unchanged):
 *   { message: string, conversationId?: string }
 *
 * Response shape (returned as-is from ai-service):
 *   { conversationId, message, state, intent, readyForProposal, debug? }
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${AI_SERVICE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error('[/api/chat proxy] ai-service unreachable:', err);
    return NextResponse.json(
      { error: 'AI service is currently unavailable. Make sure it is running on port 3001.' },
      { status: 503 },
    );
  }
}
