import Link from 'next/link';
import {
  Globe, Smartphone, Layers, ShoppingCart, Zap, Plug,
  Palette, Cloud, Bot, RefreshCw, ArrowRight, CheckCircle2,
  Sparkles, MessageSquare, BarChart3, FileText, ChevronRight,
} from 'lucide-react';
import { HeroCanvas } from '@/components/hero-canvas';
import { TiltCard }   from '@/components/tilt-card';

// ── Data ──────────────────────────────────────────────────────────────────────

const SERVICES = [
  { icon: Globe,        title: 'Web Application Development',   desc: 'Scalable, high-performance web apps built with modern frameworks — React, Next.js, Node.js.' },
  { icon: Smartphone,   title: 'Mobile App Development',        desc: 'Native iOS & Android and cross-platform apps using React Native and Flutter.' },
  { icon: Layers,       title: 'SaaS Platform Development',     desc: 'Multi-tenant SaaS products with subscription billing, onboarding flows, and role-based access.' },
  { icon: ShoppingCart, title: 'Marketplace & E-commerce',      desc: 'Two-sided marketplaces, vendor dashboards, payment escrow, and full e-commerce infrastructure.' },
  { icon: Zap,          title: 'MVP & Rapid Prototyping',       desc: 'Go from idea to working product in 6–10 weeks. Scope it right the first time.' },
  { icon: Plug,         title: 'API Development & Integrations',desc: 'RESTful and GraphQL APIs, third-party integrations — Stripe, Razorpay, Twilio, Maps, and more.' },
  { icon: Palette,      title: 'UI/UX Design & Prototyping',    desc: 'Product design, wireframes, interactive prototypes, and design systems built for developers.' },
  { icon: Cloud,        title: 'Cloud Infrastructure & DevOps', desc: 'AWS, GCP, and Railway deployments. CI/CD pipelines, Docker, auto-scaling, and monitoring.' },
  { icon: Bot,          title: 'AI-Powered Feature Development',desc: 'Integrate LLMs, build intelligent workflows, recommendation engines, and AI-native products.' },
  { icon: RefreshCw,    title: 'Maintenance & Scale-up',        desc: 'Ongoing engineering support, performance optimisation, and scaling your product past PMF.' },
];

const HOW_IT_WORKS = [
  {
    icon: MessageSquare, step: '01', title: 'Discuss Your Project',
    desc: "Click 'Discuss Your Project' and our AI discovery assistant takes over. Describe your idea naturally — no forms, no templates.",
  },
  {
    icon: BarChart3, step: '02', title: 'AI Maps Your Requirements',
    desc: 'DealGhost extracts features, identifies workflows, detects contradictions, and builds a live intelligence model of your project in real-time.',
  },
  {
    icon: FileText, step: '03', title: 'Receive Your Proposal',
    desc: 'Get a detailed, scoped proposal with timeline, tech stack, and pricing — generated from everything discussed, not a generic template.',
  },
];

const DIFFERENTIATORS = [
  'AI-powered scoping — no vague estimates',
  'Contradictions flagged before work begins',
  'Live intelligence panel you can inspect',
  'Proposal generated from actual conversation',
  'Fixed project tiers with no hidden costs',
  'Engineers who think like founders',
];

