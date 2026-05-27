import { Resend } from 'resend';
import type { ProposalContent } from '@/types/proposal';
import { generateProposalPdf } from './proposal-pdf';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendProposalEmail(
  toEmail: string,
  proposal: ProposalContent,
  projectName?: string,
): Promise<void> {
  const subject = `Your Project Proposal from Team CheatGPT${projectName ? ` — ${projectName}` : ''}`;
  const filename = projectName
    ? `proposal-${projectName.toLowerCase().replace(/\s+/g, '-')}.pdf`
    : 'proposal.pdf';

  // Generate PDF attachment
  const pdfBuffer = await generateProposalPdf(proposal, toEmail);

  const emailBody = `Hi,

Thank you for chatting with us! Please find your project proposal attached as a PDF.

${projectName ? `Project: ${projectName}\n` : ''}Feel free to reply to this email if you have any questions.

Looking forward to working with you!

Team CheatGPT
sagnikbarik456@gmail.com`;

  const { error } = await resend.emails.send({
    from: 'Team CheatGPT <onboarding@resend.dev>',
    to: [toEmail],
    cc: ['sagnikbarik456@gmail.com'],
    subject,
    text: emailBody,
    attachments: [
      {
        filename,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
