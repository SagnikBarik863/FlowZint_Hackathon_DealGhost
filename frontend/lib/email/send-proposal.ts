import nodemailer from 'nodemailer';
import type { ProposalContent } from '@/types/proposal';
import { generateProposalPdf } from './proposal-pdf';

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER!,
      pass: process.env.BREVO_SMTP_KEY!,
    },
  });
}

export async function sendProposalEmail(
  toEmail: string,
  proposal: ProposalContent,
  projectName?: string,
): Promise<void> {
  const subject = `Your Project Proposal from CheatGPT${projectName ? ` — ${projectName}` : ''}`;
  const filename = projectName
    ? `proposal-${projectName.toLowerCase().replace(/\s+/g, '-')}.pdf`
    : 'proposal.pdf';

  const pdfBuffer = await generateProposalPdf(proposal, toEmail);

  const text = `Hi,

Thank you for chatting with us! Please find your project proposal attached as a PDF.

${projectName ? `Project: ${projectName}\n` : ''}Feel free to reply to this email if you have any questions.

Looking forward to working with you!

CheatGPT
sagnikbarik456@gmail.com`;

  const ADMIN_EMAIL = 'sagnikbarik456@gmail.com';
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: '"CheatGPT" <sagnikbarik456@gmail.com>',
    to: toEmail,
    cc: toEmail !== ADMIN_EMAIL ? ADMIN_EMAIL : undefined,
    replyTo: ADMIN_EMAIL,
    subject,
    text,
    attachments: [{ filename, content: pdfBuffer }],
  });

  if (!info.messageId) {
    throw new Error('Email sent but no messageId returned');
  }
}
