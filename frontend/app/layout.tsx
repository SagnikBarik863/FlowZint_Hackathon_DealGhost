import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CheatGPT — Custom Software Development Studio',
  description:
    'We build web apps, mobile apps, SaaS platforms, and marketplaces. AI-powered scoping, senior engineers, and proposals you can actually trust.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="h-full bg-[#0d1117] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
