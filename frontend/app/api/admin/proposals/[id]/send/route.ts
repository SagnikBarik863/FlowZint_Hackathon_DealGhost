import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ProposalContent } from '@/types/proposal';
import { sendProposalEmail } from '@/lib/email/send-proposal';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (req.headers.get('x-admin-password') !== '123456') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      lead: { select: { email: true } },
      analysis: { select: { requirements: true } },
    },
  });

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const leadEmail = proposal.lead.email;
  if (!leadEmail || leadEmail.endsWith('@dealghost.internal')) {
    return NextResponse.json({ error: 'No valid customer email on file' }, { status: 422 });
  }

  const content = proposal.content as unknown as ProposalContent;
  const reqs = proposal.analysis?.requirements as Record<string, unknown> | null;
  const projectName = (reqs?.projectName as string) ?? undefined;

  try {
    await sendProposalEmail(leadEmail, content, projectName);
  } catch (err) {
    console.error('[send-proposal]', err);
    const msg = err instanceof Error ? err.message : 'Email send failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await prisma.proposal.update({
    where: { id },
    data: { status: 'SENT', sentAt: new Date() },
  });

  return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
}
