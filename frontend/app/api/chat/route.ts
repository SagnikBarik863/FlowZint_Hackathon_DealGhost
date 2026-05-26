import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { extractRequirements } from '@/lib/ai/extraction';
import { generateFollowupQuestion } from '@/lib/ai/followup';
import { scoreLead } from '@/lib/ai/scoring';
import { mergeState, detectMissingInfo, inferComplexity, calculateCompleteness } from '@/lib/ai/state-manager';
import { emptyProjectRequirementState, ProjectRequirementState } from '@/types/project';

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  // Pass to continue an existing session; omit to start fresh
  conversationId: z.string().optional(),
  // All optional — omitting creates an anonymous lead automatically
  leadInfo: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    company: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  // ── Parse & validate ────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { message, conversationId, leadInfo } = parsed.data;

  // ── Resolve or create Lead + Conversation ───────────────────────────────
  let conversation: { id: string; leadId: string };

  if (conversationId) {
    const found = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, leadId: true },
    });
    if (!found) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    conversation = found;
  } else {
    // Auto-create a lead — use provided info or anonymous fallback
    const lead = leadInfo?.email
      ? await prisma.lead.upsert({
          where: { email: leadInfo.email },
          update: {
            name: leadInfo.name ?? 'Anonymous',
            company: leadInfo.company ?? null,
            status: 'ACTIVE',
          },
          create: {
            name: leadInfo.name ?? 'Anonymous',
            email: leadInfo.email,
            company: leadInfo.company ?? null,
            status: 'ACTIVE',
          },
        })
      : await prisma.lead.create({
          data: {
            name: leadInfo?.name ?? 'Anonymous',
            // Generate a unique placeholder email so the unique constraint holds
            email: `anon_${Date.now()}_${Math.random().toString(36).slice(2)}@dealghost.tmp`,
            company: leadInfo?.company ?? null,
            status: 'ACTIVE',
          },
        });

    conversation = await prisma.conversation.create({
      data: { leadId: lead.id, status: 'ACTIVE' },
      select: { id: true, leadId: true },
    });
  }

  // ── Save user message ────────────────────────────────────────────────────
  await prisma.message.create({
    data: { conversationId: conversation.id, role: 'USER', content: message },
  });

  // ── Load full conversation history ───────────────────────────────────────
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  });

  const conversationHistory = messages.map((m) => ({
    role: m.role.toLowerCase(),
    content: m.content,
  }));

  // ── Load or initialise state ─────────────────────────────────────────────
  const existingAnalysis = await prisma.projectAnalysis.findUnique({
    where: { conversationId: conversation.id },
  });

  const currentState: ProjectRequirementState = existingAnalysis
    ? (existingAnalysis.requirements as unknown as ProjectRequirementState)
    : emptyProjectRequirementState();

  // ── AI pipeline — extract first, then score + followup in parallel ────────
  const extracted = await extractRequirements(conversationHistory, currentState);

  const merged = mergeState(currentState, extracted as Partial<ProjectRequirementState>);
  const missingInfo = detectMissingInfo(merged);
  const complexity = inferComplexity(merged);
  const completeness = calculateCompleteness(merged);

  // Build intermediate state so scoreLead and followup both see current-turn data
  const stateForScoring: ProjectRequirementState = {
    ...merged,
    inferredComplexity: complexity,
    completenessScore: completeness,
    missingInformation: missingInfo,
  };

  // Now score + generate followup in parallel — both use the freshly-merged state
  const [leadScore, followupQuestion] = await Promise.all([
    scoreLead(stateForScoring, conversationHistory),
    generateFollowupQuestion(stateForScoring, missingInfo, conversationHistory),
  ]);

  const updatedState: ProjectRequirementState = {
    ...stateForScoring,
    leadScore,
  };

  // ── Persist analysis ─────────────────────────────────────────────────────
  const analysisPayload = {
    requirements: updatedState as object,
    missingInfo: missingInfo as object[],
    techStack: (updatedState.recommendedTechStack ?? {}) as object,
    complexity: complexity as 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE',
    completeness,
    budgetMin: updatedState.budgetRange.min,
    budgetMax: updatedState.budgetRange.max,
    industry: updatedState.industry,
    summary: updatedState.summary,
  };

  await prisma.projectAnalysis.upsert({
    where: { conversationId: conversation.id },
    update: analysisPayload,
    create: { conversationId: conversation.id, ...analysisPayload },
  });

  // Update lead score
  await prisma.lead.update({
    where: { id: conversation.leadId },
    data: { score: leadScore.score },
  });

  // Save assistant reply
  await prisma.message.create({
    data: { conversationId: conversation.id, role: 'ASSISTANT', content: followupQuestion },
  });

  // Count how many messages the client (user) has sent — used by the UI to gate the proposal button
  const userMessageCount = conversationHistory.filter((m) => m.role === 'user').length;

  // ── Response ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    conversationId: conversation.id,
    message: followupQuestion,
    state: updatedState,
    userMessageCount,
  });
}
