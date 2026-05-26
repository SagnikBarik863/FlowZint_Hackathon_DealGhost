import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateProposal } from '@/lib/ai/proposal';
import { ProjectRequirementState } from '@/types/project';

const ProposalRequestSchema = z.object({
  conversationId: z.string(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ProposalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { conversationId } = parsed.data;

  // ── Load the conversation's analysis ────────────────────────────────────
  const analysis = await prisma.projectAnalysis.findUnique({
    where: { conversationId },
    include: { conversation: { select: { leadId: true } } },
  });

  if (!analysis) {
    return NextResponse.json(
      { error: 'No analysis found for this conversation. Have a chat first.' },
      { status: 404 },
    );
  }

  const state = analysis.requirements as unknown as ProjectRequirementState;

  // ── Generate proposal ────────────────────────────────────────────────────
  let proposalContent;
  try {
    proposalContent = await generateProposal(state);
  } catch (err) {
    console.error('[/api/proposal] generation failed:', err);
    return NextResponse.json({ error: 'Proposal generation failed' }, { status: 500 });
  }

  // ── Determine version (increment if re-generating) ───────────────────────
  const existingProposals = await prisma.proposal.count({
    where: { analysisId: analysis.id },
  });

  // ── Save to DB ───────────────────────────────────────────────────────────
  const proposal = await prisma.proposal.create({
    data: {
      leadId: analysis.conversation.leadId,
      analysisId: analysis.id,
      status: 'DRAFT',
      version: existingProposals + 1,
      content: proposalContent as object,
      totalMin: proposalContent.pricing.breakdown.reduce((sum, item) => sum + item.costUsd, 0) * 0.85 | 0,
      totalMax: proposalContent.pricing.totalUsd,
    },
  });

  // Mark conversation as completed
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'COMPLETED' },
  });

  // Qualify the lead
  await prisma.lead.update({
    where: { id: analysis.conversation.leadId },
    data: { status: 'QUALIFIED' },
  });

  return NextResponse.json({
    proposalId: proposal.id,
    version: proposal.version,
    proposal: proposalContent,
  });
}
