# DEALGHOST Intelligence Architecture Redesign
**Date:** 2026-05-25  
**Status:** Approved — ready for implementation planning  
**Scope:** Full system rebuild — AI intelligence layer + backend service + frontend integration  
**Author:** Architecture session with Claude Code

---

## 1. Context and Problem Statement

DEALGHOST is an AI-powered pre-sales solution architect for FlowZint (internal use only). It conducts technical discovery conversations with clients and converts them into structured project intelligence, lead qualification scores, and proposal-ready artifacts.

### Current Implementation Failures

The existing `lib/ai/` pipeline has seven fundamental problems:

| Problem | Root Cause | Impact |
|---|---|---|
| Under-extraction | Single-shot prompt too conservative | Features missed, state stays sparse |
| Duplicate features | No canonical mapping — raw strings stored | "live tracking" ≠ "GPS tracking" even though they're the same feature |
| No contradiction detection | No semantic understanding layer | Client corrections silently lost, state corrupted |
| Robotic follow-up questions | "What's missing?" logic — asks about empty fields, not valuable unknowns | Discovery feels like a form, not a consultation |
| Weak lead scoring | Message count gates + 5 fixed dimensions | Scores don't reflect real business intent or feasibility |
| Shallow proposal generation | Single-shot prompt → full proposal | No architecture reasoning, no risk identification, no phasing logic |
| Unbounded token growth | Full conversation history sent every turn | Gets expensive and slow after 8+ turns |

### What the redesign must achieve

- Extract requirements with **confidence scores** and **canonical IDs** — not raw strings
- Detect and resolve **contradictions** between turns
- Ask **architect-quality follow-up questions** targeting the most proposal-blocking unknown
- Score leads with **multi-dimensional business reasoning** — not rule gates
- Generate proposals through a **4-step reasoning chain** — not a single prompt
- Keep the system **fast, lean, and maintainable** on a zero-cost stack

---

## 2. Architecture Decision

**Chosen: Option B — Dedicated AI Service + Next.js Frontend**

Two services, one repo, both on free/near-free hosting.

### Rationale

Vercel's serverless timeout is a real constraint for a deep multi-step Claude pipeline. L1 + L2 running in parallel, followed by L4 + L5 in parallel, takes 10–14 seconds total. Running this inside a Vercel function is fragile. A dedicated Hono service on Railway removes the timeout constraint entirely and enables proper SSE streaming.

### Rejected alternatives

- **Option A (upgrade in place)** — keeps the Vercel timeout problem. Dismissed.
- **Option C (Mastra agent architecture)** — Mastra is production-new, harder to debug, overkill for single-agency internal use. Dismissed.

---

## 3. Final Stack

| Layer | Technology | Hosting | Cost |
|---|---|---|---|
| Frontend | Next.js 16 (App Router) | Vercel free tier | $0 |
| AI service | Hono (Node.js) | Railway free → $1/month | ~$0 |
| Primary AI model | Claude Sonnet 4.6 (Anthropic) | API | ~$0.154/conversation |
| Fast AI model | Llama-3.1-8b-instant (Groq) | API free tier | $0 |
| Hot state cache | Redis (Upstash free tier) | Managed | $0 |
| Database | PostgreSQL + pgvector (Supabase) | Managed free tier | $0 |
| ORM | Prisma 7 | — | $0 |

**Monthly cost at hackathon scale (150 conversations):** ~$23  
**Monthly cost at 1,000 conversations:** ~$154  
**No OpenAI dependency** — Claude handles canonical feature mapping directly.

### Model assignments

| Pipeline stage | Model | Reason |
|---|---|---|
| Intent classification (pre-flight) | Groq Llama-3.1-8b | Single label output — no reasoning needed, ~300ms |
| L1 Conversational Understanding | Claude Sonnet 4.6 | Semantic reasoning, contradiction detection |
| L2 Canonical Extraction | Claude Sonnet 4.6 | Structured output + canonical mapping reasoning |
| L3 State Engine | TypeScript (+ Claude for contradiction resolution) | Deterministic merge — Claude only if contradiction detected |
| L4 Discovery Strategy | Claude Sonnet 4.6 | Architect-quality question generation |
| L5 Lead Intelligence | Claude Sonnet 4.6 | Multi-dimensional business reasoning |
| L6 Proposal Intelligence | Claude Sonnet 4.6 | 4-step reasoning chain |

