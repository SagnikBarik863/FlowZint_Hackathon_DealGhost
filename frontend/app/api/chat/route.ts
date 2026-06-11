import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET  /api/chat?conversationId=xxx  — restore a previous conversation
 * POST /api/chat                      — thin proxy to the ai-service
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  const [messages, analysis] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    }),
    prisma.projectAnalysis.findUnique({
      where: { conversationId },
      select: { requirements: true },
    }),
  ]);

  if (messages.length === 0) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  return NextResponse.json({
    messages: messages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    })),
    state: analysis?.requirements ?? null,
  });
}

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
