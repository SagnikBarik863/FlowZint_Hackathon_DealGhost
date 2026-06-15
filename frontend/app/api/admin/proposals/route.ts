import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-password') === '123456';
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      lead: { select: { email: true, name: true, createdAt: true } },
      analysis: { select: { completeness: true, requirements: true } },
    },
  });

  const result = proposals.map((p) => {
    const reqs = p.analysis?.requirements as Record<string, unknown> | null;
    return {
      id: p.id,
      status: p.status,
      version: p.version,
      totalMin: p.totalMin,
      totalMax: p.totalMax,
      createdAt: p.createdAt,
      sentAt: p.sentAt,
      lead: p.lead,
      completeness: p.analysis?.completeness ?? 0,
      projectType: (reqs?.projectType as string) ?? null,
      projectName: (reqs?.projectName as string) ?? null,
      description: (reqs?.description as string) ?? null,
    };
  });

  return NextResponse.json({ proposals: result });
}
