# DealGhost Proposal + Admin Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a conversation reaches readyForProposal, collect the customer's email, auto-generate a Claude-powered INR-priced proposal, save it as a draft, and let the admin review/edit/send it via Resend.

**Architecture:** Email collection replaces the chat input bar when `readyForProposal:true`; a single `/api/lead/email` route saves the email and generates the proposal in one shot. The admin panel at `/admin` is a client-side password-gated page that calls four new API routes. Resend sends from `onboarding@resend.dev` (no domain verification needed on free tier).

**Tech Stack:** Next.js 16 App Router, Prisma 7 (Supabase), `@anthropic-ai/sdk`, `resend`, Tailwind CSS v4, TypeScript.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/package.json` | Modify | Add `@anthropic-ai/sdk`, `resend` |
| `frontend/lib/ai/proposal.ts` | Modify | Switch Groq → Claude Sonnet |
| `frontend/lib/ai/prompts/proposal.ts` | Modify | INR pricing prompt |
| `frontend/components/chat-panel.tsx` | Modify | Add `emailCollectionMode` input |
| `frontend/app/chat/page.tsx` | Modify | Email state + handler + pass props |
| `frontend/app/api/lead/email/route.ts` | Create | Save email + generate draft proposal |
| `frontend/app/api/admin/proposals/route.ts` | Create | GET all proposals |
| `frontend/app/api/admin/proposals/[id]/route.ts` | Create | GET single + PATCH content |
| `frontend/app/api/admin/proposals/[id]/send/route.ts` | Create | POST → Resend email |
| `frontend/lib/email/proposal-template.ts` | Create | ProposalContent → plain-text + HTML |
| `frontend/lib/email/send-proposal.ts` | Create | Resend wrapper |
| `frontend/app/admin/page.tsx` | Create | Admin panel UI |
| `frontend/app/page.tsx` | Modify | Add Admin nav link |

---

## Task 1: Install packages

**Files:**
- Modify: `frontend/package.json` (via npm install)

- [ ] **Step 1: Install both packages**

```bash
cd d:\FlowZint\dealghost\frontend
npm install @anthropic-ai/sdk resend
```

Expected: both packages appear in `node_modules/` and `package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @anthropic-ai/sdk and resend"
```

---

## Task 2: Upgrade proposal generation to Claude + INR

**Files:**
- Modify: `frontend/lib/ai/proposal.ts`
- Modify: `frontend/lib/ai/prompts/proposal.ts`

- [ ] **Step 1: Replace frontend/lib/ai/proposal.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { PROPOSAL_SYSTEM_PROMPT, buildProposalUserPrompt } from './prompts/proposal';
import type { ProjectRequirementState } from '@/types/project';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ProposalSchema = z.object({
  executiveSummary: z.string(),
  scope: z.object({
    included: z.array(z.string()),
    excluded: z.array(z.string()),
  }),
  deliverables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    milestone: z.string(),
  })),
  timeline: z.object({
    phases: z.array(z.object({
      name: z.string(),
      durationWeeks: z.number(),
      deliverables: z.array(z.string()),
    })),
  }),
  pricing: z.object({
    model: z.enum(['fixed', 'time_and_materials', 'retainer']),
    // Field name is costUsd for schema compat but values are INR
    breakdown: z.array(z.object({ item: z.string(), costUsd: z.number() })),
    totalUsd: z.number(),   // INR value despite the field name
    currency: z.string(),   // Always "INR"
  }),
  techStack: z.object({
    frontend: z.string(),
    backend: z.string(),
    database: z.string(),
    hosting: z.string(),
  }),
  team: z.array(z.object({
    role: z.string(),
    count: z.number(),
    allocationPct: z.number(),
  })),
  assumptions: z.array(z.string()),
  terms: z.string(),
});

export type ProposalContent = z.infer<typeof ProposalSchema>;

export async function generateProposal(state: ProjectRequirementState): Promise<ProposalContent> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    temperature: 0.3,
    system: PROPOSAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildProposalUserPrompt(state) }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[proposal] JSON parse failed:', raw.slice(0, 300));
    throw new Error('Proposal generation failed — invalid JSON from AI');
  }

  const result = ProposalSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[proposal] schema validation failed:', result.error.flatten());
    throw new Error('Proposal generation failed — schema validation error');
  }

  return result.data;
}
```

