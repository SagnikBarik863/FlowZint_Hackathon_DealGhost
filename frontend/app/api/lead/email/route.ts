import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateProposal } from '@/lib/ai/proposal';
import type { ProjectRequirementState } from '@/types/project';

// 3 attempts per IP per 10 minutes
const emailLimits = new Map<string, { count: number; resetAt: number }>();
function checkEmailRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = emailLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    emailLimits.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

const BodySchema = z.object({
  conversationId: z.string(),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkEmailRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { conversationId, email } = parsed.data;

  // Find analysis + lead via conversation
  const analysis = await prisma.projectAnalysis.findUnique({
    where: { conversationId },
    include: { conversation: { select: { leadId: true } } },
  });
  if (!analysis || !analysis.conversation?.leadId) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Update Lead with real email.
  // If another lead already owns this email (returning user / duplicate test session),
  // reclaim it by moving their email to a placeholder, then set it on the current lead.
  try {
    await prisma.lead.update({
      where: { id: analysis.conversation.leadId },
      data: { email, status: 'QUALIFIED' },
    });
  } catch (err: unknown) {
    const isUniqueViolation =
      typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
    if (isUniqueViolation) {
      await prisma.lead.updateMany({
        where: { email, NOT: { id: analysis.conversation.leadId } },
        data: { email: `reclaimed-${Date.now()}@dealghost.internal` },
      });
      await prisma.lead.update({
        where: { id: analysis.conversation.leadId },
        data: { email, status: 'QUALIFIED' },
      });
    } else {
      throw err;
    }
  }

  // Generate AI proposal
  const state = analysis.requirements as unknown as ProjectRequirementState;
  let proposalContent;
  try {
    proposalContent = await generateProposal(state);
  } catch (err) {
    console.error('[lead/email] proposal generation failed:', err);
    return NextResponse.json({ error: 'Proposal generation failed' }, { status: 500 });
  }

  // Save proposal as DRAFT
  const existingCount = await prisma.proposal.count({ where: { analysisId: analysis.id } });
  const proposal = await prisma.proposal.create({
    data: {
      leadId: analysis.conversation.leadId,
      analysisId: analysis.id,
      status: 'DRAFT',
      version: existingCount + 1,
      content: proposalContent as object,
      totalMin: Math.round(
        proposalContent.pricing.breakdown.reduce((s, i) => s + i.costUsd, 0) * 0.85
      ),
      totalMax: proposalContent.pricing.totalUsd,
    },
  });

  // Mark conversation as completed
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'COMPLETED' },
  });

  return NextResponse.json({ proposalId: proposal.id, success: true });
}
