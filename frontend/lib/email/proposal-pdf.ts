import PDFDocument from 'pdfkit';
import type { ProposalContent } from '@/types/proposal';

// pdfkit built-in fonts don't support the Rs. symbol — use "Rs." prefix
const fmtMoney = (n: number, currency: string) =>
  currency === 'INR'
    ? `Rs. ${n.toLocaleString('en-IN')}`
    : `$${n.toLocaleString()}`;

export async function generateProposalPdf(
  proposal: ProposalContent,
  toEmail: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const contentW = pageW - 100; // 50px margin each side
    const cur = proposal.pricing.currency;

    // ── Helpers ──────────────────────────────────────────────────────────────

    function sectionHeader(title: string) {
      doc.moveDown(0.8);
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#1e40af')
        .text(title.toUpperCase(), { characterSpacing: 1 });
      const lineY = doc.y + 2;
      doc.moveTo(50, lineY).lineTo(50 + contentW, lineY).strokeColor('#bfdbfe').lineWidth(0.5).stroke();
      doc.moveDown(0.4);
      doc.fillColor('#1f2937').font('Helvetica').fontSize(10);
    }

    function bodyText(text: string) {
      doc.fontSize(10).font('Helvetica').fillColor('#1f2937').text(text, { lineGap: 2 });
    }

    function bullet(text: string, indent = 15) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#374151')
        .text(`- ${text}`, { indent, lineGap: 1 });
    }

    // ── Header band ──────────────────────────────────────────────────────────

    doc.rect(0, 0, pageW, 75).fill('#0d1117');
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#ffffff').text('CheatGPT', 50, 18);
    doc.fontSize(10).font('Helvetica').fillColor('#93c5fd').text('Project Proposal  |  Powered by DealGhost', 50, 48);
    doc.y = 95; // skip past header band

    // ── Prepared for ─────────────────────────────────────────────────────────

    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text(`Prepared for: ${toEmail}`, { align: 'right' });

    // ── Executive Summary ────────────────────────────────────────────────────

    sectionHeader('Executive Summary');
    bodyText(proposal.executiveSummary);

    // ── Scope ────────────────────────────────────────────────────────────────

    sectionHeader('Scope');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151').text('Included:');
    (proposal.scope?.included ?? []).forEach((s) => bullet(s));
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151').text('Not Included:');
    (proposal.scope?.excluded ?? []).forEach((s) => bullet(s));

    // ── Deliverables ─────────────────────────────────────────────────────────

    sectionHeader('Deliverables');
    (proposal.deliverables ?? []).forEach((d) => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1f2937').text(`${d.name}  [${d.milestone}]`);
      doc.fontSize(10).font('Helvetica').fillColor('#4b5563').text(d.description, { indent: 15, lineGap: 1 });
      doc.moveDown(0.2);
    });

    // ── Timeline ─────────────────────────────────────────────────────────────

    const phases = proposal.timeline?.phases ?? [];
    const totalWeeks = phases.reduce((s, p) => s + p.durationWeeks, 0);
    sectionHeader(`Timeline  (${totalWeeks} weeks total)`);
    phases.forEach((p) => {
      bullet(`${p.name}: ${p.durationWeeks} week${p.durationWeeks !== 1 ? 's' : ''}`);
    });

    // ── Pricing ──────────────────────────────────────────────────────────────

    sectionHeader(`Pricing  (${cur})`);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151')
      .text(`Model: ${proposal.pricing.model.replace(/_/g, ' ')}`);
    doc.moveDown(0.2);
    (proposal.pricing?.breakdown ?? []).forEach((b) => {
      // right-align the amount
      const label = `- ${b.item}`;
      const amount = fmtMoney(b.costUsd, cur);
      doc.fontSize(10).font('Helvetica').fillColor('#374151')
        .text(label, 65, doc.y, { continued: true, width: contentW - 100 });
      doc.font('Helvetica-Bold').fillColor('#111827')
        .text(amount, { align: 'right', width: 100 });
    });
    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(50 + contentW, doc.y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#065f46')
      .text(`Total: ${fmtMoney(proposal.pricing.totalUsd, cur)}`);

    // ── Tech Stack ───────────────────────────────────────────────────────────

    sectionHeader('Tech Stack');
    const stack: [string, string][] = [
      ['Frontend', proposal.techStack.frontend],
      ['Backend',  proposal.techStack.backend],
      ['Database', proposal.techStack.database],
      ['Hosting',  proposal.techStack.hosting],
    ];
    stack.forEach(([k, v]) => {
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
        .text(`${k}:  `, { continued: true })
        .font('Helvetica-Bold').fillColor('#1f2937')
        .text(v, { lineGap: 1 });
    });

    // ── Team ─────────────────────────────────────────────────────────────────

    sectionHeader('Team Composition');
    (proposal.team ?? []).forEach((t) => {
      bullet(`${t.count}x ${t.role}  (${t.allocationPct}% allocation)`);
    });

    // ── Assumptions ──────────────────────────────────────────────────────────

    sectionHeader('Assumptions');
    (proposal.assumptions ?? []).forEach((a) => bullet(a));

    // ── Terms ────────────────────────────────────────────────────────────────

    sectionHeader('Terms & Conditions');
    bodyText(proposal.terms);

    // ── Footer ───────────────────────────────────────────────────────────────

    doc.moveDown(1.5);
    doc
      .fontSize(8.5)
      .font('Helvetica')
      .fillColor('#9ca3af')
      .text('CheatGPT  |  sagnikbarik456@gmail.com  |  Powered by DealGhost', {
        align: 'center',
      });

    doc.end();
  });
}