---

## 4. The 6-Layer Intelligence Pipeline

Every user message flows through this pipeline sequentially, with parallel execution where noted.

### Pre-flight: Intent Classification

**Model:** Groq Llama-3.1-8b-instant  
**Latency:** ~300–400ms  
**Purpose:** Route the request before the expensive pipeline runs.

Routes:
- `COLLECTING_INFO` → run full pipeline (L1–L5)
- `REQUESTING_DONE` → skip to project summary
- `READY_FOR_PROPOSAL` → trigger L6 directly
- `CONFIRMING_SUMMARY` → acknowledge + prompt Generate Proposal
- `EDITING_SUMMARY` → run full pipeline, acknowledge the edit

### Layer 1 — Conversational Understanding

**Model:** Claude Sonnet 4.6  
**Runs in parallel with:** L2  
**Purpose:** Deep semantic analysis of the latest message *before* extraction.

Claude is not extracting here — it is *understanding*. This layer answers:
- What is the client actually saying beyond surface words?
- Are they correcting something previously said?
- Is there a contradiction with an earlier statement?
- What business domain signals are present?
- What key entities (systems, people, processes) appear?
- What workflow steps are being described?

**Output type:** `SemanticUnderstanding`
```typescript
interface SemanticUnderstanding {
  semanticIntent: 'adding' | 'correcting' | 'removing' | 'clarifying' | 
                  'elaborating' | 'questioning' | 'done' | 'confirming'
  businessDomain: string
  keyEntities: Array<{ type: 'feature' | 'integration' | 'constraint' | 'person' | 'system', value: string }>
  corrections: Array<{ field: string; oldValue: string; newValue: string }>
  contradictions: Array<{ existingFact: string; newStatement: string }>
  workflowsDescribed: string[]
  urgencySignals: string[]
  businessModelHints: string[]
  confidenceInUnderstanding: number // 0–1
}
```

### Layer 2 — Canonical Requirement Extraction

**Model:** Claude Sonnet 4.6  
**Runs in parallel with:** L1  
**Purpose:** Extract structured requirements with confidence scores and canonical IDs.

Claude extracts features, integrations, platforms, constraints, user roles, and business context. Every feature is mapped to a canonical ID from the feature ontology (injected into the prompt as a list). The canonical list is placed at the start of the system prompt so it gets cached after the first call.

**Canonical mapping example:**
- "live GPS tracking for drivers" → `realtime_delivery_tracking` (confidence: 0.92)
- "GPS tracking" → `realtime_delivery_tracking` (confidence: 0.95)  
- "track my orders" → `realtime_delivery_tracking` (confidence: 0.88)

If a raw feature doesn't match any canonical entry closely enough (threshold: 0.75), Claude creates a new canonical entry with a generated ID.

**Output type:** `ExtractionResult`
```typescript
interface ExtractionResult {
  features: Array<{
    canonicalId: string
    rawText: string
    confidence: number // 0–1
    category: string
    priority: 'MUST' | 'SHOULD' | 'COULD'
    isConfirmed: boolean // vs. inferred
    dependencies: string[] // other canonical IDs this implies
  }>
  integrations: string[]
  platforms: string[]
  authRequirements: string | null
  realtimeRequirements: string | null
  adminPanelRequirements: string | null
  targetUsers: string | null
  userScale: string | null
  businessModel: 'B2B' | 'B2C' | 'marketplace' | 'internal' | null
  timelineExpectation: string | null
  budgetRange: BudgetRange | null
  clientTechPreferences: TechPreference | null
  compliance: string[]
  technicalConstraints: string | null
  workflows: Workflow[]
  userRoles: UserRole[]
  featuresToRemove: string[] // canonical IDs to remove
  assumptions: string[] // inferred, not explicitly stated
  newCanonicalEntries: CanonicalFeatureEntry[] // new features to add to ontology
}
```

### Layer 3 — State Intelligence Engine

