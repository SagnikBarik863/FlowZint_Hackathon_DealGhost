import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete in dependency order: messages → proposals → projectAnalysis → conversation
  await prisma.message.deleteMany({ where: { conversationId: id } });
  if (conv.leadId) {
    const analysis = await prisma.projectAnalysis.findUnique({ where: { conversationId: id } });
    if (analysis) {
      await prisma.proposal.deleteMany({ where: { analysisId: analysis.id } });
    }
  }
  await prisma.projectAnalysis.deleteMany({ where: { conversationId: id } });
  await prisma.conversation.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