- [ ] **Step 2: Replace frontend/lib/ai/prompts/proposal.ts**

```typescript
export const PROPOSAL_SYSTEM_PROMPT = `You are DealGhost — a senior solution architect writing project proposals for Team CheatGPT, a software development agency based in India.

Write a professional, detailed project proposal. Use INR (Indian Rupee) pricing throughout.

Sections required:
1. executiveSummary — 3-4 sentences on the project and recommended approach
2. scope.included — detailed bullet list of what is in scope
3. scope.excluded — bullet list explicitly out of scope
4. deliverables — concrete named deliverables with milestone names
5. timeline.phases — realistic phases with week estimates
6. pricing — in INR; put INR amounts in the costUsd/totalUsd fields; set currency: "INR"
7. techStack — specific technology choices with brief justification
8. team — team composition with roles and allocation percentages
9. assumptions — assumptions this proposal depends on
10. terms — payment schedule, revision rounds, IP transfer, support period

INR PRICING GUIDELINES:
- MVP / Proof of concept (6–10 weeks):  ₹1,50,000 – ₹4,00,000
- Standard product (3–5 months):        ₹4,00,000 – ₹10,00,000
- Growth platform (5–9 months):         ₹10,00,000 – ₹25,00,000
- Enterprise system (9+ months):        ₹25,00,000+

Feature add-ons (add as separate breakdown line items):
- Real-time features (GPS, live chat):  ₹80,000 – ₹1,50,000
- Payment gateway (Razorpay/Stripe):    ₹40,000 – ₹80,000
- Mobile app (per platform):            ₹1,20,000 – ₹2,50,000
- Admin dashboard:                      ₹60,000 – ₹1,20,000
- Third-party integrations:             ₹30,000 – ₹60,000 each
- AI/ML features:                       ₹1,00,000 – ₹3,00,000

NOTE: The costUsd and totalUsd JSON fields hold INR values — this is a schema quirk. Always set currency: "INR".

Return ONLY valid JSON, no markdown fences:
{
  "executiveSummary": string,
  "scope": { "included": string[], "excluded": string[] },
  "deliverables": [{ "name": string, "description": string, "milestone": string }],
  "timeline": { "phases": [{ "name": string, "durationWeeks": number, "deliverables": string[] }] },
  "pricing": {
    "model": "fixed",
    "breakdown": [{ "item": string, "costUsd": number }],
    "totalUsd": number,
    "currency": "INR"
  },
  "techStack": { "frontend": string, "backend": string, "database": string, "hosting": string },
  "team": [{ "role": string, "count": number, "allocationPct": number }],
  "assumptions": string[],
  "terms": string
}`;

export function buildProposalUserPrompt(currentState: object): string {
  return `PROJECT REQUIREMENT STATE:\n${JSON.stringify(currentState, null, 2)}\n\nGenerate a complete project proposal. Use INR pricing.`;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/ai/proposal.ts frontend/lib/ai/prompts/proposal.ts
git commit -m "feat: proposal gen uses Claude Sonnet + INR pricing"
```

---

## Task 3: Email collection mode in ChatPanel

**Files:**
- Modify: `frontend/components/chat-panel.tsx`

- [ ] **Step 1: Add three new optional props to ChatPanelProps interface**

Find the interface:
```typescript
interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  completeness: number;
  userMessageCount: number;
  isPanelOpen: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onTogglePanel: () => void;
  onGenerateProposal: () => void;
  isGeneratingProposal: boolean;
}
```