**Model:** TypeScript (deterministic) + Claude (contradiction resolution only)  
**Runs:** After L1 + L2 complete  
**Purpose:** Merge extraction into state intelligently, track quality signals.

This layer is mostly deterministic TypeScript. Claude is only invoked when a contradiction requires reasoning to resolve (e.g., client said "mobile only" in turn 2 and "web dashboard" in turn 7 — which takes precedence?).

Responsibilities:
- Merge L1 corrections and L2 extraction into `ProjectRequirementState`
- Handle feature removals (`featuresToRemove` from L2)
- Update `fieldConfidence` per field — low-confidence fields bubble up to L4
- Populate `confirmedFacts` vs. `assumptions`
- Flag `contradictions` and `ambiguities`
- Rank `discoveryTargets` by proposal-blocking impact
- Compress conversation to `conversationSummary` when turn count exceeds 8
- Recalculate weighted `completenessScore`

### Layer 4 — Discovery Strategy Engine

**Model:** Claude Sonnet 4.6  
**Runs in parallel with:** L5  
**Purpose:** Generate the single most valuable follow-up question.

This layer doesn't ask "what field is missing?" It asks: *"Given everything we know and don't know, what is the most valuable thing to discover right now that would most improve proposal quality?"*

Discovery strategies:
- `clarify_scope` — narrow an ambiguous requirement
- `probe_complexity` — understand technical depth of a described feature
- `resolve_contradiction` — address a conflict in the state
- `confirm_assumption` — verify something inferred but not stated
- `discover_workflow` — understand how a business process actually works
- `ask_tech_preference` — if state is mature enough and no stack preferences captured
- `offer_summary` — enough info gathered, offer to summarise

**Output type:** `DiscoveryResult`
```typescript
interface DiscoveryResult {
  strategy: DiscoveryStrategy
  targetField: string
  reasoning: string // why this is the most important thing to ask now
  question: string // the actual question to stream to the user
  readyForSummary: boolean // true if completeness > threshold and key fields filled
}
```

### Layer 5 — Lead Intelligence

**Model:** Claude Sonnet 4.6  
**Runs in parallel with:** L4  
**Purpose:** Multi-dimensional business reasoning about lead quality.

Seven scoring dimensions — not message count gates:

| Dimension | What Claude evaluates |
|---|---|
| Business maturity | Is this a real business idea with commercial viability? Does the client understand what they're building? |
| Project clarity | How well-defined are the requirements? Is scope reasonable and internally consistent? |
| Budget realism | Is the stated or implied budget realistic for what they're describing? |
| Urgency and intent | Are there genuine signals of intent to proceed, or is this exploratory? |
| Engagement depth | Are answers thoughtful and detailed, or vague and one-liner? |
| Technical feasibility | Is what they're describing actually buildable by a software agency? |
| Commercial fit | Is this the kind of project FlowZint typically wins and delivers successfully? |

**Output type:** `LeadScore`
```typescript
interface LeadScore {
  score: number // 0–100
  label: 'High Intent Lead' | 'Qualified Prospect' | 'Needs Nurturing' | 
         'Low Qualification' | 'Unqualified'
  breakdown: {
    businessMaturity: number    // 0–15
    projectClarity: number      // 0–15
    budgetRealism: number       // 0–15
    urgencyAndIntent: number    // 0–15
    engagementDepth: number     // 0–15
    technicalFeasibility: number // 0–15
    commercialFit: number       // 0–10
  }
  narrative: string // 2–3 sentence explanation of the score
}
```

### Layer 6 — Proposal Intelligence (on-demand only)

**Model:** Claude Sonnet 4.6  
**Triggers:** When intent = `READY_FOR_PROPOSAL` or user confirms summary  
**Purpose:** Generate a high-quality proposal through a 4-step reasoning chain.

Each step is a separate Claude call. Each step's output is fed as input to the next.

**Step 1 — Architecture Selection**
- Check `clientTechPreferences` in state. If preferences exist, incorporate them.
- If no preferences: Claude reasons from scratch — project type, complexity, integration requirements, scale expectations, compliance needs.
- Output: recommended stack with justification for each choice.

