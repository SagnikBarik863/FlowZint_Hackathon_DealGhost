import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateProposal } from '@/lib/ai/proposal';
import type { ProjectRequirementState } from '@/types/project';

const BodySchema = z.object({
  conversationId: z.string(),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
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
  if (!analysis) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Update Lead with real email
  await prisma.lead.update({
    where: { id: analysis.conversation.leadId },
    data: { email, status: 'QUALIFIED' },
  });

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