const STATS = [
  { value: '50+',   label: 'Projects Delivered'    },
  { value: '8 wks', label: 'Average MVP Timeline'  },
  { value: '4',     label: 'Countries Served'      },
  { value: '100%',  label: 'Agile Process'         },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 overflow-x-hidden">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#1f2d3d] bg-[#0d1117]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-slate-100">Team CheatGPT</span>
            <span className="hidden sm:block text-[10px] font-semibold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-900/60 uppercase tracking-widest">
              Software Studio
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#services" className="hover:text-slate-100 transition-colors">Services</a>
            <a href="#process"  className="hover:text-slate-100 transition-colors">How It Works</a>
            <a href="#why"      className="hover:text-slate-100 transition-colors">Why Us</a>
          </div>
          <Link
            href="/chat"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-blue-900/40"
          >
            <span>Discuss Your Project</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">

        {/* 3-D particle network — sits beneath everything */}
        <HeroCanvas />

        {/* Tech-grid overlay on top of canvas */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.028]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #3b82f6 1px, transparent 1px),
              linear-gradient(to bottom, #3b82f6 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 bg-blue-950/50 border border-blue-900/60 px-3 py-1.5 rounded-full mb-8">
            <Sparkles className="w-3 h-3" />
            <span>AI-Powered Pre-Sales Discovery</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            We build software
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-indigo-400 bg-clip-text text-transparent">
              that actually ships.
            </span>
          </h1>

          {/* Sub */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            From MVP to enterprise platform — Team CheatGPT scopes your project with AI precision,
            builds it with senior engineers, and delivers code that scales beyond launch.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/chat"
              className="group flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all duration-200 shadow-xl shadow-blue-900/50 hover:shadow-blue-600/30 hover:scale-[1.02]"
            >
              <span>👻</span>
              <span>Discuss Your Project</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#services"
              className="flex items-center gap-2 text-slate-400 hover:text-slate-100 font-medium px-6 py-4 rounded-xl border border-[#1f2d3d] hover:border-slate-600 transition-all duration-200 text-sm"
            >
              View Our Services
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-8 text-xs text-slate-600">
            No commitment required · Proposal generated in minutes · Priced in ₹ INR
          </p>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <section className="border-y border-[#1f2d3d] bg-[#0d1117]">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-black text-blue-400 mb-1">{value}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────────────── */}
      <section id="services" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
              What We Build
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100 mb-4">
              Full-stack product engineering
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              We cover every layer of the product — from idea to infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SERVICES.map(({ icon: Icon, title, desc }) => (
              <TiltCard
                key={title}
                className="group p-5 rounded-xl border border-[#1f2d3d] bg-[#0d1117] hover:border-blue-900/60 hover:bg-[#0f1724]"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-950/60 border border-blue-900/40 flex items-center justify-center mb-4 group-hover:bg-blue-900/40 transition-colors duration-200">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-100 mb-2 leading-snug">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── How DealGhost works ──────────────────────────────────────────────── */}
      <section id="process" className="py-24 px-6 bg-[#080d14]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 bg-blue-950/40 border border-blue-900/40 px-3 py-1 rounded-full mb-4">
              <span>👻</span>
              <span>Powered by DealGhost</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100 mb-4">
              From conversation to proposal in minutes
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              DealGhost is our AI discovery engine. Instead of filling out a brief,
              you just talk about your idea — and the AI does the rest.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ icon: Icon, step, title, desc }, i) => (
              <div key={step} className="relative">
                {/* Connector line between cards */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-blue-900/60 to-transparent z-0 -translate-y-0.5" />
                )}
                <TiltCard
                  className="relative z-10 p-6 rounded-xl border border-[#1f2d3d] bg-[#0d1117] hover:border-blue-800/60"
                  intensity={8}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-900/40 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-3xl font-black text-[#1f2d3d]">{step}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mb-2">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                </TiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Team CheatGPT ─────────────────────────────────────────────────── */}
      <section id="why" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">
                Why Team CheatGPT
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-100 mb-6 leading-tight">
                We scope it right
                <br />
                <span className="text-slate-500">before a single line is written.</span>
              </h2>
              <p className="text-slate-400 leading-relaxed mb-8">
                Most agencies give you a rough estimate and figure out the rest as they go.
                We use AI to map your requirements precisely, surface contradictions early,
                and give you a real proposal before any work begins.
              </p>
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors"
              >
                <span>Start the conversation</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {DIFFERENTIATORS.map((item) => (
                <TiltCard
                  key={item}
                  className="flex items-center gap-3 p-4 rounded-lg border border-[#1f2d3d] bg-[#080d14] hover:border-slate-700"
                  intensity={5}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">{item}</span>
                </TiltCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <TiltCard
            className="relative p-12 rounded-2xl border border-blue-900/30 bg-gradient-to-b from-blue-950/20 to-transparent"
            intensity={6}
          >
            {/* Top edge glow line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
            {/* Soft top bloom */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-600/10 blur-3xl pointer-events-none" />

            <span className="text-4xl mb-6 block">👻</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100 mb-4">
              Ready to build?
            </h2>
            <p className="text-slate-400 mb-8 text-lg">
              Tell DealGhost about your project. Get a real proposal — not a generic quote.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-4 rounded-xl text-base transition-all duration-200 shadow-xl shadow-blue-900/50 hover:shadow-blue-600/30 hover:scale-[1.02]"
            >
              <span>Discuss Your Project</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="mt-5 text-xs text-slate-600">Free · No account required · Instant proposal</p>
          </TiltCard>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1f2d3d] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-black text-slate-100 tracking-tight">Team CheatGPT</span>
            <span className="text-slate-600 text-xs">Software Studio</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <a href="#services" className="hover:text-slate-400 transition-colors">Services</a>
            <a href="#process"  className="hover:text-slate-400 transition-colors">Process</a>
            <a href="#why"      className="hover:text-slate-400 transition-colors">Why Us</a>
            <Link href="/chat"  className="hover:text-slate-400 transition-colors">Discuss Project</Link>
          </div>
          <div className="text-xs text-slate-600">
            © 2026 Team CheatGPT · All rights reserved
          </div>
        </div>
      </footer>

    </div>
  );
}