**Step 2 — Complexity Calibration**
- Takes the feature list + recommended architecture.
- Estimates realistic engineering hours per feature.
- Identifies which features are deceptively complex (e.g., "real-time tracking" sounds simple but requires WebSockets, background services, battery optimisation).
- Output: phased delivery plan with hour estimates.

**Step 3 — Risk Identification**
- Technical risks: integration complexity, third-party dependencies, scalability gaps.
- Scope risks: features that are underspecified or likely to expand.
- Budget risks: where the budget is likely to be insufficient.
- Timeline risks: dependencies that could cause delays.
- Output: `TechnicalRisk[]` with severity and mitigation suggestions.

**Step 4 — Proposal Assembly**
- Takes outputs of Steps 1–3 plus the full `ProjectRequirementState`.
- Assembles the complete `ProposalContent` object.
- Includes: executive summary, scope in/out, deliverables, phases, pricing, tech stack, team, assumptions, risks, terms.

---

## 5. Enhanced State Schema

```typescript
interface ProjectRequirementState {
  // ── Session ──────────────────────────────────────────────────────────
  conversationId: string

  // ── Project Identity ─────────────────────────────────────────────────
  projectType: CanonicalProjectType | null
  projectName: string | null
  description: string | null
  businessModel: 'B2B' | 'B2C' | 'marketplace' | 'internal' | null // NEW
  industry: string | null

  // ── Canonical Features ────────────────────────────────────────────────
  features: CanonicalFeature[]        // mapped to ontology IDs, not raw strings
  integrations: string[]
  
  // ── Scope ────────────────────────────────────────────────────────────
  platforms: string[]
  authRequirements: string | null
  realtimeRequirements: string | null
  adminPanelRequirements: string | null

  // ── Business Context ──────────────────────────────────────────────────
  targetUsers: string | null
  userScale: string | null
  compliance: string[]

  // ── Constraints ───────────────────────────────────────────────────────
  technicalConstraints: string | null
  timelineExpectation: string | null
  budgetRange: BudgetRange

  // ── Client Tech Preferences ──────────────────────────────────────────  NEW
  clientTechPreferences: TechPreference | null
  // { frontend?, backend?, database?, hosting?, avoid[], existingSystems[] }

  // ── Workflow Intelligence ─────────────────────────────────────────────  NEW
  workflows: Workflow[]
  // { name, steps[], actors[], triggers[] }
  userRoles: UserRole[]

  // ── Confidence & Quality ─────────────────────────────────────────────  NEW
  fieldConfidence: Record<string, number>  // 0–1 per field
  confirmedFacts: string[]                 // explicitly stated by client
  assumptions: string[]                    // inferred by Claude, unconfirmed
  contradictions: Contradiction[]          // detected conflicts
  ambiguities: Ambiguity[]                 // things needing clarification

  // ── Conversation Memory ───────────────────────────────────────────────  NEW
  conversationSummary: string | null       // rolling compression after turn 8
  keyDiscoveries: string[]                 // most important facts from conversation

  // ── Discovery Intelligence ────────────────────────────────────────────  NEW
  discoveryTargets: DiscoveryTarget[]
  // { field, strategy, blockingScore, suggestedQuestion }
  technicalRisks: TechnicalRisk[]

  // ── Pipeline Outputs ──────────────────────────────────────────────────
  inferredComplexity: ComplexityLevel | null
  recommendedTechStack: TechStackRecommendation // Claude-generated if no client prefs
  completenessScore: number                      // weighted 0–100
  // Weights: projectType(10) + description(10) + platforms(8) + features(20)
  // + targetUsers(8) + authRequirements(6) + realtimeRequirements(6)
  // + integrations(6) + timelineExpectation(8) + budgetRange(10) + userScale(4) + technicalConstraints(4)
  missingInformation: MissingField[]
  leadScore: LeadScore | null
  summary: string | null
}
```

---

## 6. Feature Ontology

A pre-seeded table of ~150 canonical software features covering the most common project types handled by software agencies (SaaS, marketplaces, delivery apps, booking systems, dashboards, etc.).

**Canonical mapping approach:** Claude-based (no OpenAI embeddings required).

The feature ontology is injected into the L2 extraction system prompt as a structured list. It is placed at the beginning of the system prompt so Anthropic's prompt caching caches it after the first call per session (75% cost reduction on subsequent turns).

