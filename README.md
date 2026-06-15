# DealGhost — AI Pre-Sales Chatbot

DealGhost is an intelligent pre-sales discovery system built for **CheatGPT**, a software development agency. It replaces generic intake forms with a conversational AI that asks smart questions, extracts structured requirements, and delivers a detailed project proposal to the client's inbox — all without human involvement.

---

## What It Does

1. **Discovers requirements** — The bot asks targeted questions to understand what the client wants to build: features, platforms, budget, timeline, tech preferences, integrations, and more.
2. **Extracts & tracks data** — Every message is processed through a multi-layer AI pipeline that parses requirements into a structured state (tracked live in the Intelligence Panel).
3. **Generates a proposal** — When the client is ready, they click "Generate Proposal" and provide their email. The system produces a full scoped proposal (tech stack, team, timeline, pricing, risks) and saves it for admin review.
4. **Admin dashboard** — The agency reviews proposals, edits content via a form editor, and sends the final proposal to the client with one click.

---

## Architecture

```
Client Message
      │
      ▼
┌─────────────────────────────────────────────────┐
│                  AI Pipeline                     │
│                                                  │
│  L1 — Semantic Understanding  (Llama 3.1 8B)    │
│       Intent, language, corrections detected     │
│                   │                              │
│  L2 — Requirement Extraction  (Llama 3.3 70B)   │
│       Features, budget, platforms, timeline…     │
│                   │                              │
│  L3 — State Merge                                │
│       Merges extraction into project state       │
│                   │                              │
│  L4 — Discovery & Response    (Llama 3.3 70B)   │
│       Decides next question, answers queries     │
└─────────────────────────────────────────────────┘
      │
      ▼
  Response + Updated State → Client
```

**Supporting models (Llama 3.1 8B — fast, lightweight):**
- Content moderation (pre-flight)
- Intent classification (SMALL_TALK, READY_FOR_PROPOSAL, etc.)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui |
| AI Service | Hono (Node.js), TypeScript |
| LLM Provider | Groq (Llama 3.3 70B + Llama 3.1 8B) |
| Database | Supabase (PostgreSQL) via Prisma ORM |
| State Cache | Redis (Upstash) |
| Email | Resend |

---

## Project Structure

```
dealghost/
├── frontend/               # Next.js app
│   ├── app/
│   │   ├── page.tsx        # Landing page
│   │   ├── chat/           # Chat interface
│   │   ├── admin/          # Admin dashboard
│   │   └── api/            # API routes (chat, proposal, lead, admin)
│   ├── components/
│   │   ├── chat-panel.tsx        # Chat UI with history drawer
│   │   ├── intelligence-panel.tsx # Live requirement tracker
│   │   └── proposal-view.tsx     # Proposal preview
│   └── types/
│       └── proposal.ts     # ProposalContent type
│
├── ai-service/             # Hono AI microservice
│   └── src/
│       ├── pipeline/
│       │   ├── l1-understanding.ts   # Semantic intent layer
│       │   ├── l2-extraction.ts      # Requirement extraction
│       │   └── l4-discovery.ts       # Discovery & response
│       ├── prompts/        # System & user prompt builders
│       ├── state/          # State merge + completeness scoring
│       ├── ontology/       # Feature ontology (loaded from DB)
│       ├── models/         # Groq client + retry logic
│       ├── routes/         # chat.ts — main request handler
│       └── db/             # Prisma + Redis clients
│
├── shared/                 # Shared TypeScript types
│   └── types/
│       ├── project.ts      # ProjectRequirementState
│       ├── pipeline.ts     # L1/L2/L4 output types
│       └── proposal.ts     # ProposalContent
│
└── prisma/                 # Database schema & migrations
```

---

## Environment Variables

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_DEMO_MODE=true          # shows Intelligence Panel toggle
DATABASE_URL=<supabase-postgres-url>
DIRECT_URL=<supabase-direct-url>
RESEND_API_KEY=<resend-key>
CONTACT_EMAIL=hello@cheatgpt.dev
```

### AI Service (`ai-service/.env`)

```env
GROQ_API_KEY=<groq-api-key>
DATABASE_URL=<supabase-postgres-url>
DIRECT_URL=<supabase-direct-url>
REDIS_URL=<upstash-redis-url>
CONTACT_EMAIL=hello@cheatgpt.dev
```

---

## Running Locally

**1. Install dependencies**
```bash
cd frontend && npm install
cd ../ai-service && npm install
```

**2. Push the database schema**
```bash
cd ai-service
npx prisma db push
npx tsx src/ontology/seed-data.ts   # seed feature ontology
```

**3. Start the AI service**
```bash
cd ai-service
npm run dev   # runs on http://localhost:3001
```

**4. Start the frontend**
```bash
cd frontend
npm run dev   # runs on http://localhost:3000
```

---

## Key Features

- **Intelligent discovery** — Bot adapts questions based on what it already knows; never asks something twice
- **Correction handling** — User can say "actually, change the budget to ₹40,000" and the state updates correctly
- **Proposal summary on trigger** — When the user asks to generate a proposal, the bot echoes back all captured requirements before requesting their email
- **Persistent proposal buttons** — After "Add more details", the Generate/Add buttons reappear after every message
- **Admin panel** — Form-based proposal editor (pricing, timeline, team, risks, scope), with client's suggested budget/timeline shown as hints
- **Chat history** — Sessions saved locally; users can switch between past conversations
- **Rate-limit resilience** — Auto-retry with backoff on Groq TPM limits (≤30s wait); daily limits are surfaced immediately

---

## Admin Dashboard

Access at `/admin` — password: `123456` (demo)

- View all incoming proposals with completeness score and budget
- Edit any proposal field via structured form (no JSON required)
- See the full conversation transcript per lead
- Send the final proposal to the client's email
- Delete proposals or individual chat sessions

---

## Built by CheatGPT

CheatGPT is a software development agency specialising in web apps, mobile apps, SaaS platforms, AI-powered products, and custom API development.