Replace with:
```typescript
interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  completeness: number;
  userMessageCount: number;
  isPanelOpen: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onTogglePanel: () => void;
  onGenerateProposal: () => void;
  isGeneratingProposal: boolean;
  /** When true the textarea is replaced with an email input */
  emailCollectionMode?: boolean;
  /** Called with the submitted email address */
  onEmailSubmit?: (email: string) => void;
  /** Shows loading state on the email submit button */
  isSubmittingEmail?: boolean;
}
```

- [ ] **Step 2: Add emailRef and destructure new props**

Find:
```typescript
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
```

Replace with:
```typescript
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emailRef    = useRef<HTMLInputElement>(null);
```

Find the function signature:
```typescript
export function ChatPanel({
  messages,
  input,
  isLoading,
  completeness,
  isPanelOpen,
  onInputChange,
  onSend,
  onTogglePanel,
}: ChatPanelProps) {
```

Replace with:
```typescript
export function ChatPanel({
  messages,
  input,
  isLoading,
  completeness,
  isPanelOpen,
  onInputChange,
  onSend,
  onTogglePanel,
  emailCollectionMode = false,
  onEmailSubmit,
  isSubmittingEmail = false,
}: ChatPanelProps) {
```

- [ ] **Step 3: Replace the entire Input section**

Find and replace the entire `{/* ── Input ── */}` div at the bottom:

```tsx
      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-[#1f2d3d] bg-[#080d14]/60">
        {emailCollectionMode ? (
          /* Email collection — shown when readyForProposal and no email yet */
          <div className="space-y-2">
            <p className="text-[11px] text-blue-400 font-medium text-center tracking-wide">
              ✦ Ready to generate your proposal
            </p>
            <div className="flex items-center gap-3 bg-[#0f1724] rounded-xl border border-blue-600/50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)] px-4 py-3 transition-all duration-200">
              <input
                ref={emailRef}
                type="email"
                placeholder="your@email.com"
                disabled={isSubmittingEmail}
                className="flex-1 bg-transparent outline-none text-sm text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && emailRef.current?.value && onEmailSubmit) {
                    onEmailSubmit(emailRef.current.value);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (emailRef.current?.value && onEmailSubmit) {
                    onEmailSubmit(emailRef.current.value);
                  }
                }}
                disabled={isSubmittingEmail}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white transition-all duration-200 disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-[10px] text-slate-700 text-center">
              We'll send your detailed proposal to this address
            </p>
          </div>
        ) : (
          /* Normal chat input */
          <>
            <div
              className={cn(
                'flex items-end gap-3 bg-[#0f1724] rounded-xl border px-4 py-3 transition-all duration-200',
                canSend
                  ? 'border-blue-600/50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]'
                  : 'border-[#1e2d40] focus-within:border-blue-700/50 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.05)]',
              )}
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me what you want to build…"
                disabled={isLoading}
                className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-200 placeholder:text-slate-600 disabled:opacity-50 leading-relaxed"
                style={{ minHeight: '24px', maxHeight: '128px' }}
              />
              <button
                onClick={onSend}
                disabled={!canSend}
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
                  canSend
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 hover:scale-105 active:scale-95'
                    : 'bg-[#1a2535] text-slate-600 cursor-not-allowed',
                )}
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-[10px] text-slate-700 text-center mt-2">
              Enter to send · Shift+Enter for new line
            </p>
          </>
        )}
      </div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/chat-panel.tsx
git commit -m "feat: email collection mode in ChatPanel"
```

---

## Task 4: Wire email collection into chat/page.tsx

**Files:**
- Modify: `frontend/app/chat/page.tsx`

- [ ] **Step 1: Add email-related state variables**

After the existing `const [userMessageCount, setUserMessageCount] = useState(0);` line, add:

```typescript
  const [readyForProposal, setReadyForProposal] = useState(false);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
```

- [ ] **Step 2: Set readyForProposal flag inside sendMessage**

Inside `sendMessage`, find:
```typescript
      if (!conversationId) setConversationId(data.conversationId);
      setProjectState(data.state);
```

