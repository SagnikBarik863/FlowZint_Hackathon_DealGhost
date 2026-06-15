import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ProposalContent } from '@/types/proposal';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-password') === '123456';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      lead: true,
      analysis: {
        include: {
          conversation: {
            include: { messages: { orderBy: { createdAt: 'asc' } } },
          },
        },
      },
    },
  });

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ proposal });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  let body: { content: ProposalContent };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updated = await prisma.proposal.update({
    where: { id },
    data: { content: body.content as object },
  });

  return NextResponse.json({ id: updated.id, ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  await prisma.proposal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
