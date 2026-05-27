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