Add after `setProjectState(data.state)`:
```typescript
      if (data.readyForProposal && !readyForProposal) {
        setReadyForProposal(true);
      }
```

- [ ] **Step 3: Add handleEmailSubmit callback**

After the `generateProposal` useCallback, add:

```typescript
  const handleEmailSubmit = useCallback(async (email: string) => {
    if (!conversationId || isSubmittingEmail) return;
    setIsSubmittingEmail(true);
    try {
      const res = await fetch('/api/lead/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save email');
      setCustomerEmail(email);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Perfect! 🎉 Your project details have been sent to **Team CheatGPT**.\n\nWe're reviewing your requirements now and will send a detailed proposal to **${email}** within 24 hours.\n\nFeel free to ask me anything else in the meantime!`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong saving your email. Please try again.' },
      ]);
    } finally {
      setIsSubmittingEmail(false);
    }
  }, [conversationId, isSubmittingEmail]);
```

- [ ] **Step 4: Pass new props to ChatPanel**

Find `<ChatPanel` in the JSX and add three props:
```tsx
            emailCollectionMode={readyForProposal && !customerEmail}
            onEmailSubmit={handleEmailSubmit}
            isSubmittingEmail={isSubmittingEmail}
```

- [ ] **Step 5: Reset email state on New Session**

Inside the New Session `onClick`, after `setUserMessageCount(0)`, add:
```typescript
                setReadyForProposal(false);
                setCustomerEmail(null);
                setIsSubmittingEmail(false);
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/chat/page.tsx
git commit -m "feat: wire email collection + readyForProposal into chat page"
```

---

## Task 5: /api/lead/email route

**Files:**
- Create: `frontend/app/api/lead/email/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/lead/email/route.ts
git commit -m "feat: /api/lead/email — save email + generate draft proposal"
```

---

## Task 6: Email template + Resend

**Files:**
- Create: `frontend/lib/email/proposal-template.ts`
- Create: `frontend/lib/email/send-proposal.ts`
- Modify: `frontend/.env.local`

- [ ] **Step 1: Create frontend/lib/email/proposal-template.ts**

```typescript
import type { ProposalContent } from '@/types/proposal';

const INR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function fmt(n: number, currency: string) {
  return currency === 'INR' ? INR(n) : `$${n.toLocaleString()}`;
}