**Why Claude-based over pgvector:**
- Ontology size (~150–300 entries) is well within Claude's effective context
- Claude understands semantic meaning better than cosine similarity for short, ambiguous feature descriptions
- No additional API key (no OpenAI dependency)
- At scale > 500 features, swap to pgvector — the `feature_ontology` table is already in place

**Feature ontology table schema:**
```sql
-- Standard Prisma-managed columns
id              TEXT PRIMARY KEY   -- 'realtime_delivery_tracking'
canonical_name  TEXT               -- 'Real-time Delivery Tracking'
category        TEXT               -- 'logistics' | 'auth' | 'payments' | ...
aliases         TEXT[]             -- ['live tracking', 'GPS tracking', ...]
typical_complexity TEXT            -- 'LOW' | 'MEDIUM' | 'HIGH'
typical_hours_min  INT
typical_hours_max  INT
dependencies    TEXT[]             -- other canonical IDs this feature implies
incompatible_with TEXT[]           -- features that conflict with this one
created_at      TIMESTAMPTZ

-- Added via raw SQL migration (pgvector — for future use)
-- embedding VECTOR(1536)
-- CREATE INDEX ON feature_ontology USING ivfflat (embedding vector_cosine_ops)
```

---

## 7. Database Changes

### New table: `feature_ontology`
Seeded with ~150 canonical features via a one-time seed script. Added via Prisma migration + raw SQL for the vector column (added but not used until pgvector search is needed).

### Updated table: `ProjectAnalysis`
Eleven new JSON columns:

```prisma
model ProjectAnalysis {
  // ... existing fields unchanged ...

  // NEW
  conversationSummary  String?  @db.Text
  fieldConfidence      Json     @default("{}")
  confirmedFacts       Json     @default("[]")
  assumptions          Json     @default("[]")
  contradictions       Json     @default("[]")
  ambiguities          Json     @default("[]")
  discoveryTargets     Json     @default("[]")
  technicalRisks       Json     @default("[]")
  workflows            Json     @default("[]")
  userRoles            Json     @default("[]")
  keyDiscoveries       Json     @default("[]")
}
```

### Migration steps (user runs once)
1. Enable `vector` extension in Supabase dashboard → Database → Extensions
2. From repo root: `prisma migrate dev` — creates `feature_ontology` table + new `ProjectAnalysis` columns
3. Run raw SQL migration to add `embedding VECTOR(1536)` column + ivfflat index (exact SQL provided in migration file)
4. From `ai-service/`: `npm run seed:ontology` — inserts 150 canonical features into `feature_ontology` table
5. Done — no further manual DB work required

---

## 8. Project File Structure

```
dealghost/                        monorepo root
├── frontend/                     Next.js — Vercel
│   ├── app/
│   │   ├── api/proxy/
│   │   │   ├── chat/route.ts     thin proxy → AI service
│   │   │   └── proposal/route.ts
│   │   └── (page).tsx
│   ├── components/
│   │   ├── chat-panel.tsx
│   │   ├── intelligence-panel.tsx  live state updates via SSE
│   │   ├── proposal-viewer.tsx
│   │   └── lead-score-badge.tsx
│   ├── lib/
│   │   ├── ai-client.ts          calls AI service REST endpoints
│   │   └── sse-handler.ts        parses SSE events, updates UI state
│   └── package.json
│
├── ai-service/                   Hono — Railway
│   └── src/
│       ├── index.ts              Hono app entry point
│       ├── routes/
│       │   ├── chat.ts           POST /chat — runs pipeline, streams SSE
│       │   └── proposal.ts       POST /proposal — triggers L6
│       ├── pipeline/
│       │   ├── orchestrator.ts   runs all 6 layers, emits SSE events
│       │   ├── l1-understanding.ts
│       │   ├── l2-extraction.ts
│       │   ├── l3-state-engine.ts
│       │   ├── l4-discovery.ts
│       │   ├── l5-scoring.ts
│       │   └── l6-proposal.ts
│       ├── prompts/              one file per layer + utils
│       │   ├── understanding.ts
│       │   ├── extraction.ts
│       │   ├── discovery.ts
│       │   ├── scoring.ts
│       │   ├── proposal.ts
│       │   └── utils.ts
│       ├── ontology/
│       │   ├── feature-mapper.ts Claude-based canonical mapping
│       │   └── seed-data.ts      150 canonical feature definitions
│       ├── state/
│       │   ├── manager.ts        merge, contradiction detection, dedup
│       │   ├── memory.ts         rolling conversation summary
│       │   └── confidence.ts     per-field confidence scoring
│       ├── models/
│       │   ├── claude.ts         Anthropic SDK + prompt caching config
│       │   └── groq.ts           Groq SDK (intent only)
│       ├── db/
│       │   ├── redis.ts          Upstash client
│       │   └── prisma.ts         Prisma client
│       └── package.json
│
├── shared/                       shared types — imported by both services
│   ├── types/
│   │   ├── project.ts            ProjectRequirementState (canonical)
│   │   ├── pipeline.ts           PipelineEvent, SSE event payloads
│   │   ├── ontology.ts           CanonicalFeature, FeatureOntologyEntry
│   │   └── proposal.ts           ProposalContent
│   └── package.json              name: "@dealghost/shared"
│                                 Both frontend/ and ai-service/ reference this via
│                                 npm workspaces: "workspaces": ["frontend","ai-service","shared"]
│                                 in the root package.json. Import as: import { X } from "@dealghost/shared"
│
└── prisma/                       DB schema + migrations (shared)
    └── schema.prisma
```

