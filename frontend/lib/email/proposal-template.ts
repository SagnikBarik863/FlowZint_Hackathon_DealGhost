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