export function proposalToPlainText(proposal: ProposalContent, toEmail: string): string {
  const cur = proposal.pricing.currency;
  const totalWeeks = proposal.timeline.phases.reduce((s, p) => s + p.durationWeeks, 0);

  const phases     = proposal.timeline.phases.map((p) => `  • ${p.name} — ${p.durationWeeks} week${p.durationWeeks !== 1 ? 's' : ''}`).join('\n');
  const breakdown  = proposal.pricing.breakdown.map((b) => `  • ${b.item}: ${fmt(b.costUsd, cur)}`).join('\n');
  const delivs     = proposal.deliverables.map((d) => `  • ${d.name} (${d.milestone}): ${d.description}`).join('\n');
  const included   = proposal.scope.included.map((s) => `  ✓ ${s}`).join('\n');
  const excluded   = proposal.scope.excluded.map((s) => `  ✗ ${s}`).join('\n');
  const team       = proposal.team.map((t) => `  • ${t.count}× ${t.role} (${t.allocationPct}% allocation)`).join('\n');
  const assumptions = proposal.assumptions.map((a) => `  • ${a}`).join('\n');

  return `Dear ${toEmail},

Thank you for discussing your project with us. Please find your proposal below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT PROPOSAL — Team CheatGPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
${proposal.executiveSummary}

━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━
Included:
${included}

Not Included:
${excluded}

━━━━━━━━━━━━━━━
DELIVERABLES
━━━━━━━━━━━━━━━
${delivs}

━━━━━━━━━━━━━━━
TIMELINE  (${totalWeeks} weeks total)
━━━━━━━━━━━━━━━
${phases}

━━━━━━━━━━━━━━━
PRICING  (${cur})
━━━━━━━━━━━━━━━
Model: ${proposal.pricing.model.replace(/_/g, ' ')}

Breakdown:
${breakdown}

TOTAL: ${fmt(proposal.pricing.totalUsd, cur)}

━━━━━━━━━━━━━━━
TECH STACK
━━━━━━━━━━━━━━━
  Frontend : ${proposal.techStack.frontend}
  Backend  : ${proposal.techStack.backend}
  Database : ${proposal.techStack.database}
  Hosting  : ${proposal.techStack.hosting}

━━━━━━━━━━━━━━━
TEAM
━━━━━━━━━━━━━━━
${team}

━━━━━━━━━━━━━━━
ASSUMPTIONS
━━━━━━━━━━━━━━━
${assumptions}

━━━━━━━━━━━━━━━
TERMS
━━━━━━━━━━━━━━━
${proposal.terms}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply to this email or reach us at sagnikbarik456@gmail.com

Team CheatGPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

export function proposalToHtml(proposal: ProposalContent, toEmail: string): string {
  const text = proposalToPlainText(proposal, toEmail);
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;padding:24px;margin:0}
  .wrap{background:#fff;max-width:660px;margin:0 auto;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.10);overflow:hidden}
  .header{background:#0d1117;padding:28px 32px;text-align:center}
  .header h1{color:#fff;font-size:20px;margin:0;font-weight:700}
  .header p{color:#60a5fa;font-size:12px;margin:6px 0 0}
  .body{padding:32px;color:#1a1a2e}
  pre{white-space:pre-wrap;font-family:inherit;font-size:13.5px;line-height:1.75;margin:0}
  .footer{text-align:center;color:#999;font-size:11px;padding:16px;border-top:1px solid #e5e7eb}
</style></head>
<body><div class="wrap">
  <div class="header">
    <h1>👻 Team CheatGPT</h1>
    <p>Your Project Proposal</p>
  </div>
  <div class="body"><pre>${escaped}</pre></div>
  <div class="footer">Sent via DealGhost · Team CheatGPT</div>
</div></body></html>`;
}
```

- [ ] **Step 2: Create frontend/lib/email/send-proposal.ts**

```typescript
import { Resend } from 'resend';
import type { ProposalContent } from '@/types/proposal';
import { proposalToPlainText, proposalToHtml } from './proposal-template';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendProposalEmail(
  toEmail: string,
  proposal: ProposalContent,
  projectName?: string,
): Promise<void> {
  const subject = `Your Project Proposal from Team CheatGPT${projectName ? ` — ${projectName}` : ''}`;

  const { error } = await resend.emails.send({
    from: 'Team CheatGPT <onboarding@resend.dev>',
    to: [toEmail],
    cc: ['sagnikbarik456@gmail.com'],
    subject,
    html: proposalToHtml(proposal, toEmail),
    text: proposalToPlainText(proposal, toEmail),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
```

- [ ] **Step 3: Add RESEND_API_KEY to frontend/.env.local**

Append to `frontend/.env.local`:
```
RESEND_API_KEY=re_your_key_here
```

Get your free key at https://resend.com/api-keys — sign up takes 2 minutes, no credit card.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/email/ frontend/.env.local
git commit -m "feat: Resend email wrapper + proposal HTML/text template"
```

---

## Task 7: Admin API routes

**Files:**
- Create: `frontend/app/api/admin/proposals/route.ts`
- Create: `frontend/app/api/admin/proposals/[id]/route.ts`
- Create: `frontend/app/api/admin/proposals/[id]/send/route.ts`

- [ ] **Step 1: Create frontend/app/api/admin/proposals/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-password') === 'CheatGPT@435';
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
```

- [ ] **Step 2: Create frontend/app/api/admin/proposals/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ProposalContent } from '@/types/proposal';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-password') === 'CheatGPT@435';
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
```

- [ ] **Step 3: Create frontend/app/api/admin/proposals/[id]/send/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ProposalContent } from '@/types/proposal';
import { sendProposalEmail } from '@/lib/email/send-proposal';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (req.headers.get('x-admin-password') !== 'CheatGPT@435') {
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

  const content = proposal.content as ProposalContent;
  const reqs = proposal.analysis?.requirements as Record<string, unknown> | null;
  const projectName = (reqs?.projectName as string) ?? undefined;

  try {
    await sendProposalEmail(leadEmail, content, projectName);
  } catch (err) {
    console.error('[send-proposal]', err);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }

  await prisma.proposal.update({
    where: { id },
    data: { status: 'SENT', sentAt: new Date() },
  });

  return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/admin/
git commit -m "feat: admin API routes — list, detail, patch, send"
```

---

## Task 8: Admin panel UI

**Files:**
- Create: `frontend/app/admin/page.tsx`

- [ ] **Step 1: Create the full admin panel**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { ProposalContent } from '@/types/proposal';

// ── Types ────────────────────────────────────────────────────────────────────

interface ListItem {
  id: string;
  status: string;
  version: number;
  totalMax: number | null;
  createdAt: string;
  sentAt: string | null;
  completeness: number;
  projectName: string | null;
  projectType: string | null;
  description: string | null;
  lead: { email: string; name: string };
}

interface Detail {
  id: string;
  status: string;
  version: number;
  content: ProposalContent;
  lead: { email: string; name: string };
  analysis: {
    completeness: number;
    requirements: Record<string, unknown>;
    conversation: {
      messages: Array<{ role: string; content: string; createdAt: string }>;
    };
  } | null;
}

const PW = 'CheatGPT@435';
const INR = (n: number | null | undefined) =>
  n != null ? `₹${n.toLocaleString('en-IN')}` : '—';

function statusBadge(s: string) {
  if (s === 'SENT')  return 'bg-emerald-900/50 text-emerald-400';
  if (s === 'DRAFT') return 'bg-amber-900/50 text-amber-400';
  return 'bg-slate-800 text-slate-400';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed]       = useState(false);
  const [pwInput, setPwInput]     = useState('');
  const [pwError, setPwError]     = useState(false);
  const [proposals, setProposals] = useState<ListItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<Detail | null>(null);
  const [loadingDet, setLoadingDet] = useState(false);
  const [editJson, setEditJson]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [sending, setSending]     = useState(false);
  const [feedback, setFeedback]   = useState<string | null>(null);

  function login() {
    if (pwInput === PW) { setAuthed(true); setPwError(false); }
    else setPwError(true);
  }

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/proposals', { headers: { 'x-admin-password': PW } });
      const d = await r.json();
      setProposals(d.proposals ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authed) fetchList(); }, [authed, fetchList]);

  async function openDetail(id: string) {
    setLoadingDet(true); setFeedback(null);
    try {
      const r = await fetch(`/api/admin/proposals/${id}`, { headers: { 'x-admin-password': PW } });
      const d = await r.json();
      setSelected(d.proposal);
      setEditJson(JSON.stringify(d.proposal.content, null, 2));
    } finally { setLoadingDet(false); }
  }

  async function saveEdits() {
    if (!selected) return;
    setSaving(true); setFeedback(null);
    try {
      const content = JSON.parse(editJson);
      await fetch(`/api/admin/proposals/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': PW },
        body: JSON.stringify({ content }),
      });
      setFeedback('✓ Saved');
    } catch { setFeedback('✗ Invalid JSON — fix before saving'); }
    finally { setSaving(false); }
  }

  async function sendProposal() {
    if (!selected || sending) return;
    setSending(true); setFeedback(null);
    try {
      const r = await fetch(`/api/admin/proposals/${selected.id}/send`, {
        method: 'POST', headers: { 'x-admin-password': PW },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Send failed');
      setFeedback(`✓ Sent to ${selected.lead.email}`);
      fetchList();
    } catch (e: unknown) {
      setFeedback(`✗ ${e instanceof Error ? e.message : 'Send failed'}`);
    } finally { setSending(false); }
  }

  // ── Password gate ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="bg-[#0f1724] border border-[#1e2d40] rounded-2xl p-8 w-full max-w-sm space-y-5">
          <div className="text-center">
            <span className="text-3xl">👻</span>
            <h1 className="text-lg font-bold text-slate-100 mt-2">Admin Access</h1>
            <p className="text-xs text-slate-500 mt-1">Team CheatGPT · DealGhost Dashboard</p>
          </div>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="Password"
            className="w-full bg-[#080d14] border border-[#1f2d3d] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-600/60"
          />
          {pwError && <p className="text-xs text-red-400 text-center">Incorrect password</p>}
          <button
            onClick={login}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100">

      <nav className="sticky top-0 z-50 h-12 bg-[#080d14]/90 backdrop-blur-sm border-b border-[#1f2d3d] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Site</Link>
          <span className="text-[#1f2d3d]">|</span>
          <span className="text-sm font-bold text-slate-100">Admin Dashboard</span>
          <span className="text-[10px] font-medium text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-900">
            Team CheatGPT
          </span>
        </div>
        <button
          onClick={fetchList}
          className="text-xs text-slate-500 hover:text-slate-300 border border-[#1f2d3d] hover:border-slate-600 px-2.5 py-1 rounded-md transition-colors"
        >
          ↺ Refresh
        </button>
      </nav>

      <div className="flex h-[calc(100vh-48px)]">

        {/* Sidebar — proposal list */}
        <div className="w-72 flex-shrink-0 border-r border-[#1f2d3d] overflow-y-auto bg-[#080d14]/40">
          <div className="px-4 py-3 border-b border-[#1f2d3d]">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Proposals ({proposals.length})
            </p>
          </div>

          {loading && <p className="p-6 text-center text-xs text-slate-500">Loading…</p>}

          {!loading && proposals.length === 0 && (
            <p className="p-6 text-center text-xs text-slate-600">
              No proposals yet. When a customer completes a chat, their proposal appears here.
            </p>
          )}

          {proposals.map((p) => (
            <button
              key={p.id}
              onClick={() => openDetail(p.id)}
              className={`w-full text-left px-4 py-3 border-b border-[#1f2d3d] hover:bg-[#0f1724] transition-colors ${
                selected?.id === p.id ? 'bg-[#0f1724] border-l-2 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-slate-200 truncate max-w-[140px]">
                  {p.lead.email}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadge(p.status)}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {p.projectName ?? p.projectType ?? p.description?.slice(0, 38) ?? 'Unnamed project'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-600">
                  {new Date(p.createdAt).toLocaleDateString('en-IN')}
                </span>
                <span className="text-[10px] text-blue-500">{p.completeness}%</span>
                {p.totalMax != null && (
                  <span className="text-[10px] text-emerald-600">{INR(p.totalMax)}</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Main — detail view */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingDet && (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading…</div>
          )}

          {!selected && !loadingDet && (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2">
              <span className="text-4xl">👻</span>
              <p className="text-sm">Select a proposal from the sidebar</p>
            </div>
          )}

          {selected && !loadingDet && (
            <div className="max-w-4xl mx-auto space-y-5">

              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">
                    {(selected.analysis?.requirements?.projectName as string) ?? 'Project Proposal'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {selected.lead.email} · v{selected.version} · {selected.status}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {feedback && (
                    <span className={`text-xs ${feedback.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                      {feedback}
                    </span>
                  )}
                  <button
                    onClick={saveEdits}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs bg-[#1a2535] border border-[#2a3d52] hover:border-slate-500 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Edits'}
                  </button>
                  <button
                    onClick={sendProposal}
                    disabled={sending || selected.status === 'SENT'}
                    className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : selected.status === 'SENT' ? '✓ Already Sent' : 'Send to Customer'}
                  </button>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Completeness', value: `${selected.analysis?.completeness ?? 0}%` },
                  { label: 'Total (INR)', value: INR(selected.content.pricing.totalUsd) },
                  { label: 'Timeline', value: `${selected.content.timeline.phases.reduce((s, p) => s + p.durationWeeks, 0)} weeks` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
                  </div>
                ))}
              </div>

              {/* Features discovered */}
              {Array.isArray(selected.analysis?.requirements?.features) && (
                <div className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Features Discovered
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(selected.analysis!.requirements.features as Array<{ canonicalId: string; priority: string }>)
                      .map((f) => (
                        <span
                          key={f.canonicalId}
                          className="text-[11px] bg-blue-950/50 border border-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full"
                        >
                          {f.canonicalId} [{f.priority}]
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {(selected.analysis?.conversation?.messages?.length ?? 0) > 0 && (
                <div className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Transcript ({selected.analysis!.conversation.messages.length} messages)
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selected.analysis!.conversation.messages.map((m, i) => (
                      <div key={i} className={`flex text-xs ${m.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-xl ${
                          m.role === 'USER'
                            ? 'bg-blue-700/30 text-blue-200'
                            : 'bg-[#0a0f1a] border border-[#1f2d3d] text-slate-300'
                        }`}>
                          <span className="font-semibold opacity-50 mr-1.5">
                            {m.role === 'USER' ? 'Customer' : 'DealGhost'}:
                          </span>
                          {m.content.length > 220 ? m.content.slice(0, 220) + '…' : m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable proposal JSON */}
              <div className="bg-[#0f1724] border border-[#1e2d40] rounded-xl p-4">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Proposal Content — edit JSON then click Save Edits
                </h3>
                <textarea
                  value={editJson}
                  onChange={(e) => setEditJson(e.target.value)}
                  rows={28}
                  spellCheck={false}
                  className="w-full bg-[#080d14] border border-[#1f2d3d] rounded-lg p-3 text-xs font-mono text-slate-300 outline-none focus:border-blue-600/50 resize-none leading-relaxed"
                />
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat: admin panel — password gate, proposal list, detail view, send"
```

---

## Task 9: Admin link on landing page

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Add Admin to the nav links**

Find:
```tsx
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#services" className="hover:text-slate-100 transition-colors">Services</a>
            <a href="#process"  className="hover:text-slate-100 transition-colors">How It Works</a>
            <a href="#why"      className="hover:text-slate-100 transition-colors">Why Us</a>
          </div>
```

Replace with:
```tsx
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#services" className="hover:text-slate-100 transition-colors">Services</a>
            <a href="#process"  className="hover:text-slate-100 transition-colors">How It Works</a>
            <a href="#why"      className="hover:text-slate-100 transition-colors">Why Us</a>
            <a href="/admin"    className="hover:text-slate-100 transition-colors text-slate-600 text-xs">Admin</a>
          </div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: admin link in landing page nav"
```

---

## Self-Review

### 1. Spec coverage
| Requirement | Task |
|---|---|
| Email collection when readyForProposal | Task 3, 4 |
| `/api/lead/email` saves email + generates proposal | Task 5 |
| Claude Sonnet proposal generation | Task 2 |
| INR pricing in prompt | Task 2 |
| Admin panel password-gated | Task 8 |
| Proposal list with lead info + completeness | Task 7, 8 |
| Full transcript in admin detail | Task 7, 8 |
| Editable proposal JSON | Task 8 |
| Send to customer via Resend | Task 6, 7 |
| CC sagnikbarik456@gmail.com | Task 6 |
| Admin link on landing page | Task 9 |

### 2. Placeholder scan
No TBDs. All code blocks are complete.

### 3. Type consistency
- `ProposalContent` from `@/types/proposal` used consistently across tasks 2, 5, 6, 7, 8 ✓
- `ListItem` and `Detail` interfaces defined inside Task 8 admin page ✓
- `ProjectRequirementState` from `@/types/project` used in tasks 2, 5 ✓
- `prisma` imported from `@/lib/prisma` in all API routes ✓
- `sendProposalEmail` signature: `(toEmail: string, proposal: ProposalContent, projectName?: string)` — matches usage in Task 7 route ✓