---

## 9. Implementation Roadmap

| Phase | Days | Milestone |
|---|---|---|
| **1 — Foundation** | 1–2 | Hono starts, DB migrated, all types compile |
| **2 — Core Pipeline** | 3–5 | POST /chat works end-to-end, state saves to DB |
| **3 — Intelligence Layers** | 5–8 | Architect-quality follow-ups, lead score updating |
| **4 — Proposal Intelligence** | 8–10 | Full proposal generated from conversation state |
| **5 — SSE + Frontend** | 10–13 | Full demo — chat + live panel + proposal |
| **6 — Hardening + Deploy** | 13–14 | Live on Railway + Vercel, demo-ready |

### What the user handles
- Enable pgvector extension in Supabase dashboard
- Create Railway project, connect GitHub repo
- Set environment variables: `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Run migrations and seed script (single commands provided)
- Git pushes
- Railway + Vercel deploys

### What gets built
Everything else — all pipeline layers, all prompts, all state management, Redis integration, SSE streaming, frontend proxy, intelligence panel, proposal viewer, feature ontology seed data, migration files.

---

## 10. Architectural Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Anthropic API rate limits (Tier 1 key) | Medium | Prompt caching reduces call frequency; upgrade tier if needed |
| pgvector raw SQL migration fails | Low | Exact SQL provided; fallback is to skip embedding column and use table without vector search |
| SSE buffering through Vercel proxy | Medium | Set `Cache-Control: no-cache` + `X-Accel-Buffering: no` headers on proxy route |
| Rolling summary loses critical context | Medium | Summary prompt explicitly instructs preservation of all extracted facts and confirmed requirements |
| L6 multi-step chain produces inconsistent proposals | Low | Each step validates its output schema before passing to next; fallback to single-step if step validation fails |

---

## 11. What This Redesign Fixes

| Current | New |
|---|---|
| Single-shot extraction, misses fields | L1+L2 parallel reasoning chain, confidence per field |
| "live tracking" ≠ "GPS tracking" — two features | Both → `realtime_delivery_tracking` via canonical mapping |
| No contradiction detection — corrupted state | L1 detects, L3 flags, L4 resolves contradictions |
| Generic follow-up questions | L4 strategy engine — targets most proposal-blocking unknown |
| Message count gates for scoring | Claude business reasoning — budget realism, feasibility, commercial fit |
| Single-shot proposal generation | 4-step reasoning chain — architecture + complexity + risks + assembly |
| Full history sent every turn (unbounded tokens) | Rolling summary after turn 8 — stable token budget |
| 30s Vercel timeout on deep reasoning chains | Hono on Railway — no timeout, proper SSE streaming |
| All reasoning on Groq Llama-70b | Claude Sonnet for reasoning, Groq only for single-label intent classification |
