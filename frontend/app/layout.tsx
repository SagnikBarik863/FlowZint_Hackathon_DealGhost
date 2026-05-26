import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DealGhost — AI Pre-Sales Intelligence',
  description:
    'AI-powered pre-sales solution architect that converts client conversations into structured project intelligence and proposal-ready artifacts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="h-full bg-[#0d1117] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
