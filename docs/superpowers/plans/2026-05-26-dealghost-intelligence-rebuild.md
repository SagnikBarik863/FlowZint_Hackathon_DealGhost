# DEALGHOST Intelligence Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild DEALGHOST as a monorepo with a dedicated Hono AI service (6-layer Claude pipeline) and updated Next.js frontend with SSE-driven live intelligence panel.

**Architecture:** `dealghost/` monorepo root with `frontend/` (Next.js/Vercel), `ai-service/` (Hono/Railway), `shared/` (TypeScript types), and `prisma/` (DB schema). Messages flow: Groq intent pre-flight → L1+L2 parallel Claude reasoning → L3 TypeScript state merge → L4+L5 parallel Claude intelligence → L6 on-demand proposal chain. State hot-cached in Upstash Redis, cold-stored in Supabase via Prisma 7. Pipeline emits SSE events layer-by-layer to the Next.js frontend.

**Tech Stack:** Next.js 16, Hono 4, @hono/node-server, Anthropic SDK (`@anthropic-ai/sdk`), Groq SDK (`groq-sdk`), Prisma 7, @upstash/redis, Supabase PostgreSQL, Zod 4, TypeScript 5, Vitest 2

---

## ⚠️ User Actions Required (one-time setup before Phase 1)

Before writing any code, you need to complete these manually:

1. **Supabase** — Enable the `vector` extension: Dashboard → Database → Extensions → search "vector" → enable it (needed for the table column even though we don't use it yet)
2. **Railway** — Create a new project, connect your GitHub repo
3. **Upstash** — Create a free Redis database at upstash.com, copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. **Env vars ready** — Have these available for `.env` files:
   - `ANTHROPIC_API_KEY`
   - `GROQ_API_KEY`
   - `DATABASE_URL` (Supabase connection string)
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `FRONTEND_URL` (for CORS, e.g. `http://localhost:3000`)

---

## File Map

### Files created in Phase 1

```
dealghost/                            ← monorepo root
├── package.json                      ← NEW: workspace root (replaces old Next.js package.json)
├── tsconfig.base.json                ← NEW: shared TS config
│
├── shared/                           ← NEW
│   ├── package.json
│   ├── index.ts
│   └── types/
│       ├── project.ts                ← ProjectRequirementState + all supporting types
│       ├── pipeline.ts               ← SemanticUnderstanding, ExtractionResult, DiscoveryResult, LeadScore, PipelineEvent
│       ├── ontology.ts               ← FeatureOntologyEntry
│       └── proposal.ts               ← ProposalContent
│
├── ai-service/                       ← NEW
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── .env                          ← (you create this — not committed)
│   └── src/
│       ├── index.ts                  ← Hono app entry, /health, /debug/pipeline stub
│       ├── models/
│       │   ├── claude.ts             ← Anthropic SDK wrapper with prompt caching
│       │   └── groq.ts               ← Groq SDK wrapper (intent only)
│       └── db/
│           ├── redis.ts              ← Upstash client + state load/save helpers
│           └── prisma.ts             ← Prisma 7 client with pg adapter
│
├── frontend/                         ← MOVED from root (all existing Next.js files)
│   ├── package.json                  ← existing package.json (updated name + workspace dep)
│   ├── tsconfig.json                 ← updated paths for @dealghost/shared
│   └── ... (all existing app/, components/, lib/, types/, public/ files)
│
└── prisma/                           ← UPDATED (stays at root)
    └── schema.prisma                 ← + FeatureOntology model + 11 new ProjectAnalysis columns
```

### Files created in later phases (for reference)

```
ai-service/src/
├── routes/
│   ├── chat.ts                       ← Phase 2
│   └── proposal.ts                   ← Phase 4
├── pipeline/
│   ├── orchestrator.ts               ← Phase 3
│   ├── l1-understanding.ts           ← Phase 3
│   ├── l2-extraction.ts              ← Phase 2
│   ├── l3-state-engine.ts            ← Phase 2
│   ├── l4-discovery.ts               ← Phase 3
│   ├── l5-scoring.ts                 ← Phase 3
│   └── l6-proposal.ts                ← Phase 4
├── prompts/
│   ├── understanding.ts              ← Phase 3
│   ├── extraction.ts                 ← Phase 2
│   ├── discovery.ts                  ← Phase 3
│   ├── scoring.ts                    ← Phase 3
│   └── proposal.ts                   ← Phase 4
├── ontology/
│   ├── feature-mapper.ts             ← Phase 2
│   └── seed-data.ts                  ← Phase 2
├── knowledge/
│   └── company-profile.ts            ← Phase 2 (FlowZint service catalog + pricing + architecture)
└── state/
    ├── manager.ts                    ← Phase 2
    ├── memory.ts                     ← Phase 3
    └── confidence.ts                 ← Phase 2
```

---

## Phase 1 — Foundation

**Milestone:** Hono service starts on port 3001, `GET /health` returns `{ status: "ok" }`, all shared types compile, Prisma migration applied, Redis and Prisma clients connect.

---

### Task 1: Monorepo restructure — move Next.js app into `frontend/`

**Files:**
- Create: `dealghost/frontend/` (directory)
- Move: everything currently at `dealghost/` root (except `prisma/`, `.git`, `node_modules`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `.gitignore`) → `dealghost/frontend/`

- [ ] **Step 1: Create the `frontend/` directory and move the Next.js app into it**

  From the `dealghost/` directory, run:
  ```bash
  mkdir frontend
  mv app components lib types public next.config.ts tsconfig.json eslint.config.mjs postcss.config.mjs package.json frontend/
  ```

  > If any of those directories/files don't exist, skip them — `mv` will error on missing paths.

- [ ] **Step 2: Verify the move**

  ```bash
  ls frontend/
  ```
  Expected output includes: `app/  package.json  next.config.ts  tsconfig.json`

- [ ] **Step 3: Update `frontend/tsconfig.json` — add `@dealghost/shared` path alias**

  Open `frontend/tsconfig.json`. The `compilerOptions` section currently has `"paths": { "@/*": ["./*"] }`. Add the shared alias:

  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "@/*": ["./*"],
        "@dealghost/shared": ["../shared/index.ts"],
        "@dealghost/shared/*": ["../shared/types/*"]
      }
    }
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "chore: move Next.js app into frontend/ — monorepo restructure"
  ```

---

### Task 2: Root workspace `package.json` + base tsconfig

**Files:**
- Create: `dealghost/package.json`
- Create: `dealghost/tsconfig.base.json`

- [ ] **Step 1: Create the monorepo root `package.json`**

  Create `dealghost/package.json`:
  ```json
  {
    "name": "dealghost-monorepo",
    "private": true,
    "workspaces": [
      "frontend",
      "ai-service",
      "shared"
    ],
    "scripts": {
      "dev:frontend": "npm run dev --workspace=frontend",
      "dev:ai": "npm run dev --workspace=ai-service",
      "build": "npm run build --workspaces"
    }
  }
  ```

- [ ] **Step 2: Create `dealghost/tsconfig.base.json`**

  Create `dealghost/tsconfig.base.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true
    }
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add package.json tsconfig.base.json
  git commit -m "chore: add monorepo root package.json with npm workspaces"
  ```

---

### Task 3: Shared types package

**Files:**
- Create: `dealghost/shared/package.json`
- Create: `dealghost/shared/index.ts`
- Create: `dealghost/shared/types/project.ts`
- Create: `dealghost/shared/types/pipeline.ts`
- Create: `dealghost/shared/types/ontology.ts`
- Create: `dealghost/shared/types/proposal.ts`

- [ ] **Step 1: Create `shared/package.json`**

  Create `dealghost/shared/package.json`:
  ```json
  {
    "name": "@dealghost/shared",
    "version": "0.0.1",
    "private": true,
    "main": "./index.ts",
    "types": "./index.ts",
    "exports": {
      ".": "./index.ts"
    }
  }
  ```

- [ ] **Step 2: Create `shared/types/project.ts`**

  Create `dealghost/shared/types/project.ts`:
  ```typescript
  export type CanonicalProjectType =
    | 'web_app'
    | 'mobile_app'
    | 'api'
    | 'saas_platform'
    | 'marketplace'
    | 'e_commerce'
    | 'dashboard'
    | 'integration'
    | 'redesign'
    | 'other'

  export type ComplexityLevel = 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'

  export type DiscoveryStrategy =
    | 'clarify_scope'
    | 'probe_complexity'
    | 'resolve_contradiction'
    | 'confirm_assumption'
    | 'discover_workflow'
    | 'ask_tech_preference'
    | 'offer_summary'

  export interface BudgetRange {
    min: number | null
    max: number | null
    currency: string
  }

  export interface CanonicalFeature {
    canonicalId: string
    rawText: string
    confidence: number // 0–1
    category: string
    priority: 'MUST' | 'SHOULD' | 'COULD'
    isConfirmed: boolean
    dependencies: string[]
  }

  export interface TechPreference {
    frontend?: string
    backend?: string
    database?: string
    hosting?: string
    avoid: string[]
    existingSystems: string[]
  }

  export interface Workflow {
    name: string
    steps: string[]
    actors: string[]
    triggers: string[]
  }

  export interface UserRole {
    name: string
    permissions: string[]
    count?: string
  }

  export interface Contradiction {
    field: string
    existingFact: string
    newStatement: string
    turnNumber: number
    resolved: boolean
    resolution?: string
  }

  export interface Ambiguity {
    field: string
    statement: string
    possibleInterpretations: string[]
  }

  export interface DiscoveryTarget {
    field: string
    strategy: DiscoveryStrategy
    blockingScore: number // 0–1, higher = more blocking
    suggestedQuestion: string
  }

  export interface TechnicalRisk {
    area: string
    description: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    mitigation: string
  }

  export interface MissingField {
    field: string
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
    reason: string
  }

  export interface TechStackRecommendation {
    frontend: string
    backend: string
    database: string
    hosting: string
    reasoning: string
  }

  export interface LeadScore {
    score: number // 0–100
    label:
      | 'High Intent Lead'
      | 'Qualified Prospect'
      | 'Needs Nurturing'
      | 'Low Qualification'
      | 'Unqualified'
    breakdown: {
      businessMaturity: number    // 0–15
      projectClarity: number      // 0–15
      budgetRealism: number       // 0–15
      urgencyAndIntent: number    // 0–15
      engagementDepth: number     // 0–15
      technicalFeasibility: number // 0–15
      commercialFit: number       // 0–10
    }
    narrative: string
  }

  export interface ProjectRequirementState {
    conversationId: string

    // ── Project Identity ─────────────────────────────────────────────────
    projectType: CanonicalProjectType | null
    projectName: string | null
    description: string | null
    businessModel: 'B2B' | 'B2C' | 'marketplace' | 'internal' | null
    industry: string | null

    // ── Canonical Features ────────────────────────────────────────────────
    features: CanonicalFeature[]
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

    // ── Client Tech Preferences ───────────────────────────────────────────
    clientTechPreferences: TechPreference | null

    // ── Workflow Intelligence ─────────────────────────────────────────────
    workflows: Workflow[]
    userRoles: UserRole[]

    // ── Confidence & Quality ──────────────────────────────────────────────
    fieldConfidence: Record<string, number> // 0–1 per field
    confirmedFacts: string[]
    assumptions: string[]
    contradictions: Contradiction[]
    ambiguities: Ambiguity[]

    // ── Conversation Memory ───────────────────────────────────────────────
    conversationSummary: string | null
    keyDiscoveries: string[]

    // ── Discovery Intelligence ────────────────────────────────────────────
    discoveryTargets: DiscoveryTarget[]
    technicalRisks: TechnicalRisk[]

    // ── Pipeline Outputs ──────────────────────────────────────────────────
    inferredComplexity: ComplexityLevel | null
    recommendedTechStack: TechStackRecommendation | null
    completenessScore: number // weighted 0–100
    missingInformation: MissingField[]
    leadScore: LeadScore | null
    summary: string | null
  }

  export function createEmptyState(conversationId: string): ProjectRequirementState {
    return {
      conversationId,
      projectType: null,
      projectName: null,
      description: null,
      businessModel: null,
      industry: null,
      features: [],
      integrations: [],
      platforms: [],
      authRequirements: null,
      realtimeRequirements: null,
      adminPanelRequirements: null,
      targetUsers: null,
      userScale: null,
      compliance: [],
      technicalConstraints: null,
      timelineExpectation: null,
      budgetRange: { min: null, max: null, currency: 'USD' },
      clientTechPreferences: null,
      workflows: [],
      userRoles: [],
      fieldConfidence: {},
      confirmedFacts: [],
      assumptions: [],
      contradictions: [],
      ambiguities: [],
      conversationSummary: null,
      keyDiscoveries: [],
      discoveryTargets: [],
      technicalRisks: [],
      inferredComplexity: null,
      recommendedTechStack: null,
      completenessScore: 0,
      missingInformation: [],
      leadScore: null,
      summary: null,
    }
  }
  ```

- [ ] **Step 3: Create `shared/types/pipeline.ts`**

  Create `dealghost/shared/types/pipeline.ts`:
  ```typescript
  import type { CanonicalFeature, TechPreference, Workflow, UserRole, BudgetRange, Contradiction } from './project.js'

  // ── L1 Output ───────────────────────────────────────────────────────────────

  export interface SemanticUnderstanding {
    semanticIntent:
      | 'adding'
      | 'correcting'
      | 'removing'
      | 'clarifying'
      | 'elaborating'
      | 'questioning'
      | 'done'
      | 'confirming'
    businessDomain: string
    keyEntities: Array<{
      type: 'feature' | 'integration' | 'constraint' | 'person' | 'system'
      value: string
    }>
    corrections: Array<{ field: string; oldValue: string; newValue: string }>
    contradictions: Array<{ existingFact: string; newStatement: string; field: string }>
    workflowsDescribed: string[]
    urgencySignals: string[]
    businessModelHints: string[]
    confidenceInUnderstanding: number // 0–1
  }

  // ── L2 Output ───────────────────────────────────────────────────────────────

  export interface ExtractionResult {
    features: CanonicalFeature[]
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
    featuresToRemove: string[] // canonical IDs to remove from state
    assumptions: string[]
    newCanonicalEntries: Array<{
      id: string
      canonicalName: string
      category: string
      aliases: string[]
    }>
  }

  // ── L4 Output ───────────────────────────────────────────────────────────────

  export interface DiscoveryResult {
    strategy:
      | 'clarify_scope'
      | 'probe_complexity'
      | 'resolve_contradiction'
      | 'confirm_assumption'
      | 'discover_workflow'
      | 'ask_tech_preference'
      | 'offer_summary'
    targetField: string
    reasoning: string
    question: string
    readyForSummary: boolean
  }

  // ── SSE Events ───────────────────────────────────────────────────────────────

  export type PipelineLayer = 'preflight' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'

  export type PipelineEventType =
    | 'pipeline_start'
    | 'layer_start'
    | 'layer_complete'
    | 'state_update'
    | 'response'
    | 'error'
    | 'pipeline_complete'

  export interface PipelineEvent {
    type: PipelineEventType
    layer?: PipelineLayer
    data?: unknown
    timestamp: number
  }

  // ── Chat API ─────────────────────────────────────────────────────────────────

  export interface ChatRequest {
    message: string
    conversationId?: string
  }

  export interface ChatResponse {
    conversationId: string
    message: string
    state: import('./project.js').ProjectRequirementState
    intent: string
    readyForProposal: boolean
  }
  ```

- [ ] **Step 4: Create `shared/types/ontology.ts`**

  Create `dealghost/shared/types/ontology.ts`:
  ```typescript
  export interface FeatureOntologyEntry {
    id: string                   // snake_case canonical ID e.g. 'realtime_delivery_tracking'
    canonicalName: string        // human-readable e.g. 'Real-time Delivery Tracking'
    category: string             // 'auth' | 'payments' | 'tracking' | 'logistics' | ...
    description: string | null   // one-sentence description of what this capability does
    aliases: string[]            // ['live tracking', 'GPS tracking', 'track orders', ...]
    typicalComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | null
    typicalHoursMin: number | null
    typicalHoursMax: number | null
    dependencies: string[]       // canonical IDs this feature requires to function
    incompatibleWith: string[]
    relatedFeatures: string[]    // commonly appear alongside this feature (not required)
    commonProjectTypes: string[] // project types that typically need this feature
  }
  ```

- [ ] **Step 5: Create `shared/types/proposal.ts`**

  Create `dealghost/shared/types/proposal.ts`:
  ```typescript
  export interface ProposalContent {
    executiveSummary: string
    scope: {
      included: string[]
      excluded: string[]
    }
    deliverables: Array<{
      name: string
      description: string
      milestone: string
    }>
    timeline: {
      phases: Array<{
        name: string
        durationWeeks: number
        deliverables: string[]
      }>
    }
    pricing: {
      model: 'fixed' | 'time_and_materials' | 'retainer'
      breakdown: Array<{ item: string; costUsd: number }>
      totalUsd: number
      currency: string
    }
    techStack: {
      frontend: string
      backend: string
      database: string
      hosting: string
      reasoning: string
    }
    team: Array<{
      role: string
      count: number
      allocationPct: number
    }>
    assumptions: string[]
    risks: Array<{
      description: string
      severity: 'LOW' | 'MEDIUM' | 'HIGH'
      mitigation: string
    }>
    terms: string
  }
  ```

- [ ] **Step 6: Create `shared/index.ts`**

  Create `dealghost/shared/index.ts`:
  ```typescript
  export * from './types/project.js'
  export * from './types/pipeline.js'
  export * from './types/ontology.js'
  export * from './types/proposal.js'
  ```

- [ ] **Step 7: Verify types compile**

  From `dealghost/shared/`:
  ```bash
  npx tsc --noEmit --moduleResolution node --module esnext --target es2022 --strict index.ts
  ```
  Expected: No errors.

- [ ] **Step 8: Commit**

  ```bash
  git add shared/
  git commit -m "feat: add @dealghost/shared types package — ProjectRequirementState, pipeline layer types, ProposalContent"
  ```

---

### Task 4: AI service skeleton — Hono app + package.json + tsconfig

**Files:**
- Create: `dealghost/ai-service/package.json`
- Create: `dealghost/ai-service/tsconfig.json`
- Create: `dealghost/ai-service/vitest.config.ts`
- Create: `dealghost/ai-service/src/index.ts`
- Create: `dealghost/ai-service/.env` (you fill in the values)

- [ ] **Step 1: Create `ai-service/package.json`**

  Create `dealghost/ai-service/package.json`:
  ```json
  {
    "name": "@dealghost/ai-service",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "tsx watch src/index.ts",
      "build": "tsc",
      "start": "node dist/index.js",
      "test": "vitest run",
      "test:watch": "vitest",
      "seed:ontology": "tsx src/ontology/seed-data.ts"
    },
    "dependencies": {
      "@anthropic-ai/sdk": "^0.52.0",
      "@dealghost/shared": "*",
      "@hono/node-server": "^1.14.0",
      "@prisma/adapter-pg": "^7.8.0",
      "@prisma/client": "^7.8.0",
      "@upstash/redis": "^1.34.0",
      "groq-sdk": "^1.2.0",
      "hono": "^4.7.0",
      "pg": "^8.21.0",
      "zod": "^3.24.0"
    },
    "devDependencies": {
      "@types/node": "^20",
      "@types/pg": "^8.20.0",
      "@vitest/coverage-v8": "^2.0.0",
      "tsx": "^4.19.0",
      "typescript": "^5",
      "vitest": "^2.0.0"
    }
  }
  ```

  > Note: `zod` is v3 here (not v4) because the Hono ecosystem and most Node.js tooling still targets Zod 3. The frontend uses Zod 4.

- [ ] **Step 2: Create `ai-service/tsconfig.json`**

  Create `dealghost/ai-service/tsconfig.json`:
  ```json
  {
    "extends": "../tsconfig.base.json",
    "compilerOptions": {
      "rootDir": "src",
      "outDir": "dist",
      "baseUrl": ".",
      "paths": {
        "@dealghost/shared": ["../shared/index.ts"],
        "@dealghost/shared/*": ["../shared/types/*"]
      }
    },
    "include": ["src/**/*"]
  }
  ```

- [ ] **Step 3: Create `ai-service/vitest.config.ts`**

  Create `dealghost/ai-service/vitest.config.ts`:
  ```typescript
  import { defineConfig } from 'vitest/config'

  export default defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
    resolve: {
      alias: {
        '@dealghost/shared': new URL('../shared/index.ts', import.meta.url).pathname,
      },
    },
  })
  ```

- [ ] **Step 4: Create `ai-service/src/index.ts`**

  Create `dealghost/ai-service/src/index.ts`:
  ```typescript
  import { serve } from '@hono/node-server'
  import { Hono } from 'hono'
  import { cors } from 'hono/cors'
  import { logger } from 'hono/logger'

  const app = new Hono()

  // ── Middleware ────────────────────────────────────────────────────────────────
  app.use('*', logger())
  app.use(
    '*',
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })
  )

  // ── Health ────────────────────────────────────────────────────────────────────
  app.get('/health', (c) =>
    c.json({ status: 'ok', service: 'dealghost-ai', timestamp: new Date().toISOString() })
  )

  // ── Debug pipeline (stub — grows as layers are built in Phase 2+) ─────────────
  app.post('/debug/pipeline', async (c) => {
    const body = await c.req.json()
    return c.json({
      message: 'Pipeline debug endpoint — layers will be wired in Phase 2',
      receivedMessage: body.message ?? null,
      receivedConversationId: body.conversationId ?? null,
    })
  })

  // ── Start server ──────────────────────────────────────────────────────────────
  const port = Number(process.env.PORT ?? 3001)
  serve({ fetch: app.fetch, port }, () => {
    console.log(`🤖 DEALGHOST AI service running on http://localhost:${port}`)
  })

  export default app
  ```

- [ ] **Step 5: Create `ai-service/.env`** (you fill in real values)

  Create `dealghost/ai-service/.env`:
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  GROQ_API_KEY=gsk_...
  DATABASE_URL=postgresql://...
  UPSTASH_REDIS_REST_URL=https://...
  UPSTASH_REDIS_REST_TOKEN=...
  FRONTEND_URL=http://localhost:3000
  PORT=3001
  ```

- [ ] **Step 6: Install dependencies**

  From `dealghost/` root:
  ```bash
  npm install
  ```
  Expected: Creates `node_modules/` with all workspace packages linked. `@dealghost/shared` is symlinked.

- [ ] **Step 7: Run the dev server**

  From `dealghost/ai-service/`:
  ```bash
  npm run dev
  ```
  Expected output:
  ```
  🤖 DEALGHOST AI service running on http://localhost:3001
  ```

- [ ] **Step 8: Test the health endpoint**

  ```bash
  curl http://localhost:3001/health
  ```
  Expected:
  ```json
  { "status": "ok", "service": "dealghost-ai", "timestamp": "2026-05-26T..." }
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add ai-service/
  git commit -m "feat: add Hono AI service skeleton with /health and /debug/pipeline stub"
  ```

---

### Task 5: Model wrappers — Claude (with prompt caching) + Groq

**Files:**
- Create: `dealghost/ai-service/src/models/claude.ts`
- Create: `dealghost/ai-service/src/models/groq.ts`
- Create: `dealghost/ai-service/src/models/claude.test.ts`

- [ ] **Step 1: Write failing test for Claude wrapper**

  Create `dealghost/ai-service/src/models/claude.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from 'vitest'

  // Mock the Anthropic SDK before importing the wrapper
  vi.mock('@anthropic-ai/sdk', () => ({
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"result": "mocked"}' }],
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
      },
    })),
  }))

  describe('callClaude', () => {
    it('returns text content from Claude response', async () => {
      const { callClaude } = await import('./claude.js')
      const result = await callClaude({
        system: 'You are a test assistant.',
        messages: [{ role: 'user', content: 'Say hello' }],
      })
      expect(result).toBe('{"result": "mocked"}')
    })

    it('extracts JSON from markdown code blocks', async () => {
      const { callClaudeJSON } = await import('./claude.js')
      const result = await callClaudeJSON(
        {
          system: 'Return JSON',
          messages: [{ role: 'user', content: 'Give me JSON' }],
        },
        (raw) => JSON.parse(raw)
      )
      expect(result).toEqual({ result: 'mocked' })
    })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**

  From `dealghost/ai-service/`:
  ```bash
  npm test -- src/models/claude.test.ts
  ```
  Expected: FAIL — `Cannot find module './claude.js'`

- [ ] **Step 3: Create `ai-service/src/models/claude.ts`**

  Create `dealghost/ai-service/src/models/claude.ts`:
  ```typescript
  import Anthropic from '@anthropic-ai/sdk'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  export const CLAUDE_MODEL = 'claude-sonnet-4-6'

  export interface ClaudeMessage {
    role: 'user' | 'assistant'
    content: string
  }

  export interface ClaudeCallOptions {
    system: string
    messages: ClaudeMessage[]
    maxTokens?: number
    temperature?: number
    /**
     * If true, the entire system prompt is marked for Anthropic prompt caching.
     * Use this when the system prompt is large and stable across turns (e.g. L2
     * extraction where the feature ontology is injected into the system prompt).
     * This reduces cost by ~75% on cached tokens after the first call.
     */
    cacheSystemPrompt?: boolean
  }

  /**
   * Call Claude and return the raw text response.
   */
  export async function callClaude(options: ClaudeCallOptions): Promise<string> {
    const systemContent: Anthropic.MessageParam['content'] | Anthropic.TextBlockParam[] =
      options.cacheSystemPrompt
        ? [
            {
              type: 'text',
              text: options.system,
              cache_control: { type: 'ephemeral' },
            } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
          ]
        : options.system

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.3,
      system: systemContent as string,
      messages: options.messages,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content')
    }
    return textBlock.text
  }

  /**
   * Call Claude expecting JSON output. Strips markdown code fences if present.
   * Pass a parse function (e.g. your Zod schema's .parse method).
   */
  export async function callClaudeJSON<T>(
    options: ClaudeCallOptions,
    parse: (raw: string) => T
  ): Promise<T> {
    const raw = await callClaude(options)

    // Strip markdown code fences if Claude wrapped the JSON
    const fenceMatch = raw.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    const jsonStr = fenceMatch ? fenceMatch[1] : raw.trim()

    try {
      return parse(jsonStr)
    } catch (err) {
      throw new Error(
        `Failed to parse Claude JSON response.\nRaw output: ${raw.slice(0, 500)}\nError: ${String(err)}`
      )
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  npm test -- src/models/claude.test.ts
  ```
  Expected: PASS — 2 tests passing

- [ ] **Step 5: Create `ai-service/src/models/groq.ts`**

  Create `dealghost/ai-service/src/models/groq.ts`:
  ```typescript
  import Groq from 'groq-sdk'

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

  /**
   * Groq is used ONLY for intent classification (pre-flight).
   * Fast (~300ms), cheap (free tier), outputs a single label.
   */
  export const GROQ_INTENT_MODEL = 'llama-3.1-8b-instant'

  export async function callGroqIntent(userMessage: string, recentHistory: string): Promise<string> {
    const response = await client.chat.completions.create({
      model: GROQ_INTENT_MODEL,
      temperature: 0,
      max_tokens: 20,
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier. Given a client message in a pre-sales discovery conversation, return EXACTLY one of these labels with no other text:

COLLECTING_INFO     — client is describing their project, adding requirements, answering questions
REQUESTING_DONE     — client wants to finish the conversation, see a summary, or wrap up
CONFIRMING_SUMMARY  — client is confirming or agreeing with a summary that was shown
EDITING_SUMMARY     — client is correcting or modifying something in a summary
READY_FOR_PROPOSAL  — client is explicitly asking for a proposal or pricing

Return only the label. No explanation. No punctuation.`,
        },
        {
          role: 'user',
          content: `Recent conversation:\n${recentHistory}\n\nLatest message: "${userMessage}"`,
        },
      ],
    })

    const text = response.choices[0]?.message?.content?.trim() ?? 'COLLECTING_INFO'
    const valid = ['COLLECTING_INFO', 'REQUESTING_DONE', 'CONFIRMING_SUMMARY', 'EDITING_SUMMARY', 'READY_FOR_PROPOSAL']
    return valid.includes(text) ? text : 'COLLECTING_INFO'
  }
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/models/
  git commit -m "feat: add Claude wrapper (with prompt caching) and Groq intent wrapper"
  ```

---

### Task 6: Database clients — Prisma + Redis

**Files:**
- Create: `dealghost/ai-service/src/db/prisma.ts`
- Create: `dealghost/ai-service/src/db/redis.ts`

- [ ] **Step 1: Create `ai-service/src/db/prisma.ts`**

  Create `dealghost/ai-service/src/db/prisma.ts`:
  ```typescript
  import { PrismaClient } from '../../../../generated/prisma/index.js'
  import { PrismaPg } from '@prisma/adapter-pg'
  import pg from 'pg'

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
  })

  const adapter = new PrismaPg(pool)

  export const prisma = new PrismaClient({ adapter })
  ```

- [ ] **Step 2: Create `ai-service/src/db/redis.ts`**

  Create `dealghost/ai-service/src/db/redis.ts`:
  ```typescript
  import { Redis } from '@upstash/redis'
  import type { ProjectRequirementState } from '@dealghost/shared'

  export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  const STATE_TTL_SECONDS = 60 * 60 * 24 // 24 hours

  const stateKey = (conversationId: string) => `dealghost:state:${conversationId}`

  /**
   * Load conversation state from Redis.
   * Returns null if not found (first turn, or TTL expired).
   */
  export async function loadState(conversationId: string): Promise<ProjectRequirementState | null> {
    return redis.get<ProjectRequirementState>(stateKey(conversationId))
  }

  /**
   * Save conversation state to Redis with a 24-hour TTL.
   * Called after every pipeline turn.
   */
  export async function saveState(conversationId: string, state: ProjectRequirementState): Promise<void> {
    await redis.set(stateKey(conversationId), state, { ex: STATE_TTL_SECONDS })
  }

  /**
   * Delete state from Redis (e.g. after conversation ends or proposal generated).
   */
  export async function deleteState(conversationId: string): Promise<void> {
    await redis.del(stateKey(conversationId))
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/db/
  git commit -m "feat: add Prisma client and Upstash Redis state helpers"
  ```

---

### Task 7: Prisma schema migration

**Files:**
- Modify: `dealghost/prisma/schema.prisma`

- [ ] **Step 1: Add `FeatureOntology` model and 11 new `ProjectAnalysis` columns to `schema.prisma`**

  Open `dealghost/prisma/schema.prisma`. Add the following **after** the existing `Proposal` model:

  ```prisma
  /// Canonical software capability graph — 68 pre-seeded entries covering common project types.
  /// Claude maps raw feature text to canonical IDs during L2 extraction.
  model FeatureOntology {
    id                 String   @id              // 'realtime_delivery_tracking'
    canonicalName      String                    // 'Real-time Delivery Tracking'
    category           String                    // 'auth' | 'payments' | 'tracking' | ...
    description        String?  @db.Text         // one-sentence capability description
    aliases            String[]                  // ['live tracking', 'gps tracking', ...]
    typicalComplexity  String?                   // 'LOW' | 'MEDIUM' | 'HIGH'
    typicalHoursMin    Int?
    typicalHoursMax    Int?
    dependencies       String[] @default([])     // canonical IDs this feature requires
    incompatibleWith   String[] @default([])
    relatedFeatures    String[] @default([])     // commonly appear alongside (not required)
    commonProjectTypes String[] @default([])     // project types that typically need this
    createdAt          DateTime @default(now())

    @@map("feature_ontology")
  }
  ```

  Then in the existing `ProjectAnalysis` model, add 11 new fields after `summary String? @db.Text`:

  ```prisma
  // ── Intelligence fields (added in intelligence rebuild) ──────────────────────
  conversationSummary String?  @db.Text
  fieldConfidence     Json     @default("{}")
  confirmedFacts      Json     @default("[]")
  assumptions         Json     @default("[]")
  contradictions      Json     @default("[]")
  ambiguities         Json     @default("[]")
  discoveryTargets    Json     @default("[]")
  technicalRisks      Json     @default("[]")
  workflows           Json     @default("[]")
  userRoles           Json     @default("[]")
  keyDiscoveries      Json     @default("[]")
  ```

- [ ] **Step 2: Run the migration**

  > **You do this step.** From `dealghost/`:
  ```bash
  npx prisma migrate dev --name intelligence-rebuild
  ```
  Expected: Creates a new migration file in `prisma/migrations/`, applies it to your Supabase database.

- [ ] **Step 3: Regenerate the Prisma client**

  ```bash
  npx prisma generate
  ```
  Expected: Updates `generated/prisma/` with the new types including `FeatureOntology`.

- [ ] **Step 4: Verify the generated types include `FeatureOntology`**

  ```bash
  grep -r "FeatureOntology" generated/prisma/ | head -5
  ```
  Expected: Shows type definitions for `FeatureOntology`.

- [ ] **Step 5: Commit**

  ```bash
  git add prisma/ generated/
  git commit -m "feat: add FeatureOntology model and 11 new ProjectAnalysis intelligence fields"
  ```

---

### Phase 1 Milestone Check

- [ ] `GET http://localhost:3001/health` → `{ "status": "ok" }`
- [ ] `POST http://localhost:3001/debug/pipeline` with `{ "message": "test" }` → stub response
- [ ] `npm test` in `ai-service/` → 2 tests passing (Claude wrapper)
- [ ] `npx prisma studio` shows `feature_ontology` table and new `ProjectAnalysis` columns
- [ ] No TypeScript errors: `npx tsc --noEmit` in `ai-service/`

---

---

## Phase 2 — Core Pipeline

**Milestone:** Send `"I need a food delivery app with real-time tracking and Stripe payments"` to `POST /chat` → get back a structured state with features mapped to canonical IDs, completeness score calculated, state saved to Redis + Supabase. `/debug/pipeline` shows raw L2 and L3 outputs.

> **Schema note (additive only):** Phase 2 adds `CONFIDENCE_THRESHOLDS` as a constant export to `shared/types/project.ts`. This does not change any interface — it is a new named export. No migration required.

---

### Task 8: Add confidence threshold constants to shared types

**Files:**
- Modify: `dealghost/shared/types/project.ts`

- [ ] **Step 1: Add `CONFIDENCE_THRESHOLDS` constant after the `CanonicalFeature` interface**

  Open `dealghost/shared/types/project.ts`. After the `CanonicalFeature` interface, add:

  ```typescript
  /**
   * Confidence score thresholds for canonical feature mapping.
   * Claude must follow these definitions when assigning confidence to extracted features.
   *
   * ≥ 0.95  — explicitly stated by the client word-for-word
   * 0.80–0.95 — strong semantic equivalence (different words, same concept)
   * 0.60–0.80 — reasonable inference from context (implied, not stated)
   * < 0.60  — uncertain assumption (possible but not clearly indicated)
   */
  export const CONFIDENCE_THRESHOLDS = {
    EXPLICIT: 0.95,       // "we need Stripe payments" → payment_processing
    SEMANTIC: 0.80,       // "handle money transfers" → payment_processing
    INFERRED: 0.60,       // marketplace context implies payment_processing
    UNCERTAIN: 0.0,       // lower bound — anything below 0.60 is an assumption
  } as const
  ```

- [ ] **Step 2: Re-verify shared types compile**

  From `dealghost/shared/`:
  ```bash
  npx tsc --noEmit --moduleResolution node --module esnext --target es2022 --strict index.ts
  ```
  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add shared/types/project.ts
  git commit -m "feat(shared): add CONFIDENCE_THRESHOLDS constant — strict definitions for L2 extraction"
  ```

---

### Task 9: Feature ontology seed data + seed script

**Files:**
- Create: `dealghost/ai-service/src/ontology/seed-data.ts`

- [ ] **Step 1: Create `ontology/seed-data.ts`**

  Create `dealghost/ai-service/src/ontology/seed-data.ts`:

  ```typescript
  import type { FeatureOntologyEntry } from '@dealghost/shared'
  import { prisma } from '../db/prisma.js'

  // ── 68 canonical features across 18 categories ──────────────────────────────
  // Structured as a capability graph: description + relatedFeatures + commonProjectTypes
  // enable semantic matching, discovery suggestions, and future domain-based filtering.

  export const ONTOLOGY_SEED: FeatureOntologyEntry[] = [
    // ── AUTH ──────────────────────────────────────────────────────────────────
    {
      id: 'user_auth',
      canonicalName: 'User Authentication',
      category: 'auth',
      description: 'Core account creation and session management — the foundation of any user-facing application.',
      aliases: ['login', 'sign in', 'sign up', 'register', 'authentication', 'user accounts', 'account system'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['oauth_social_login', 'role_based_access_control', 'user_profiles'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'delivery_app', 'booking_platform', 'ecommerce_store', 'social_platform'],
    },
    {
      id: 'oauth_social_login',
      canonicalName: 'Social / OAuth Login',
      category: 'auth',
      description: 'Allow users to sign in using existing Google, Apple, or Facebook accounts instead of creating a new password.',
      aliases: ['google login', 'facebook login', 'apple login', 'social login', 'oauth', 'sso via social', 'sign in with google'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 16,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['user_auth', 'user_profiles'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'social_platform', 'mobile_app'],
    },
    {
      id: 'two_factor_auth',
      canonicalName: 'Two-Factor Authentication',
      category: 'auth',
      description: 'Add a second verification step (OTP via SMS/email or authenticator app) to protect user accounts.',
      aliases: ['2fa', 'mfa', 'two factor', 'multi factor auth', 'otp', 'authenticator app', 'sms verification'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 12,
      typicalHoursMax: 24,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['user_auth', 'sms_notifications'],
      commonProjectTypes: ['fintech_app', 'saas_platform', 'healthcare_app'],
    },
    {
      id: 'role_based_access_control',
      canonicalName: 'Role-Based Access Control',
      category: 'auth',
      description: 'Define what different user types (admin, manager, customer) can see and do within the system.',
      aliases: ['rbac', 'user roles', 'permissions', 'admin vs user', 'access levels', 'user groups', 'authorization'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 20,
      typicalHoursMax: 40,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['admin_panel', 'audit_trail'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'logistics_platform', 'dashboard_tool'],
    },
    {
      id: 'single_sign_on',
      canonicalName: 'Single Sign-On (SSO)',
      category: 'auth',
      description: 'Enterprise-grade login where employees use their corporate identity provider (Okta, Azure AD) to access the app.',
      aliases: ['sso', 'saml', 'enterprise login', 'okta', 'active directory', 'ldap', 'corporate login'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 24,
      typicalHoursMax: 48,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['role_based_access_control'],
      commonProjectTypes: ['saas_platform', 'dashboard_tool'],
    },
    {
      id: 'passwordless_auth',
      canonicalName: 'Passwordless Authentication',
      category: 'auth',
      description: 'Login via a magic link sent to email or a passkey — no password required.',
      aliases: ['magic link', 'email link login', 'passkey', 'webauthn', 'no password'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 12,
      typicalHoursMax: 24,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['user_auth', 'email_notifications'],
      commonProjectTypes: ['saas_platform', 'mobile_app'],
    },

    // ── PAYMENTS ──────────────────────────────────────────────────────────────
    {
      id: 'payment_processing',
      canonicalName: 'Payment Processing',
      category: 'payments',
      description: 'Accept card and digital wallet payments online via Stripe, Braintree, or similar gateway.',
      aliases: ['stripe', 'payments', 'pay online', 'checkout', 'credit card', 'card payments', 'accept payments', 'online payments'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 24,
      typicalHoursMax: 48,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['invoice_generation', 'subscription_billing', 'order_management'],
      commonProjectTypes: ['ecommerce_store', 'marketplace', 'delivery_app', 'booking_platform', 'saas_platform'],
    },
    {
      id: 'subscription_billing',
      canonicalName: 'Subscription Billing',
      category: 'payments',
      description: 'Charge customers on a recurring basis (monthly/annual) with plan management and automatic renewal.',
      aliases: ['subscriptions', 'recurring billing', 'monthly plan', 'saas billing', 'stripe subscriptions', 'billing plans', 'recurring payments'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 32,
      typicalHoursMax: 64,
      dependencies: ['payment_processing'],
      incompatibleWith: [],
      relatedFeatures: ['subscription_management', 'invoice_generation'],
      commonProjectTypes: ['saas_platform', 'content_platform', 'education_platform'],
    },
    {
      id: 'invoice_generation',
      canonicalName: 'Invoice Generation',
      category: 'payments',
      description: 'Automatically generate and send PDF invoices or receipts to customers after transactions.',
      aliases: ['invoices', 'pdf invoices', 'billing history', 'receipts', 'invoice download'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 20,
      dependencies: ['payment_processing'],
      incompatibleWith: [],
      relatedFeatures: ['payment_processing', 'order_management', 'reporting_system'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'logistics_platform'],
    },
    {
      id: 'escrow_payments',
      canonicalName: 'Escrow / Held Payments',
      category: 'payments',
      description: 'Hold funds securely until a condition is met (job completed, item delivered) then release to the recipient.',
      aliases: ['escrow', 'hold funds', 'release payment', 'milestone payment', 'secure payment hold'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 40,
      typicalHoursMax: 80,
      dependencies: ['payment_processing'],
      incompatibleWith: [],
      relatedFeatures: ['commission_management', 'dispute_resolution'],
      commonProjectTypes: ['marketplace', 'service_marketplace', 'real_estate_platform'],
    },
    {
      id: 'multi_currency',
      canonicalName: 'Multi-Currency Support',
      category: 'payments',
      description: 'Accept and display prices in multiple currencies with automatic conversion and localised formatting.',
      aliases: ['multiple currencies', 'international payments', 'currency conversion', 'usd eur gbp', 'global payments'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: ['payment_processing'],
      incompatibleWith: [],
      relatedFeatures: ['payment_processing'],
      commonProjectTypes: ['marketplace', 'saas_platform', 'ecommerce_store'],
    },
    {
      id: 'commission_management',
      canonicalName: 'Commission / Revenue Split',
      category: 'payments',
      description: 'Automatically split payments between the platform and vendors or service providers at a configured rate.',
      aliases: ['platform fee', 'take rate', 'commission', 'revenue share', 'vendor payout', 'split payment'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 32,
      typicalHoursMax: 60,
      dependencies: ['payment_processing', 'escrow_payments'],
      incompatibleWith: [],
      relatedFeatures: ['vendor_dashboard', 'reporting_system'],
      commonProjectTypes: ['marketplace', 'service_marketplace', 'delivery_app'],
    },

    // ── TRACKING ──────────────────────────────────────────────────────────────
    {
      id: 'realtime_delivery_tracking',
      canonicalName: 'Real-time Delivery Tracking',
      category: 'tracking',
      description: 'Track moving delivery agents or orders in real time on a map with live location updates pushed to the customer.',
      aliases: ['live tracking', 'gps tracking', 'track driver', 'delivery tracking', 'order tracking', 'track my order', 'live location', 'driver location'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 40,
      typicalHoursMax: 80,
      dependencies: ['maps_integration', 'websocket_realtime'],
      incompatibleWith: [],
      relatedFeatures: ['push_notifications', 'order_management', 'route_optimization'],
      commonProjectTypes: ['delivery_app', 'marketplace', 'logistics_platform'],
    },
    {
      id: 'order_status_tracking',
      canonicalName: 'Order Status Tracking',
      category: 'tracking',
      description: 'Let customers follow their order through discrete status stages: placed → confirmed → dispatched → delivered.',
      aliases: ['order status', 'track order', 'shipment tracking', 'delivery status', 'order updates', 'parcel tracking'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 20,
      dependencies: ['order_management'],
      incompatibleWith: [],
      relatedFeatures: ['push_notifications', 'email_notifications', 'order_management'],
      commonProjectTypes: ['ecommerce_store', 'delivery_app', 'marketplace'],
    },
    {
      id: 'asset_tracking',
      canonicalName: 'Asset / Fleet Tracking',
      category: 'tracking',
      description: 'Monitor real-time location and status of physical assets, vehicles, or equipment across a fleet.',
      aliases: ['fleet tracking', 'vehicle tracking', 'asset management', 'equipment tracking', 'iot tracking', 'telematics'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 60,
      typicalHoursMax: 120,
      dependencies: ['maps_integration', 'websocket_realtime'],
      incompatibleWith: [],
      relatedFeatures: ['analytics_dashboard', 'push_notifications', 'route_optimization'],
      commonProjectTypes: ['logistics_platform', 'delivery_app'],
    },

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    {
      id: 'push_notifications',
      canonicalName: 'Push Notifications',
      category: 'notifications',
      description: 'Send alerts directly to a user\'s mobile device even when the app is closed, via FCM or APNs.',
      aliases: ['push notifications', 'mobile alerts', 'app notifications', 'fcm', 'apns', 'mobile push'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['in_app_notifications', 'email_notifications'],
      commonProjectTypes: ['delivery_app', 'marketplace', 'social_platform', 'booking_platform', 'mobile_app'],
    },
    {
      id: 'email_notifications',
      canonicalName: 'Email Notifications',
      category: 'notifications',
      description: 'Send automated transactional emails — confirmations, receipts, alerts, and onboarding sequences.',
      aliases: ['email alerts', 'transactional email', 'sendgrid', 'mailgun', 'email system', 'automated emails'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 20,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['push_notifications', 'in_app_notifications'],
      commonProjectTypes: ['saas_platform', 'ecommerce_store', 'marketplace', 'booking_platform'],
    },
    {
      id: 'sms_notifications',
      canonicalName: 'SMS Notifications',
      category: 'notifications',
      description: 'Send automated text messages for time-sensitive alerts — order updates, OTPs, appointment reminders.',
      aliases: ['sms', 'text message', 'twilio', 'sms alerts', 'text alerts', 'whatsapp notifications'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 16,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['push_notifications', 'email_notifications'],
      commonProjectTypes: ['delivery_app', 'booking_platform', 'marketplace'],
    },
    {
      id: 'in_app_notifications',
      canonicalName: 'In-App Notification Center',
      category: 'notifications',
      description: 'A bell icon with a notification feed inside the app showing recent alerts with unread count badge.',
      aliases: ['notification bell', 'notification center', 'in-app alerts', 'notification feed', 'unread count'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 12,
      typicalHoursMax: 24,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['push_notifications', 'activity_feed'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'social_platform', 'collaboration_tool'],
    },

    // ── DASHBOARD & ADMIN ─────────────────────────────────────────────────────
    {
      id: 'analytics_dashboard',
      canonicalName: 'Analytics Dashboard',
      category: 'dashboard',
      description: 'Visual charts and metrics giving users or admins insight into activity, revenue, and platform performance.',
      aliases: ['dashboard', 'analytics', 'charts', 'graphs', 'metrics', 'reports', 'kpi dashboard', 'data dashboard'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 24,
      typicalHoursMax: 60,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['reporting_system', 'admin_panel'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'logistics_platform', 'dashboard_tool'],
    },
    {
      id: 'admin_panel',
      canonicalName: 'Admin Panel',
      category: 'dashboard',
      description: 'A secure back-office interface for administrators to manage users, content, orders, and system settings.',
      aliases: ['admin dashboard', 'admin portal', 'management console', 'back office', 'admin area', 'control panel'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 32,
      typicalHoursMax: 60,
      dependencies: ['role_based_access_control'],
      incompatibleWith: [],
      relatedFeatures: ['audit_trail', 'analytics_dashboard', 'user_profiles'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'ecommerce_store', 'delivery_app'],
    },
    {
      id: 'vendor_dashboard',
      canonicalName: 'Vendor / Seller Dashboard',
      category: 'dashboard',
      description: 'A dedicated portal for sellers or service providers to manage their listings, orders, and earnings.',
      aliases: ['vendor portal', 'seller dashboard', 'partner dashboard', 'restaurant dashboard', 'store dashboard'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 24,
      typicalHoursMax: 48,
      dependencies: ['role_based_access_control'],
      incompatibleWith: [],
      relatedFeatures: ['analytics_dashboard', 'commission_management', 'order_management'],
      commonProjectTypes: ['marketplace', 'service_marketplace', 'delivery_app'],
    },
    {
      id: 'reporting_system',
      canonicalName: 'Reporting & Exports',
      category: 'dashboard',
      description: 'Generate, filter, and export structured reports (CSV, PDF) on business activity and KPIs.',
      aliases: ['reports', 'export data', 'csv export', 'pdf reports', 'financial reports', 'download reports'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 40,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['analytics_dashboard', 'bulk_import_export'],
      commonProjectTypes: ['saas_platform', 'logistics_platform', 'dashboard_tool', 'fintech_app'],
    },

    // ── BOOKING ───────────────────────────────────────────────────────────────
    {
      id: 'booking_system',
      canonicalName: 'Booking / Reservation System',
      category: 'booking',
      description: 'Allow users to select a time slot and reserve a service, appointment, or resource with confirmation.',
      aliases: ['booking', 'reservations', 'appointments', 'schedule', 'book a slot', 'time slots', 'booking flow'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 40,
      typicalHoursMax: 80,
      dependencies: ['user_auth', 'calendar_integration'],
      incompatibleWith: [],
      relatedFeatures: ['availability_management', 'appointment_reminders', 'payment_processing'],
      commonProjectTypes: ['booking_platform', 'service_marketplace', 'healthcare_app', 'education_platform'],
    },
    {
      id: 'calendar_integration',
      canonicalName: 'Calendar Integration',
      category: 'booking',
      description: 'Sync bookings with Google Calendar, Outlook, or iCal so events appear in the user\'s personal calendar.',
      aliases: ['google calendar', 'calendar sync', 'ical', 'outlook calendar', 'calendar events', 'add to calendar'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['booking_system', 'appointment_reminders'],
      commonProjectTypes: ['booking_platform', 'saas_platform', 'collaboration_tool'],
    },
    {
      id: 'availability_management',
      canonicalName: 'Availability Management',
      category: 'booking',
      description: 'Let service providers configure their working hours, block out dates, and manage booking capacity.',
      aliases: ['availability', 'working hours', 'schedule management', 'time availability', 'open slots', 'busy times'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 20,
      typicalHoursMax: 40,
      dependencies: ['booking_system'],
      incompatibleWith: [],
      relatedFeatures: ['booking_system', 'calendar_integration'],
      commonProjectTypes: ['booking_platform', 'service_marketplace', 'healthcare_app'],
    },
    {
      id: 'appointment_reminders',
      canonicalName: 'Appointment Reminders',
      category: 'booking',
      description: 'Automatically notify attendees before a scheduled appointment via email, SMS, or push notification.',
      aliases: ['reminders', 'booking reminders', 'appointment alerts', 'confirmation emails', 'reminder notifications'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 16,
      dependencies: ['booking_system', 'email_notifications'],
      incompatibleWith: [],
      relatedFeatures: ['sms_notifications', 'push_notifications'],
      commonProjectTypes: ['booking_platform', 'healthcare_app', 'service_marketplace'],
    },

    // ── MESSAGING ─────────────────────────────────────────────────────────────
    {
      id: 'in_app_messaging',
      canonicalName: 'In-App Messaging (1-to-1)',
      category: 'messaging',
      description: 'Private real-time direct messaging between users inside the platform.',
      aliases: ['chat', 'direct message', 'dm', 'messaging', 'inbox', 'private messages', 'user to user chat'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 40,
      typicalHoursMax: 80,
      dependencies: ['user_auth', 'websocket_realtime'],
      incompatibleWith: [],
      relatedFeatures: ['push_notifications', 'presence_indicators'],
      commonProjectTypes: ['marketplace', 'service_marketplace', 'social_platform'],
    },
    {
      id: 'group_messaging',
      canonicalName: 'Group Messaging / Channels',
      category: 'messaging',
      description: 'Chat rooms or channels where multiple users can communicate and share files together.',
      aliases: ['group chat', 'channels', 'slack-like', 'team chat', 'group conversation', 'chat rooms'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 48,
      typicalHoursMax: 100,
      dependencies: ['in_app_messaging'],
      incompatibleWith: [],
      relatedFeatures: ['presence_indicators', 'file_upload'],
      commonProjectTypes: ['collaboration_tool', 'social_platform', 'education_platform'],
    },
    {
      id: 'live_chat_support',
      canonicalName: 'Live Chat Support Widget',
      category: 'messaging',
      description: 'A customer support widget where visitors can chat with a support agent in real time.',
      aliases: ['live chat', 'support chat', 'customer chat', 'intercom', 'chat widget', 'help chat'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 40,
      dependencies: ['websocket_realtime'],
      incompatibleWith: [],
      relatedFeatures: ['in_app_notifications', 'admin_panel'],
      commonProjectTypes: ['saas_platform', 'ecommerce_store', 'marketplace'],
    },

    // ── MAPS & LOCATION ───────────────────────────────────────────────────────
    {
      id: 'maps_integration',
      canonicalName: 'Maps Integration',
      category: 'maps',
      description: 'Embed an interactive map (Google Maps, Mapbox) to display locations, routes, or geographic data.',
      aliases: ['google maps', 'map view', 'mapbox', 'maps', 'interactive map', 'map display', 'location map'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['geolocation_services', 'address_autocomplete', 'realtime_delivery_tracking'],
      commonProjectTypes: ['delivery_app', 'marketplace', 'real_estate_platform', 'logistics_platform'],
    },
    {
      id: 'geolocation_services',
      canonicalName: 'Geolocation / User Location',
      category: 'maps',
      description: 'Detect the user\'s current GPS location to power nearby search, delivery radius, or location-aware features.',
      aliases: ['user location', 'detect location', 'gps', 'nearby search', 'location detection', 'find me'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 16,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['maps_integration', 'address_autocomplete'],
      commonProjectTypes: ['delivery_app', 'marketplace', 'social_platform', 'mobile_app'],
    },
    {
      id: 'route_optimization',
      canonicalName: 'Route Optimization',
      category: 'maps',
      description: 'Calculate the most efficient delivery route across multiple stops to minimise time and distance.',
      aliases: ['route planning', 'optimal route', 'delivery route', 'navigation', 'directions api', 'multi-stop routing'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 32,
      typicalHoursMax: 80,
      dependencies: ['maps_integration'],
      incompatibleWith: [],
      relatedFeatures: ['realtime_delivery_tracking', 'asset_tracking'],
      commonProjectTypes: ['delivery_app', 'logistics_platform'],
    },
    {
      id: 'address_autocomplete',
      canonicalName: 'Address Autocomplete',
      category: 'maps',
      description: 'As the user types an address, suggest completions using Google Places API or similar.',
      aliases: ['address search', 'places api', 'address input', 'location search', 'postcode lookup', 'address finder'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 4,
      typicalHoursMax: 12,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['maps_integration', 'geolocation_services'],
      commonProjectTypes: ['delivery_app', 'ecommerce_store', 'booking_platform', 'real_estate_platform'],
    },

    // ── MEDIA & FILE STORAGE ──────────────────────────────────────────────────
    {
      id: 'file_upload',
      canonicalName: 'File Upload & Storage',
      category: 'media',
      description: 'Allow users to upload files (images, documents, PDFs) to cloud storage such as S3 or Cloudflare R2.',
      aliases: ['file upload', 'image upload', 'upload files', 'cloud storage', 's3', 'attachments', 'document upload'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 20,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['image_optimization', 'document_management'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'collaboration_tool', 'healthcare_app'],
    },
    {
      id: 'image_optimization',
      canonicalName: 'Image Optimization / CDN',
      category: 'media',
      description: 'Automatically resize, compress, and serve images from a CDN for fast loading across all devices.',
      aliases: ['image resizing', 'image compression', 'cdn images', 'cloudinary', 'image delivery', 'lazy load images'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 16,
      dependencies: ['file_upload'],
      incompatibleWith: [],
      relatedFeatures: ['file_upload'],
      commonProjectTypes: ['ecommerce_store', 'marketplace', 'social_platform', 'content_platform'],
    },
    {
      id: 'video_streaming',
      canonicalName: 'Video Upload & Streaming',
      category: 'media',
      description: 'Upload, transcode, and stream video content on-demand via HLS or similar protocol.',
      aliases: ['video upload', 'video streaming', 'video content', 'video player', 'vod', 'hls streaming'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 40,
      typicalHoursMax: 80,
      dependencies: ['file_upload'],
      incompatibleWith: [],
      relatedFeatures: ['file_upload', 'analytics_dashboard'],
      commonProjectTypes: ['education_platform', 'content_platform', 'social_platform'],
    },

    // ── SEARCH ────────────────────────────────────────────────────────────────
    {
      id: 'full_text_search',
      canonicalName: 'Full-Text Search',
      category: 'search',
      description: 'Search across content, products, or users using Elasticsearch, Algolia, or Postgres full-text indexing.',
      aliases: ['search', 'full text search', 'elasticsearch', 'algolia', 'search functionality', 'search bar'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 40,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['filters_and_facets', 'product_catalog'],
      commonProjectTypes: ['ecommerce_store', 'marketplace', 'saas_platform', 'content_platform'],
    },
    {
      id: 'filters_and_facets',
      canonicalName: 'Filters & Faceted Search',
      category: 'search',
      description: 'Let users narrow search results by category, price range, location, rating, and other dynamic attributes.',
      aliases: ['filters', 'filter by', 'facets', 'advanced search', 'sort and filter', 'search filters'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: ['full_text_search'],
      incompatibleWith: [],
      relatedFeatures: ['full_text_search', 'product_catalog'],
      commonProjectTypes: ['ecommerce_store', 'marketplace', 'real_estate_platform'],
    },

    // ── ECOMMERCE ─────────────────────────────────────────────────────────────
    {
      id: 'product_catalog',
      canonicalName: 'Product / Listing Catalog',
      category: 'ecommerce',
      description: 'A structured listing of products or services with descriptions, images, pricing, and categories.',
      aliases: ['product listing', 'catalog', 'menu', 'service listing', 'item catalog', 'product page', 'store catalog'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 24,
      typicalHoursMax: 48,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['shopping_cart', 'inventory_management', 'full_text_search'],
      commonProjectTypes: ['ecommerce_store', 'marketplace', 'delivery_app'],
    },
    {
      id: 'shopping_cart',
      canonicalName: 'Shopping Cart',
      category: 'ecommerce',
      description: 'Allow users to collect items before checkout, with quantity adjustment and subtotal calculation.',
      aliases: ['cart', 'basket', 'add to cart', 'shopping bag', 'order cart'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: ['product_catalog'],
      incompatibleWith: [],
      relatedFeatures: ['payment_processing', 'discount_and_promo'],
      commonProjectTypes: ['ecommerce_store', 'marketplace', 'delivery_app'],
    },
    {
      id: 'order_management',
      canonicalName: 'Order Management',
      category: 'ecommerce',
      description: 'Create, track, update, and fulfil orders — including status management, history, and cancellations.',
      aliases: ['orders', 'order history', 'manage orders', 'order fulfilment', 'order processing', 'order list'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 24,
      typicalHoursMax: 48,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['order_status_tracking', 'invoice_generation', 'push_notifications'],
      commonProjectTypes: ['ecommerce_store', 'delivery_app', 'marketplace', 'logistics_platform'],
    },
    {
      id: 'inventory_management',
      canonicalName: 'Inventory Management',
      category: 'ecommerce',
      description: 'Track stock levels in real time, receive low-stock alerts, and prevent overselling.',
      aliases: ['stock management', 'inventory', 'stock levels', 'track stock', 'out of stock', 'warehouse management'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 32,
      typicalHoursMax: 64,
      dependencies: ['product_catalog'],
      incompatibleWith: [],
      relatedFeatures: ['order_management', 'reporting_system'],
      commonProjectTypes: ['ecommerce_store', 'marketplace', 'logistics_platform'],
    },
    {
      id: 'discount_and_promo',
      canonicalName: 'Discounts & Promo Codes',
      category: 'ecommerce',
      description: 'Create and apply promo codes, percentage discounts, or limited-time offers at checkout.',
      aliases: ['promo codes', 'discount codes', 'coupons', 'vouchers', 'special offers', 'promotional pricing'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 20,
      dependencies: ['payment_processing'],
      incompatibleWith: [],
      relatedFeatures: ['payment_processing', 'shopping_cart'],
      commonProjectTypes: ['ecommerce_store', 'marketplace', 'delivery_app'],
    },

    // ── SOCIAL & COMMUNITY ────────────────────────────────────────────────────
    {
      id: 'user_profiles',
      canonicalName: 'User Profiles',
      category: 'social',
      description: 'Public or private profile pages where users display their information, activity, and preferences.',
      aliases: ['profile page', 'user profile', 'profile editing', 'bio', 'avatar', 'profile photo', 'public profile'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 8,
      typicalHoursMax: 20,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['ratings_and_reviews', 'activity_feed'],
      commonProjectTypes: ['social_platform', 'marketplace', 'service_marketplace'],
    },
    {
      id: 'ratings_and_reviews',
      canonicalName: 'Ratings & Reviews',
      category: 'social',
      description: 'Let users rate and review products, services, or other users with star scores and text feedback.',
      aliases: ['reviews', 'ratings', 'star rating', 'user reviews', 'product reviews', 'feedback', 'testimonials'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['user_profiles', 'order_management'],
      commonProjectTypes: ['marketplace', 'delivery_app', 'service_marketplace', 'booking_platform'],
    },
    {
      id: 'activity_feed',
      canonicalName: 'Activity Feed / Timeline',
      category: 'social',
      description: 'A chronological or ranked feed of user actions, posts, or events visible to the community.',
      aliases: ['feed', 'news feed', 'activity stream', 'timeline', 'social feed', 'updates feed'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 32,
      typicalHoursMax: 64,
      dependencies: ['user_auth'],
      incompatibleWith: [],
      relatedFeatures: ['push_notifications', 'in_app_notifications', 'user_profiles'],
      commonProjectTypes: ['social_platform', 'collaboration_tool', 'marketplace'],
    },

    // ── REALTIME ──────────────────────────────────────────────────────────────
    {
      id: 'websocket_realtime',
      canonicalName: 'WebSocket / Real-time Updates',
      category: 'realtime',
      description: 'Persistent two-way connection enabling instant server-to-client data push without polling.',
      aliases: ['realtime', 'websockets', 'live updates', 'real-time', 'socket.io', 'live data', 'instant updates'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 24,
      typicalHoursMax: 48,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['in_app_messaging', 'realtime_delivery_tracking', 'presence_indicators'],
      commonProjectTypes: ['delivery_app', 'collaboration_tool', 'saas_platform', 'social_platform'],
    },
    {
      id: 'live_collaboration',
      canonicalName: 'Live Collaboration',
      category: 'realtime',
      description: 'Multiple users can edit or interact with the same document, board, or workspace simultaneously.',
      aliases: ['collaborative editing', 'multiplayer', 'real-time collaboration', 'shared editing', 'google docs style'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 60,
      typicalHoursMax: 120,
      dependencies: ['websocket_realtime'],
      incompatibleWith: [],
      relatedFeatures: ['presence_indicators', 'in_app_messaging'],
      commonProjectTypes: ['collaboration_tool', 'saas_platform', 'education_platform'],
    },
    {
      id: 'presence_indicators',
      canonicalName: 'Presence / Online Status',
      category: 'realtime',
      description: 'Show which users are currently online, actively viewing, or typing in real time.',
      aliases: ['online status', 'who is online', 'presence', 'typing indicator', 'last seen', 'active users'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 12,
      typicalHoursMax: 24,
      dependencies: ['websocket_realtime'],
      incompatibleWith: [],
      relatedFeatures: ['in_app_messaging', 'live_collaboration'],
      commonProjectTypes: ['collaboration_tool', 'social_platform', 'saas_platform'],
    },

    // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
    {
      id: 'subscription_management',
      canonicalName: 'Subscription Plan Management',
      category: 'subscriptions',
      description: 'Manage pricing tiers, upgrades, downgrades, free trials, and cancellations for subscription products.',
      aliases: ['pricing plans', 'plan tiers', 'upgrade downgrade', 'free trial', 'plan management', 'membership plans'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 32,
      typicalHoursMax: 64,
      dependencies: ['subscription_billing'],
      incompatibleWith: [],
      relatedFeatures: ['subscription_billing', 'analytics_dashboard', 'email_notifications'],
      commonProjectTypes: ['saas_platform', 'content_platform', 'education_platform'],
    },
    {
      id: 'usage_based_billing',
      canonicalName: 'Usage-Based Billing',
      category: 'subscriptions',
      description: 'Meter usage (API calls, storage, seats) and charge accordingly — pay-as-you-go model.',
      aliases: ['metered billing', 'pay per use', 'usage billing', 'consumption billing', 'credits system'],
      typicalComplexity: 'HIGH',
      typicalHoursMin: 40,
      typicalHoursMax: 80,
      dependencies: ['subscription_billing'],
      incompatibleWith: [],
      relatedFeatures: ['analytics_dashboard', 'reporting_system'],
      commonProjectTypes: ['saas_platform', 'fintech_app'],
    },

    // ── API & INTEGRATIONS ────────────────────────────────────────────────────
    {
      id: 'rest_api',
      canonicalName: 'REST API',
      category: 'api',
      description: 'Public or private HTTP API allowing programmatic access to platform data and actions.',
      aliases: ['api', 'rest api', 'public api', 'api endpoints', 'backend api', 'json api'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 40,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['webhooks', 'third_party_integration'],
      commonProjectTypes: ['saas_platform', 'logistics_platform', 'dashboard_tool'],
    },
    {
      id: 'webhooks',
      canonicalName: 'Webhooks',
      category: 'api',
      description: 'Send automated HTTP callbacks to external systems when specific events occur on the platform.',
      aliases: ['webhooks', 'event callbacks', 'http callbacks', 'outbound webhooks', 'event notifications'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 12,
      typicalHoursMax: 24,
      dependencies: ['rest_api'],
      incompatibleWith: [],
      relatedFeatures: ['rest_api', 'third_party_integration'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'logistics_platform'],
    },
    {
      id: 'third_party_integration',
      canonicalName: 'Third-Party API Integration',
      category: 'api',
      description: 'Connect to external services (CRM, ERP, accounting, marketing tools) via their APIs.',
      aliases: ['api integration', 'crm integration', 'erp integration', 'zapier', 'external api', 'third party'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 48,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['rest_api', 'webhooks'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'logistics_platform'],
    },

    // ── DATA ──────────────────────────────────────────────────────────────────
    {
      id: 'bulk_import_export',
      canonicalName: 'Bulk Import / Export',
      category: 'data',
      description: 'Allow users to import data from CSV/Excel files or export records in bulk for offline processing.',
      aliases: ['csv import', 'excel import', 'bulk upload', 'data import', 'export csv', 'batch import'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 16,
      typicalHoursMax: 32,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['reporting_system', 'admin_panel'],
      commonProjectTypes: ['saas_platform', 'logistics_platform', 'dashboard_tool'],
    },

    // ── COMPLIANCE ────────────────────────────────────────────────────────────
    {
      id: 'gdpr_compliance',
      canonicalName: 'GDPR Compliance',
      category: 'compliance',
      description: 'Tools for data privacy compliance — cookie consent, data export on request, and right-to-erasure workflows.',
      aliases: ['gdpr', 'data privacy', 'cookie consent', 'right to be forgotten', 'data deletion', 'privacy policy'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 20,
      typicalHoursMax: 40,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['audit_trail', 'user_profiles'],
      commonProjectTypes: ['saas_platform', 'healthcare_app', 'fintech_app', 'marketplace'],
    },
    {
      id: 'audit_trail',
      canonicalName: 'Audit Trail / Activity Log',
      category: 'compliance',
      description: 'Immutable log of all significant user and system actions for compliance auditing and debugging.',
      aliases: ['audit log', 'activity log', 'action history', 'audit trail', 'change log', 'event log'],
      typicalComplexity: 'MEDIUM',
      typicalHoursMin: 12,
      typicalHoursMax: 24,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['admin_panel', 'role_based_access_control'],
      commonProjectTypes: ['fintech_app', 'healthcare_app', 'saas_platform', 'logistics_platform'],
    },

    // ── MONITORING ────────────────────────────────────────────────────────────
    {
      id: 'error_tracking',
      canonicalName: 'Error Tracking & Monitoring',
      category: 'monitoring',
      description: 'Capture, group, and alert on application errors and crashes in production (Sentry, Datadog).',
      aliases: ['sentry', 'error monitoring', 'crash reporting', 'bug tracking', 'application monitoring', 'alerting'],
      typicalComplexity: 'LOW',
      typicalHoursMin: 4,
      typicalHoursMax: 8,
      dependencies: [],
      incompatibleWith: [],
      relatedFeatures: ['analytics_dashboard'],
      commonProjectTypes: ['saas_platform', 'marketplace', 'delivery_app', 'fintech_app'],
    },
  ]

  // ── Seed script ─────────────────────────────────────────────────────────────

  async function seed() {
    console.log(`Seeding ${ONTOLOGY_SEED.length} canonical features...`)

    let inserted = 0
    let skipped = 0

    for (const entry of ONTOLOGY_SEED) {
      await prisma.featureOntology.upsert({
        where: { id: entry.id },
        update: {
          canonicalName: entry.canonicalName,
          category: entry.category,
          aliases: entry.aliases,
          typicalComplexity: entry.typicalComplexity ?? null,
          typicalHoursMin: entry.typicalHoursMin ?? null,
          typicalHoursMax: entry.typicalHoursMax ?? null,
          dependencies: entry.dependencies,
          incompatibleWith: entry.incompatibleWith,
        },
        create: {
          id: entry.id,
          canonicalName: entry.canonicalName,
          category: entry.category,
          aliases: entry.aliases,
          typicalComplexity: entry.typicalComplexity ?? null,
          typicalHoursMin: entry.typicalHoursMin ?? null,
          typicalHoursMax: entry.typicalHoursMax ?? null,
          dependencies: entry.dependencies,
          incompatibleWith: entry.incompatibleWith,
        },
      })
      inserted++
    }

    console.log(`✅ Seeded: ${inserted} features, skipped: ${skipped}`)
    await prisma.$disconnect()
  }

  seed().catch((e) => {
    console.error('Seed failed:', e)
    prisma.$disconnect()
    process.exit(1)
  })
  ```

- [ ] **Step 2: Run the seed script**

  > **You do this step.** From `dealghost/ai-service/`:
  ```bash
  npm run seed:ontology
  ```
  Expected:
  ```
  Seeding 68 canonical features...
  ✅ Seeded: 68 features, skipped: 0
  ```

- [ ] **Step 3: Verify via Prisma Studio**

  ```bash
  cd ..  # back to monorepo root
  npx prisma studio
  ```
  Open `feature_ontology` table. Expected: 68 rows.

- [ ] **Step 4: Commit**

  ```bash
  git add ai-service/src/ontology/seed-data.ts
  git commit -m "feat: add feature ontology seed data — 68 canonical features across 18 categories"
  ```

---

### Task 10: Feature mapper — ontology loader + prompt section builder

**Files:**
- Create: `dealghost/ai-service/src/ontology/feature-mapper.ts`
- Create: `dealghost/ai-service/src/ontology/feature-mapper.test.ts`

- [ ] **Step 1: Write failing test**

  Create `dealghost/ai-service/src/ontology/feature-mapper.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest'

  vi.mock('../db/prisma.js', () => ({
    prisma: {
      featureOntology: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'user_auth',
            canonicalName: 'User Authentication',
            category: 'auth',
            aliases: ['login', 'sign in', 'sign up'],
            typicalComplexity: 'MEDIUM',
            typicalHoursMin: 16,
            typicalHoursMax: 32,
            dependencies: [],
            incompatibleWith: [],
          },
          {
            id: 'payment_processing',
            canonicalName: 'Payment Processing',
            category: 'payments',
            aliases: ['stripe', 'payments', 'checkout'],
            typicalComplexity: 'MEDIUM',
            typicalHoursMin: 24,
            typicalHoursMax: 48,
            dependencies: ['user_auth'],
            incompatibleWith: [],
          },
        ]),
      },
    },
  }))

  describe('getOntologyPromptSection', () => {
    it('returns a non-empty string containing canonical IDs', async () => {
      const { getOntologyPromptSection } = await import('./feature-mapper.js')
      const result = await getOntologyPromptSection()
      expect(result).toContain('user_auth')
      expect(result).toContain('payment_processing')
    })

    it('includes aliases in the output', async () => {
      const { getOntologyPromptSection } = await import('./feature-mapper.js')
      const result = await getOntologyPromptSection()
      expect(result).toContain('login')
      expect(result).toContain('stripe')
    })

    it('accepts optional domain parameter without throwing', async () => {
      const { getOntologyPromptSection } = await import('./feature-mapper.js')
      await expect(getOntologyPromptSection('logistics')).resolves.toBeTruthy()
    })
  })
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  npm test -- src/ontology/feature-mapper.test.ts
  ```
  Expected: FAIL — `Cannot find module './feature-mapper.js'`

- [ ] **Step 3: Create `ontology/feature-mapper.ts`**

  Create `dealghost/ai-service/src/ontology/feature-mapper.ts`:
  ```typescript
  import { prisma } from '../db/prisma.js'
  import type { FeatureOntologyEntry } from '@dealghost/shared'

  /**
   * Load the feature ontology from DB and format it as a prompt section.
   *
   * @param domain - Optional domain hint (e.g. 'logistics', 'fintech').
   *   Currently unused — all features are returned regardless of domain.
   *   Architecture is designed for future category filtering without changing
   *   the calling interface in l2-extraction.ts.
   */
  export async function getOntologyPromptSection(domain?: string): Promise<string> {
    // domain param reserved for future category-based filtering
    void domain

    const entries = await prisma.featureOntology.findMany({
      orderBy: { category: 'asc' },
    })

    return formatOntologyForPrompt(entries)
  }

  /**
   * Format ontology entries into the structured list injected into the L2 system prompt.
   * Kept as a separate exported function so it can be unit-tested without a DB.
   */
  export function formatOntologyForPrompt(entries: FeatureOntologyEntry[]): string {
    const byCategory = new Map<string, FeatureOntologyEntry[]>()

    for (const entry of entries) {
      const list = byCategory.get(entry.category) ?? []
      list.push(entry)
      byCategory.set(entry.category, list)
    }

    const lines: string[] = [
      '## CANONICAL FEATURE ONTOLOGY',
      'Map extracted features to these canonical IDs. Each entry shows: ID | Name | Description | Aliases | Complexity | Hours | related (optional)',
      '',
    ]

    for (const [category, features] of byCategory) {
      lines.push(`### ${category.toUpperCase()}`)
      for (const f of features) {
        const hours =
          f.typicalHoursMin && f.typicalHoursMax
            ? `${f.typicalHoursMin}–${f.typicalHoursMax}h`
            : 'varies'
        const desc = f.description ? ` | ${f.description}` : ''
        const deps = f.dependencies.length > 0 ? ` | requires: ${f.dependencies.join(', ')}` : ''
        const related = f.relatedFeatures.length > 0 ? ` | related: ${f.relatedFeatures.join(', ')}` : ''
        lines.push(
          `- ${f.id} | "${f.canonicalName}"${desc} | aliases: [${f.aliases.join(', ')}] | ${f.typicalComplexity ?? 'MEDIUM'} | ${hours}${deps}${related}`
        )
      }
      lines.push('')
    }

    return lines.join('\n')
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- src/ontology/feature-mapper.test.ts
  ```
  Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

  ```bash
  git add src/ontology/
  git commit -m "feat: add feature mapper — ontology loader with swappable domain filter interface"
  ```

---

### Task 11: L2 extraction — prompt + layer

**Files:**
- Create: `dealghost/ai-service/src/prompts/extraction.ts`
- Create: `dealghost/ai-service/src/pipeline/l2-extraction.ts`
- Create: `dealghost/ai-service/src/pipeline/l2-extraction.test.ts`

- [ ] **Step 1: Create `prompts/extraction.ts`**

  Create `dealghost/ai-service/src/prompts/extraction.ts`:
  ```typescript
  /**
   * Builds the L2 extraction system prompt.
   *
   * The ontology section is placed FIRST so Anthropic prompt caching caches it
   * after the first call per session (saves ~75% on those tokens on subsequent turns).
   */
  export function buildExtractionSystemPrompt(ontologySection: string): string {
    return `${ontologySection}
  ---

  You are the canonical requirement extraction engine for DEALGHOST, an AI pre-sales system for FlowZint software agency.

  ## YOUR ROLE
  Extract ALL software requirements from the client's latest message. Map every feature to a canonical ID from the ontology above.

  ## CONFIDENCE RULES — follow exactly
  - 0.95+  : client stated this explicitly, word-for-word or near-identical
  - 0.80-0.95 : strong semantic equivalence (different words, clearly the same concept)
  - 0.60-0.80 : reasonable inference from context (implied but not stated)
  - below 0.60 : uncertain — mark isConfirmed: false and add to assumptions[]

  ## MAPPING RULES
  1. For each feature/capability mentioned, find the closest canonical ID from the ontology
  2. If confidence >= 0.75 → use the existing canonical ID
  3. If confidence < 0.75 → create a new entry in newCanonicalEntries[] with a generated snake_case ID
  4. Set isConfirmed: true ONLY if the client explicitly said they want this
  5. Set isConfirmed: false for anything you inferred from context

  ## EXTRACTION RULES
  - Extract EVERY feature, integration, platform, constraint, user type, or business detail mentioned
  - Do not skip anything — it is better to over-extract than under-extract
  - If the client says "like Uber but for tutors" → extract: booking_system, user_auth, payment_processing, rating_system, geolocation_services, maps_integration
  - featuresToRemove: add canonical IDs here if the client is explicitly removing something previously mentioned
  - Extract tech preferences if the client mentions specific technologies they want or want to avoid
  - Extract workflows if the client describes how a business process works step by step

  ## OUTPUT FORMAT
  Return ONLY valid JSON. No explanation. No markdown fences. The JSON must match this exact shape:

  {
    "features": [{ "canonicalId": string, "rawText": string, "confidence": number, "category": string, "priority": "MUST"|"SHOULD"|"COULD", "isConfirmed": boolean, "dependencies": string[] }],
    "integrations": string[],
    "platforms": string[],
    "authRequirements": string | null,
    "realtimeRequirements": string | null,
    "adminPanelRequirements": string | null,
    "targetUsers": string | null,
    "userScale": string | null,
    "businessModel": "B2B"|"B2C"|"marketplace"|"internal" | null,
    "timelineExpectation": string | null,
    "budgetRange": { "min": number | null, "max": number | null, "currency": string } | null,
    "clientTechPreferences": { "frontend": string?, "backend": string?, "database": string?, "hosting": string?, "avoid": string[], "existingSystems": string[] } | null,
    "compliance": string[],
    "technicalConstraints": string | null,
    "workflows": [{ "name": string, "steps": string[], "actors": string[], "triggers": string[] }],
    "userRoles": [{ "name": string, "permissions": string[], "count": string? }],
    "featuresToRemove": string[],
    "assumptions": string[],
    "newCanonicalEntries": [{ "id": string, "canonicalName": string, "category": string, "aliases": string[] }]
  }`
  }

  export function buildExtractionUserPrompt(
    latestMessage: string,
    conversationHistory: string,
    currentStateCompact: string
  ): string {
    return `## CURRENT KNOWN STATE
  ${currentStateCompact}

  ## CONVERSATION SO FAR
  ${conversationHistory}

  ## LATEST CLIENT MESSAGE
  "${latestMessage}"

  Extract all requirements from the latest message. Focus on what is NEW or CHANGED vs. the current state.`
  }

  /**
   * Compact the state into a minimal string for the extraction prompt.
   * Only includes non-empty fields to keep tokens lean.
   */
  export function compactStateForPrompt(state: Record<string, unknown>): string {
    const compact: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(state)) {
      if (value === null || value === undefined) continue
      if (Array.isArray(value) && value.length === 0) continue
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) continue
      if (typeof value === 'number' && value === 0) continue
      // Skip internal pipeline fields
      if (['fieldConfidence', 'contradictions', 'ambiguities', 'discoveryTargets',
           'technicalRisks', 'missingInformation', 'conversationSummary'].includes(key)) continue
      compact[key] = value
    }
    return JSON.stringify(compact, null, 2)
  }
  ```

- [ ] **Step 2: Write failing test for L2 extraction layer**

  Create `dealghost/ai-service/src/pipeline/l2-extraction.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from 'vitest'

  const mockClaudeOutput = JSON.stringify({
    features: [
      {
        canonicalId: 'realtime_delivery_tracking',
        rawText: 'real-time GPS tracking for drivers',
        confidence: 0.95,
        category: 'tracking',
        priority: 'MUST',
        isConfirmed: true,
        dependencies: ['maps_integration', 'websocket_realtime'],
      },
      {
        canonicalId: 'payment_processing',
        rawText: 'Stripe payments',
        confidence: 0.97,
        category: 'payments',
        priority: 'MUST',
        isConfirmed: true,
        dependencies: ['user_auth'],
      },
    ],
    integrations: ['Stripe'],
    platforms: ['iOS', 'Android'],
    authRequirements: 'Email + Google login for customers, email only for drivers',
    realtimeRequirements: 'Live driver location updates every 5 seconds',
    adminPanelRequirements: null,
    targetUsers: 'Food delivery customers and delivery drivers',
    userScale: null,
    businessModel: 'marketplace',
    timelineExpectation: null,
    budgetRange: null,
    clientTechPreferences: null,
    compliance: [],
    technicalConstraints: null,
    workflows: [],
    userRoles: [
      { name: 'Customer', permissions: ['place orders', 'track delivery'], count: null },
      { name: 'Driver', permissions: ['accept orders', 'update location'], count: null },
    ],
    featuresToRemove: [],
    assumptions: ['Will need push notifications for order updates'],
    newCanonicalEntries: [],
  })

  vi.mock('../models/claude.js', () => ({
    callClaudeJSON: vi.fn().mockImplementation((_opts, parse) => Promise.resolve(parse(mockClaudeOutput))),
  }))

  vi.mock('../ontology/feature-mapper.js', () => ({
    getOntologyPromptSection: vi.fn().mockResolvedValue('## CANONICAL FEATURE ONTOLOGY\n(mocked)'),
  }))

  describe('runL2Extraction', () => {
    it('returns an ExtractionResult with correct feature canonical IDs', async () => {
      const { runL2Extraction } = await import('./l2-extraction.js')
      const result = await runL2Extraction({
        latestMessage: 'I need a food delivery app with real-time GPS tracking and Stripe payments',
        conversationHistory: '',
        currentState: {} as any,
      })
      expect(result.features).toHaveLength(2)
      expect(result.features[0].canonicalId).toBe('realtime_delivery_tracking')
      expect(result.features[1].canonicalId).toBe('payment_processing')
    })

    it('extracts platforms correctly', async () => {
      const { runL2Extraction } = await import('./l2-extraction.js')
      const result = await runL2Extraction({
        latestMessage: 'iOS and Android app',
        conversationHistory: '',
        currentState: {} as any,
      })
      expect(result.platforms).toContain('iOS')
      expect(result.platforms).toContain('Android')
    })

    it('correctly identifies confirmed vs inferred features', async () => {
      const { runL2Extraction } = await import('./l2-extraction.js')
      const result = await runL2Extraction({
        latestMessage: 'food delivery with GPS tracking',
        conversationHistory: '',
        currentState: {} as any,
      })
      const tracking = result.features.find(f => f.canonicalId === 'realtime_delivery_tracking')
      expect(tracking?.isConfirmed).toBe(true)
    })
  })
  ```

- [ ] **Step 3: Run test to confirm it fails**

  ```bash
  npm test -- src/pipeline/l2-extraction.test.ts
  ```
  Expected: FAIL — `Cannot find module './l2-extraction.js'`

- [ ] **Step 4: Create `pipeline/l2-extraction.ts`**

  Create `dealghost/ai-service/src/pipeline/l2-extraction.ts`:
  ```typescript
  import { z } from 'zod'
  import { callClaudeJSON } from '../models/claude.js'
  import { getOntologyPromptSection } from '../ontology/feature-mapper.js'
  import {
    buildExtractionSystemPrompt,
    buildExtractionUserPrompt,
    compactStateForPrompt,
  } from '../prompts/extraction.js'
  import type { ExtractionResult, ProjectRequirementState } from '@dealghost/shared'

  // ── Zod validation schema ────────────────────────────────────────────────────

  const FeatureSchema = z.object({
    canonicalId: z.string(),
    rawText: z.string(),
    confidence: z.number().min(0).max(1),
    category: z.string(),
    priority: z.enum(['MUST', 'SHOULD', 'COULD']),
    isConfirmed: z.boolean(),
    dependencies: z.array(z.string()).default([]),
  })

  const ExtractionResultSchema = z.object({
    features: z.array(FeatureSchema).default([]),
    integrations: z.array(z.string()).default([]),
    platforms: z.array(z.string()).default([]),
    authRequirements: z.string().nullable().default(null),
    realtimeRequirements: z.string().nullable().default(null),
    adminPanelRequirements: z.string().nullable().default(null),
    targetUsers: z.string().nullable().default(null),
    userScale: z.string().nullable().default(null),
    businessModel: z.enum(['B2B', 'B2C', 'marketplace', 'internal']).nullable().default(null),
    timelineExpectation: z.string().nullable().default(null),
    budgetRange: z
      .object({
        min: z.number().nullable(),
        max: z.number().nullable(),
        currency: z.string(),
      })
      .nullable()
      .default(null),
    clientTechPreferences: z
      .object({
        frontend: z.string().optional(),
        backend: z.string().optional(),
        database: z.string().optional(),
        hosting: z.string().optional(),
        avoid: z.array(z.string()).default([]),
        existingSystems: z.array(z.string()).default([]),
      })
      .nullable()
      .default(null),
    compliance: z.array(z.string()).default([]),
    technicalConstraints: z.string().nullable().default(null),
    workflows: z
      .array(
        z.object({
          name: z.string(),
          steps: z.array(z.string()),
          actors: z.array(z.string()),
          triggers: z.array(z.string()),
        })
      )
      .default([]),
    userRoles: z
      .array(
        z.object({
          name: z.string(),
          permissions: z.array(z.string()),
          count: z.string().optional(),
        })
      )
      .default([]),
    featuresToRemove: z.array(z.string()).default([]),
    assumptions: z.array(z.string()).default([]),
    newCanonicalEntries: z
      .array(
        z.object({
          id: z.string(),
          canonicalName: z.string(),
          category: z.string(),
          aliases: z.array(z.string()),
        })
      )
      .default([]),
  })

  // ── Layer function ───────────────────────────────────────────────────────────

  export interface L2Input {
    latestMessage: string
    conversationHistory: string
    currentState: ProjectRequirementState
  }

  export async function runL2Extraction(input: L2Input): Promise<ExtractionResult> {
    const ontologySection = await getOntologyPromptSection()

    const systemPrompt = buildExtractionSystemPrompt(ontologySection)
    const userPrompt = buildExtractionUserPrompt(
      input.latestMessage,
      input.conversationHistory,
      compactStateForPrompt(input.currentState as unknown as Record<string, unknown>)
    )

    const result = await callClaudeJSON(
      {
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 2500,
        temperature: 0.1, // low temperature for consistent structured output
        cacheSystemPrompt: true, // ontology section cached after first call
      },
      (raw) => ExtractionResultSchema.parse(JSON.parse(raw))
    )

    return result as ExtractionResult
  }
  ```

- [ ] **Step 5: Run tests to confirm they pass**

  ```bash
  npm test -- src/pipeline/l2-extraction.test.ts
  ```
  Expected: PASS — 3 tests passing

- [ ] **Step 6: Commit**

  ```bash
  git add src/prompts/extraction.ts src/pipeline/l2-extraction.ts src/pipeline/l2-extraction.test.ts
  git commit -m "feat: add L2 canonical extraction layer — Claude-based feature mapping with Zod validation"
  ```

---

### Task 12: L3 state engine — merge + completeness

**Files:**
- Create: `dealghost/ai-service/src/state/manager.ts`
- Create: `dealghost/ai-service/src/state/manager.test.ts`
- Create: `dealghost/ai-service/src/state/confidence.ts`

- [ ] **Step 1: Write failing tests for state manager**

  Create `dealghost/ai-service/src/state/manager.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { mergeExtractionIntoState, calculateCompleteness } from './manager.js'
  import { createEmptyState } from '@dealghost/shared'
  import type { ExtractionResult } from '@dealghost/shared'

  const emptyExtraction: ExtractionResult = {
    features: [],
    integrations: [],
    platforms: [],
    authRequirements: null,
    realtimeRequirements: null,
    adminPanelRequirements: null,
    targetUsers: null,
    userScale: null,
    businessModel: null,
    timelineExpectation: null,
    budgetRange: null,
    clientTechPreferences: null,
    compliance: [],
    technicalConstraints: null,
    workflows: [],
    userRoles: [],
    featuresToRemove: [],
    assumptions: [],
    newCanonicalEntries: [],
  }

  describe('calculateCompleteness', () => {
    it('returns 0 for a completely empty state', () => {
      const state = createEmptyState('conv-test')
      expect(calculateCompleteness(state)).toBe(0)
    })

    it('returns 100 when all weighted fields are filled', () => {
      const state = createEmptyState('conv-test')
      state.projectType = 'web_app'                           // +10
      state.description = 'A marketplace for handmade goods'  // +10
      state.platforms = ['web']                               // +8
      state.features = [{                                     // +20
        canonicalId: 'user_auth', rawText: 'login',
        confidence: 0.95, category: 'auth', priority: 'MUST',
        isConfirmed: true, dependencies: [],
      }]
      state.targetUsers = 'Independent sellers and buyers'    // +8
      state.authRequirements = 'Email + Google login'         // +6
      state.realtimeRequirements = 'Live chat between buyer/seller' // +6
      state.integrations = ['Stripe']                         // +6
      state.timelineExpectation = '4 months'                  // +8
      state.budgetRange = { min: 40000, max: 80000, currency: 'USD' } // +10
      state.userScale = '1000 users at launch'                // +4
      state.technicalConstraints = 'Must support mobile browsers' // +4
      expect(calculateCompleteness(state)).toBe(100)
    })

    it('returns partial score when only some fields are filled', () => {
      const state = createEmptyState('conv-test')
      state.projectType = 'mobile_app'   // +10
      state.platforms = ['iOS']           // +8
      expect(calculateCompleteness(state)).toBe(18)
    })
  })

  describe('mergeExtractionIntoState', () => {
    it('adds new features to state', () => {
      const state = createEmptyState('conv-test')
      const extraction: ExtractionResult = {
        ...emptyExtraction,
        features: [{
          canonicalId: 'payment_processing',
          rawText: 'Stripe payments',
          confidence: 0.97,
          category: 'payments',
          priority: 'MUST',
          isConfirmed: true,
          dependencies: [],
        }],
      }
      const result = mergeExtractionIntoState(state, extraction)
      expect(result.features).toHaveLength(1)
      expect(result.features[0].canonicalId).toBe('payment_processing')
    })

    it('deduplicates features by canonicalId, keeping higher confidence', () => {
      const state = createEmptyState('conv-test')
      state.features = [{
        canonicalId: 'user_auth',
        rawText: 'login',
        confidence: 0.75,
        category: 'auth',
        priority: 'MUST',
        isConfirmed: false,
        dependencies: [],
      }]
      const extraction: ExtractionResult = {
        ...emptyExtraction,
        features: [{
          canonicalId: 'user_auth',
          rawText: 'authentication system',
          confidence: 0.95, // higher confidence
          category: 'auth',
          priority: 'MUST',
          isConfirmed: true,
          dependencies: [],
        }],
      }
      const result = mergeExtractionIntoState(state, extraction)
      expect(result.features).toHaveLength(1)
      expect(result.features[0].confidence).toBe(0.95)
      expect(result.features[0].isConfirmed).toBe(true)
    })

    it('removes features listed in featuresToRemove', () => {
      const state = createEmptyState('conv-test')
      state.features = [
        { canonicalId: 'user_auth', rawText: 'login', confidence: 0.95, category: 'auth', priority: 'MUST', isConfirmed: true, dependencies: [] },
        { canonicalId: 'payment_processing', rawText: 'payments', confidence: 0.90, category: 'payments', priority: 'MUST', isConfirmed: true, dependencies: [] },
      ]
      const extraction: ExtractionResult = {
        ...emptyExtraction,
        featuresToRemove: ['payment_processing'],
      }
      const result = mergeExtractionIntoState(state, extraction)
      expect(result.features).toHaveLength(1)
      expect(result.features[0].canonicalId).toBe('user_auth')
    })

    it('deduplicates platforms and integrations', () => {
      const state = createEmptyState('conv-test')
      state.platforms = ['iOS']
      state.integrations = ['Stripe']
      const extraction: ExtractionResult = {
        ...emptyExtraction,
        platforms: ['iOS', 'Android'],  // iOS already exists
        integrations: ['Stripe', 'Twilio'], // Stripe already exists
      }
      const result = mergeExtractionIntoState(state, extraction)
      expect(result.platforms).toEqual(['iOS', 'Android'])
      expect(result.integrations).toEqual(['Stripe', 'Twilio'])
    })

    it('updates completenessScore after merge', () => {
      const state = createEmptyState('conv-test')
      const extraction: ExtractionResult = {
        ...emptyExtraction,
        platforms: ['web'],
        features: [{
          canonicalId: 'user_auth', rawText: 'login', confidence: 0.9,
          category: 'auth', priority: 'MUST', isConfirmed: true, dependencies: [],
        }],
      }
      const result = mergeExtractionIntoState(state, extraction)
      expect(result.completenessScore).toBeGreaterThan(0)
    })

    it('moves new assumptions into state.assumptions without duplicates', () => {
      const state = createEmptyState('conv-test')
      state.assumptions = ['Will need push notifications']
      const extraction: ExtractionResult = {
        ...emptyExtraction,
        assumptions: ['Will need push notifications', 'Likely needs admin panel'],
      }
      const result = mergeExtractionIntoState(state, extraction)
      expect(result.assumptions).toHaveLength(2)
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- src/state/manager.test.ts
  ```
  Expected: FAIL — `Cannot find module './manager.js'`

- [ ] **Step 3: Create `state/confidence.ts`**

  Create `dealghost/ai-service/src/state/confidence.ts`:
  ```typescript
  import type { ProjectRequirementState, ExtractionResult } from '@dealghost/shared'

  /**
   * Update fieldConfidence in state based on what was just extracted.
   * Fields with confirmed extractions get a confidence boost.
   * Fields that were previously inferred and now explicitly confirmed get set to 0.95+.
   */
  export function updateFieldConfidence(
    current: Record<string, number>,
    extraction: ExtractionResult
  ): Record<string, number> {
    const updated = { ...current }

    if (extraction.targetUsers) updated['targetUsers'] = Math.max(updated['targetUsers'] ?? 0, 0.85)
    if (extraction.businessModel) updated['businessModel'] = Math.max(updated['businessModel'] ?? 0, 0.90)
    if (extraction.timelineExpectation) updated['timelineExpectation'] = Math.max(updated['timelineExpectation'] ?? 0, 0.85)
    if (extraction.budgetRange?.min || extraction.budgetRange?.max) {
      updated['budgetRange'] = Math.max(updated['budgetRange'] ?? 0, 0.90)
    }
    if (extraction.authRequirements) updated['authRequirements'] = Math.max(updated['authRequirements'] ?? 0, 0.85)
    if (extraction.realtimeRequirements) updated['realtimeRequirements'] = Math.max(updated['realtimeRequirements'] ?? 0, 0.85)
    if (extraction.technicalConstraints) updated['technicalConstraints'] = Math.max(updated['technicalConstraints'] ?? 0, 0.85)
    if (extraction.platforms.length > 0) updated['platforms'] = Math.max(updated['platforms'] ?? 0, 0.90)

    // Features confidence is tracked per-feature, not as a field aggregate
    // but we track a general "features" confidence as the average of confirmed features
    const confirmedFeatures = extraction.features.filter(f => f.isConfirmed)
    if (confirmedFeatures.length > 0) {
      const avg = confirmedFeatures.reduce((sum, f) => sum + f.confidence, 0) / confirmedFeatures.length
      updated['features'] = Math.max(updated['features'] ?? 0, avg)
    }

    return updated
  }
  ```

- [ ] **Step 4: Create `state/manager.ts`**

  Create `dealghost/ai-service/src/state/manager.ts`:
  ```typescript
  import type { ProjectRequirementState, ExtractionResult } from '@dealghost/shared'
  import { updateFieldConfidence } from './confidence.js'

  // ── Completeness weights — must sum to 100 ───────────────────────────────────
  const COMPLETENESS_WEIGHTS: Record<string, number> = {
    projectType: 10,
    description: 10,
    platforms: 8,
    features: 20,
    targetUsers: 8,
    authRequirements: 6,
    realtimeRequirements: 6,
    integrations: 6,
    timelineExpectation: 8,
    budgetRange: 10,
    userScale: 4,
    technicalConstraints: 4,
  }
  // Sum = 10+10+8+20+8+6+6+6+8+10+4+4 = 100 ✓

  /**
   * Calculate the weighted completeness score (0–100).
   *
   * This measures INFORMATION COVERAGE — how much we know about the project.
   * It does NOT determine proposal readiness (that is L4's job via readyForSummary).
   */
  export function calculateCompleteness(state: ProjectRequirementState): number {
    let score = 0
    if (state.projectType) score += COMPLETENESS_WEIGHTS.projectType
    if (state.description && state.description.length > 10) score += COMPLETENESS_WEIGHTS.description
    if (state.platforms.length > 0) score += COMPLETENESS_WEIGHTS.platforms
    if (state.features.length > 0) score += COMPLETENESS_WEIGHTS.features
    if (state.targetUsers) score += COMPLETENESS_WEIGHTS.targetUsers
    if (state.authRequirements) score += COMPLETENESS_WEIGHTS.authRequirements
    if (state.realtimeRequirements) score += COMPLETENESS_WEIGHTS.realtimeRequirements
    if (state.integrations.length > 0) score += COMPLETENESS_WEIGHTS.integrations
    if (state.timelineExpectation) score += COMPLETENESS_WEIGHTS.timelineExpectation
    if (state.budgetRange.min !== null || state.budgetRange.max !== null) score += COMPLETENESS_WEIGHTS.budgetRange
    if (state.userScale) score += COMPLETENESS_WEIGHTS.userScale
    if (state.technicalConstraints) score += COMPLETENESS_WEIGHTS.technicalConstraints
    return score
  }

  /**
   * Merge an ExtractionResult into the current ProjectRequirementState.
   * Returns a new state object — does not mutate the input.
   */
  export function mergeExtractionIntoState(
    current: ProjectRequirementState,
    extraction: ExtractionResult
  ): ProjectRequirementState {
    const updated: ProjectRequirementState = { ...current }

    // ── Features: dedup by canonicalId, keep higher confidence ───────────────
    const featureMap = new Map(current.features.map((f) => [f.canonicalId, f]))

    for (const f of extraction.features) {
      if (extraction.featuresToRemove.includes(f.canonicalId)) continue
      const existing = featureMap.get(f.canonicalId)
      if (existing) {
        featureMap.set(f.canonicalId, f.confidence > existing.confidence ? f : existing)
      } else {
        featureMap.set(f.canonicalId, f)
      }
    }

    // Remove explicitly removed features
    for (const id of extraction.featuresToRemove) {
      featureMap.delete(id)
    }
    updated.features = Array.from(featureMap.values())

    // ── Scalar fields: only overwrite if new value is non-null ────────────────
    if (extraction.targetUsers) updated.targetUsers = extraction.targetUsers
    if (extraction.userScale) updated.userScale = extraction.userScale
    if (extraction.businessModel) updated.businessModel = extraction.businessModel
    if (extraction.timelineExpectation) updated.timelineExpectation = extraction.timelineExpectation
    if (extraction.budgetRange) updated.budgetRange = extraction.budgetRange
    if (extraction.authRequirements) updated.authRequirements = extraction.authRequirements
    if (extraction.realtimeRequirements) updated.realtimeRequirements = extraction.realtimeRequirements
    if (extraction.adminPanelRequirements) updated.adminPanelRequirements = extraction.adminPanelRequirements
    if (extraction.technicalConstraints) updated.technicalConstraints = extraction.technicalConstraints
    if (extraction.clientTechPreferences) updated.clientTechPreferences = extraction.clientTechPreferences

    // ── Arrays: merge + deduplicate ───────────────────────────────────────────
    if (extraction.platforms.length > 0) {
      updated.platforms = [...new Set([...current.platforms, ...extraction.platforms])]
    }
    if (extraction.integrations.length > 0) {
      updated.integrations = [...new Set([...current.integrations, ...extraction.integrations])]
    }
    if (extraction.compliance.length > 0) {
      updated.compliance = [...new Set([...current.compliance, ...extraction.compliance])]
    }

    // ── Workflows: merge by name ──────────────────────────────────────────────
    if (extraction.workflows.length > 0) {
      const existingNames = new Set(current.workflows.map((w) => w.name))
      const newWorkflows = extraction.workflows.filter((w) => !existingNames.has(w.name))
      updated.workflows = [...current.workflows, ...newWorkflows]
    }

    // ── User roles: merge by name ─────────────────────────────────────────────
    if (extraction.userRoles.length > 0) {
      const existingNames = new Set(current.userRoles.map((r) => r.name))
      const newRoles = extraction.userRoles.filter((r) => !existingNames.has(r.name))
      updated.userRoles = [...current.userRoles, ...newRoles]
    }

    // ── Assumptions: merge without duplicates ─────────────────────────────────
    if (extraction.assumptions.length > 0) {
      const existingSet = new Set(current.assumptions)
      const newAssumptions = extraction.assumptions.filter((a) => !existingSet.has(a))
      updated.assumptions = [...current.assumptions, ...newAssumptions]
    }

    // ── Update field confidence ───────────────────────────────────────────────
    updated.fieldConfidence = updateFieldConfidence(current.fieldConfidence, extraction)

    // ── Recalculate completeness ──────────────────────────────────────────────
    updated.completenessScore = calculateCompleteness(updated)

    return updated
  }

  /**
   * Format recent conversation messages into a compact string for prompts.
   * Keeps the last N turns to stay within token budget.
   */
  export function formatConversationHistory(
    messages: Array<{ role: string; content: string }>,
    maxTurns = 10
  ): string {
    const recent = messages.slice(-maxTurns * 2) // each turn = 1 user + 1 assistant
    return recent
      .map((m) => `${m.role === 'user' ? 'Client' : 'Assistant'}: ${m.content}`)
      .join('\n')
  }
  ```

- [ ] **Step 5: Run tests to confirm they pass**

  ```bash
  npm test -- src/state/manager.test.ts
  ```
  Expected: PASS — 8 tests passing

- [ ] **Step 6: Commit**

  ```bash
  git add src/state/
  git commit -m "feat: add L3 state engine — merge, dedup, weighted completeness score, field confidence"
  ```

---

### Task 13: Basic `POST /chat` route + wire `/debug/pipeline`

**Files:**
- Create: `dealghost/ai-service/src/routes/chat.ts`
- Modify: `dealghost/ai-service/src/index.ts`

- [ ] **Step 1: Create `routes/chat.ts`**

  Create `dealghost/ai-service/src/routes/chat.ts`:
  ```typescript
  import { Hono } from 'hono'
  import { createEmptyState } from '@dealghost/shared'
  import type { ChatRequest } from '@dealghost/shared'
  import { callGroqIntent } from '../models/groq.js'
  import { runL2Extraction } from '../pipeline/l2-extraction.js'
  import { mergeExtractionIntoState, formatConversationHistory } from '../state/manager.js'
  import { loadState, saveState } from '../db/redis.js'
  import { prisma } from '../db/prisma.js'

  export const chatRoute = new Hono()

  chatRoute.post('/', async (c) => {
    const body = await c.req.json<ChatRequest>()
    const { message, conversationId } = body

    if (!message?.trim()) {
      return c.json({ error: 'message is required' }, 400)
    }

    // ── 1. Load or create conversation ────────────────────────────────────────
    let convId = conversationId
    let isNewConversation = false

    if (!convId) {
      // Create a new conversation in DB (requires a Lead — use a system lead for now)
      // For Phase 2 we create a standalone conversation without a Lead
      const conv = await prisma.conversation.create({
        data: {
          lead: {
            create: {
              name: 'Anonymous',
              email: `anon-${Date.now()}@dealghost.internal`,
            },
          },
        },
      })
      convId = conv.id
      isNewConversation = true
    }

    // ── 2. Load state from Redis (or create empty state) ─────────────────────
    let state = await loadState(convId)
    if (!state) {
      state = createEmptyState(convId)
    }

    // ── 3. Load recent messages from DB for context ───────────────────────────
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    const conversationHistory = formatConversationHistory(
      recentMessages.map((m) => ({ role: m.role.toLowerCase(), content: m.content }))
    )

    // ── 4. Save the user message to DB ────────────────────────────────────────
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'USER',
        content: message,
      },
    })

    // ── 5. Pre-flight: intent classification (Groq — fast, cheap) ────────────
    const intent = await callGroqIntent(message, conversationHistory)

    // ── 6. Route by intent ────────────────────────────────────────────────────
    if (intent === 'READY_FOR_PROPOSAL') {
      const responseMsg = "Great — I have enough information to generate a detailed proposal. Click **Generate Proposal** when you're ready."
      await prisma.message.create({
        data: { conversationId: convId, role: 'ASSISTANT', content: responseMsg },
      })
      return c.json({
        conversationId: convId,
        message: responseMsg,
        state,
        intent,
        readyForProposal: true,
      })
    }

    // ── 7. L2 — Canonical extraction ─────────────────────────────────────────
    const extraction = await runL2Extraction({
      latestMessage: message,
      conversationHistory,
      currentState: state,
    })

    // ── 8. L3 — State merge ───────────────────────────────────────────────────
    const updatedState = mergeExtractionIntoState(state, extraction)

    // ── 9. Generate follow-up question (basic version — replaced by L4 in Phase 3) ─
    const responseMsg = generateBasicFollowup(updatedState, extraction)

    // ── 10. Save state to Redis ───────────────────────────────────────────────
    await saveState(convId, updatedState)

    // ── 11. Persist to Supabase ───────────────────────────────────────────────
    await prisma.projectAnalysis.upsert({
      where: { conversationId: convId },
      create: {
        conversationId: convId,
        requirements: updatedState as unknown as object,
        completeness: updatedState.completenessScore,
        fieldConfidence: updatedState.fieldConfidence,
        confirmedFacts: updatedState.confirmedFacts,
        assumptions: updatedState.assumptions,
        workflows: updatedState.workflows as unknown as object[],
        userRoles: updatedState.userRoles as unknown as object[],
        discoveryTargets: updatedState.discoveryTargets as unknown as object[],
        technicalRisks: updatedState.technicalRisks as unknown as object[],
        keyDiscoveries: updatedState.keyDiscoveries,
        contradictions: updatedState.contradictions as unknown as object[],
        ambiguities: updatedState.ambiguities as unknown as object[],
      },
      update: {
        requirements: updatedState as unknown as object,
        completeness: updatedState.completenessScore,
        fieldConfidence: updatedState.fieldConfidence,
        confirmedFacts: updatedState.confirmedFacts,
        assumptions: updatedState.assumptions,
        workflows: updatedState.workflows as unknown as object[],
        userRoles: updatedState.userRoles as unknown as object[],
        discoveryTargets: updatedState.discoveryTargets as unknown as object[],
        technicalRisks: updatedState.technicalRisks as unknown as object[],
        keyDiscoveries: updatedState.keyDiscoveries,
        contradictions: updatedState.contradictions as unknown as object[],
        ambiguities: updatedState.ambiguities as unknown as object[],
      },
    })

    // ── 12. Save assistant response to DB ────────────────────────────────────
    await prisma.message.create({
      data: { conversationId: convId, role: 'ASSISTANT', content: responseMsg },
    })

    return c.json({
      conversationId: convId,
      message: responseMsg,
      state: updatedState,
      intent,
      readyForProposal: updatedState.completenessScore >= 80,
    })
  })

  // ── Basic follow-up generator (Phase 2 placeholder — replaced by L4 in Phase 3) ──

  const FOLLOW_UP_PRIORITY: Array<{ field: keyof typeof fieldLabels; question: string }> = [
    { field: 'projectType', question: "What type of project is this — web app, mobile app, marketplace, SaaS platform, or something else?" },
    { field: 'targetUsers', question: "Who are the main users of this platform? Walk me through the key user types." },
    { field: 'platforms', question: "Which platforms do you need — web, iOS, Android, or a combination?" },
    { field: 'features', question: "What are the core features you absolutely need in the first version?" },
    { field: 'authRequirements', question: "How will users log in — email/password, social login (Google, Apple), or something else?" },
    { field: 'budgetRange', question: "Do you have a rough budget in mind for this project?" },
    { field: 'timelineExpectation', question: "When do you need this launched by? Is there a hard deadline?" },
    { field: 'realtimeRequirements', question: "Does anything in the app need to update in real-time — live tracking, chat, notifications?" },
    { field: 'userScale', question: "How many users are you expecting at launch, and where do you see it in a year?" },
  ]

  const fieldLabels = {
    projectType: true, targetUsers: true, platforms: true, features: true,
    authRequirements: true, budgetRange: true, timelineExpectation: true,
    realtimeRequirements: true, userScale: true,
  }

  function generateBasicFollowup(state: ReturnType<typeof createEmptyState>, extraction: ReturnType<typeof mergeExtractionIntoState>): string {
    // Find the first high-priority field that's still missing
    for (const item of FOLLOW_UP_PRIORITY) {
      const val = (state as Record<string, unknown>)[item.field as string]
      if (!val || (Array.isArray(val) && val.length === 0)) {
        return item.question
      }
    }

    // All key fields filled — acknowledge and prepare for proposal
    const featureCount = state.features.length
    const platforms = state.platforms.join(' and ')
    return `I have a good picture of your project now — ${featureCount} feature${featureCount !== 1 ? 's' : ''} across ${platforms || 'your platform'}. Completeness is at ${state.completenessScore}%. Would you like me to generate a detailed proposal?`
  }
  ```

- [ ] **Step 2: Update `src/index.ts` — add chat route + wire `/debug/pipeline`**

  Open `dealghost/ai-service/src/index.ts` and replace its contents:
  ```typescript
  import { serve } from '@hono/node-server'
  import { Hono } from 'hono'
  import { cors } from 'hono/cors'
  import { logger } from 'hono/logger'
  import { chatRoute } from './routes/chat.js'

  const app = new Hono()

  // ── Middleware ────────────────────────────────────────────────────────────────
  app.use('*', logger())
  app.use(
    '*',
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })
  )

  // ── Health ────────────────────────────────────────────────────────────────────
  app.get('/health', (c) =>
    c.json({ status: 'ok', service: 'dealghost-ai', timestamp: new Date().toISOString() })
  )

  // ── Chat ──────────────────────────────────────────────────────────────────────
  app.route('/chat', chatRoute)

  // ── Debug pipeline (runs L2 + L3 on a test message, returns each layer's output) ─
  app.post('/debug/pipeline', async (c) => {
    const body = await c.req.json<{ message: string; conversationId?: string }>()
    const message = body.message ?? 'I need a food delivery app with GPS tracking and Stripe payments'

    const { createEmptyState } = await import('@dealghost/shared')
    const { runL2Extraction } = await import('./pipeline/l2-extraction.js')
    const { mergeExtractionIntoState, calculateCompleteness } = await import('./state/manager.js')

    const state = createEmptyState(body.conversationId ?? 'debug-session')

    const l2Output = await runL2Extraction({
      latestMessage: message,
      conversationHistory: '',
      currentState: state,
    })

    const l3Output = mergeExtractionIntoState(state, l2Output)

    return c.json({
      input: { message },
      l2_extraction: l2Output,
      l3_merged_state: l3Output,
      completeness_score: l3Output.completenessScore,
      feature_count: l3Output.features.length,
    })
  })

  // ── Start server ──────────────────────────────────────────────────────────────
  const port = Number(process.env.PORT ?? 3001)
  serve({ fetch: app.fetch, port }, () => {
    console.log(`🤖 DEALGHOST AI service running on http://localhost:${port}`)
  })

  export default app
  ```

- [ ] **Step 3: Smoke test `POST /chat` end-to-end**

  Start the dev server:
  ```bash
  npm run dev
  ```

  In a new terminal:
  ```bash
  curl -X POST http://localhost:3001/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "I need a food delivery app with real-time GPS tracking and Stripe payments for iOS and Android"}'
  ```
  Expected response shape:
  ```json
  {
    "conversationId": "cuid...",
    "message": "Who are the main users of this platform?...",
    "state": { "features": [...], "completenessScore": 28, ... },
    "intent": "COLLECTING_INFO",
    "readyForProposal": false
  }
  ```

- [ ] **Step 4: Smoke test `/debug/pipeline`**

  ```bash
  curl -X POST http://localhost:3001/debug/pipeline \
    -H "Content-Type: application/json" \
    -d '{"message": "marketplace for tutors with booking, payments, and video calls"}'
  ```
  Expected: JSON showing `l2_extraction` with features including `booking_system`, `payment_processing`, and `l3_merged_state` with `completenessScore > 0`.

- [ ] **Step 5: Commit**

  ```bash
  git add src/routes/chat.ts src/index.ts
  git commit -m "feat: wire POST /chat — intent → L2 extraction → L3 merge → Redis + Supabase persist"
  ```

---

### Task 14: FlowZint company knowledge profile

**Why this exists:** DealGhost generates proposals on behalf of FlowZint. Without knowing what FlowZint actually builds, pricing, and architecture defaults, the AI produces generic "software agency" output. This file is the single source of truth for FlowZint's identity — injected into L2 extraction (so Claude knows what services are available) and L6 proposal (so proposals reflect real pricing and tech approach).

**Files:**
- Create: `dealghost/ai-service/src/knowledge/company-profile.ts`
- Create: `dealghost/ai-service/src/knowledge/__tests__/company-profile.test.ts`
- Modify: `dealghost/ai-service/src/prompts/extraction.ts` (add `companyProfileSection` param)
- Modify: `dealghost/ai-service/src/pipeline/l2-extraction.ts` (load + pass profile)

- [ ] **Step 1: Write the failing tests**

  Create `dealghost/ai-service/src/knowledge/__tests__/company-profile.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import {
    getCompanyProfileSection,
    FLOWZINT_SERVICES,
    FLOWZINT_SOLUTIONS,
    PRICING_TIERS,
    formatInrAmount,
  } from '../company-profile.js'

  describe('getCompanyProfileSection', () => {
    it('returns a non-empty string', () => {
      const section = getCompanyProfileSection()
      expect(section.length).toBeGreaterThan(100)
    })

    it('includes the company name', () => {
      expect(getCompanyProfileSection()).toContain('FlowZint')
    })

    it('includes all 6 service names', () => {
      const section = getCompanyProfileSection()
      for (const service of FLOWZINT_SERVICES) {
        expect(section).toContain(service.name)
      }
    })

    it('includes all 4 solution names', () => {
      const section = getCompanyProfileSection()
      for (const solution of FLOWZINT_SOLUTIONS) {
        expect(section).toContain(solution.name)
      }
    })

    it('includes INR pricing with ₹ symbol', () => {
      const section = getCompanyProfileSection()
      expect(section).toContain('₹')
    })

    it('includes all 4 pricing tiers', () => {
      const section = getCompanyProfileSection()
      for (const tier of Object.values(PRICING_TIERS)) {
        expect(section).toContain(tier.label)
      }
    })
  })

  describe('formatInrAmount', () => {
    it('formats amounts in lakhs', () => {
      expect(formatInrAmount(200_000)).toBe('₹2L')
      expect(formatInrAmount(800_000)).toBe('₹8L')
      expect(formatInrAmount(3_000_000)).toBe('₹30L')
      expect(formatInrAmount(8_000_000)).toBe('₹80L')
    })

    it('formats crore amounts', () => {
      expect(formatInrAmount(10_000_000)).toBe('₹1Cr')
      expect(formatInrAmount(50_000_000)).toBe('₹5Cr')
    })
  })

  describe('FLOWZINT_SERVICES', () => {
    it('has exactly 6 services', () => {
      expect(FLOWZINT_SERVICES.length).toBe(6)
    })

    it('each service has id, name, description, and capabilities', () => {
      for (const service of FLOWZINT_SERVICES) {
        expect(service.id).toBeTruthy()
        expect(service.name).toBeTruthy()
        expect(service.description).toBeTruthy()
        expect(service.capabilities.length).toBeGreaterThan(0)
      }
    })
  })

  describe('FLOWZINT_SOLUTIONS', () => {
    it('has exactly 4 solutions', () => {
      expect(FLOWZINT_SOLUTIONS.length).toBe(4)
    })
  })
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  cd dealghost/ai-service
  npx vitest run src/knowledge/__tests__/company-profile.test.ts
  ```
  Expected: FAIL — `company-profile.js` not found.

- [ ] **Step 3: Create `knowledge/company-profile.ts`**

  Create `dealghost/ai-service/src/knowledge/company-profile.ts`:
  ```typescript
  // ── FlowZint Company Knowledge Profile ────────────────────────────────────────
  // Single source of truth for who FlowZint is, what they build, and how they price.
  // Injected into AI prompts so DealGhost generates proposals that reflect reality.
  //
  // TO UPDATE PRICING: edit PRICING_TIERS below. All values are in INR (₹).
  // TO SHOW USD:       set SHOW_USD_PRICING=true in ai-service/.env

  // ── Company identity ──────────────────────────────────────────────────────────
  export const FLOWZINT_COMPANY = {
    name: 'FlowZint',
    fullName: 'FlowZint Technologies',
    website: 'https://flowzint.in',
    country: 'India',
    primaryCurrency: 'INR' as const,
    positioning:
      'Enterprise-grade software and technology solutions firm building connected digital infrastructure, SaaS systems, and intelligent AI automation platforms for global scale.',
  } as const

  // ── Pricing tiers (INR primary) ───────────────────────────────────────────────
  // Edit these ranges to match actual FlowZint commercial rates.
  export const PRICING_TIERS = {
    SIMPLE: {
      label: 'Simple',
      inrMin: 200_000,    // ₹2,00,000
      inrMax: 800_000,    // ₹8,00,000
      description: 'Basic web or mobile app, standard features, 4–8 weeks',
    },
    STANDARD: {
      label: 'Standard',
      inrMin: 800_000,    // ₹8,00,000
      inrMax: 3_000_000,  // ₹30,00,000
      description: 'Full-featured app or SaaS platform with custom integrations, 8–16 weeks',
    },
    COMPLEX: {
      label: 'Complex',
      inrMin: 3_000_000,  // ₹30,00,000
      inrMax: 8_000_000,  // ₹80,00,000
      description: 'Enterprise system, AI/ML components, multi-platform, 16–28 weeks',
    },
    ENTERPRISE: {
      label: 'Enterprise',
      inrMin: 8_000_000,  // ₹80,00,000
      inrMax: null,       // no upper bound
      description: 'Large-scale organisational infrastructure, multi-team, 28+ weeks',
    },
  } as const

  // USD display — update exchange rate here when needed
  export const INR_TO_USD_RATE = 84 // approximate
  export const SHOW_USD_PRICING = process.env.SHOW_USD_PRICING === 'true'

  // ── Service catalog ───────────────────────────────────────────────────────────
  export const FLOWZINT_SERVICES = [
    {
      id: 'web_infrastructure',
      name: 'Web Infrastructure',
      description:
        'Enterprise web systems integrated into operational workflows — not isolated websites. Scalable, API-connected, cross-device, built for long-term operational stability.',
      capabilities: [
        'Scalable web architecture for high-traffic environments',
        'Third-party API and microservice integration',
        'Cross-device responsive systems (desktop, tablet, mobile)',
        'Connected operational workflow web platforms',
        'Performance-optimised frontend ecosystems',
      ],
    },
    {
      id: 'mobile_platforms',
      name: 'Mobile Platforms',
      description:
        'iOS and Android apps designed as intelligent digital infrastructure, not standalone apps. Cross-platform with enterprise-grade features including offline sync and enterprise security.',
      capabilities: [
        'Cross-platform iOS & Android development',
        'Offline sync and local data caching strategies',
        'Enterprise security and authentication',
        'Adaptive UI based on user behaviour and system load',
        'Enterprise mobility — complex business routing on mobile',
        'Integration with enterprise systems and SaaS environments',
      ],
    },
    {
      id: 'saas_systems',
      name: 'SaaS Systems',
      description:
        'Scalable SaaS platforms engineered as operational ecosystems. Multi-tenant, API-first, cloud-native with high availability and zero-downtime architecture.',
      capabilities: [
        'Multi-tenant SaaS architecture',
        'API-first design',
        'High availability and zero-downtime deployments',
        'Microservices with decoupled frontends',
        'Auto-scaling cloud infrastructure',
        'Cloud-native processing with global accessibility',
      ],
    },
    {
      id: 'ai_automation',
      name: 'AI & Automation',
      description:
        'AI-powered operational systems and intelligent workflow automation. Neural models, predictive analytics, and workflow automation built as integrated infrastructure.',
      capabilities: [
        'Neural models for enterprise dataset processing',
        'Machine learning systems with continuous adaptive optimisation',
        'Predictive analytics for operational forecasting',
        'Workflow automation — cron, API-triggered, event-driven',
        'Multi-source data ingestion pipelines',
        'Generative AI integration',
        'AI chatbots for sales, support, and customer care',
        'Process optimisation — replacing manual tasks with reliable automation',
      ],
    },
    {
      id: 'enterprise_systems',
      name: 'Enterprise Systems',
      description:
        'Large-scale enterprise operational platforms. Three-layer architecture: Presentation Layer → Business Logic (Microservices + API Gateway) → Data Layer. Built for mission-critical, zero-downtime operation.',
      capabilities: [
        'Three-layer enterprise architecture (presentation, business logic, data)',
        'Microservices and API gateway',
        'Zero-downtime architecture for mission-critical operations',
        'Smart analytics embedded in management and reporting tools',
        'Workflow and task management platforms',
        'Data integrity and secure environment engineering',
      ],
    },
    {
      id: 'branding_growth',
      name: 'Branding & Growth',
      description:
        'Digital branding as operational infrastructure — not just visual identity. Connected digital marketing ecosystems with data-driven growth tracking, omnichannel sync, and campaign analytics.',
      capabilities: [
        'Scalable brand ecosystem infrastructure',
        'Connected digital marketing and omnichannel systems',
        'Customer engagement and conversion analytics dashboards',
        'Data-driven growth pipelines (visibility → engagement → conversion)',
        'Adaptive communication systems based on user behaviour',
        'Market expansion and digital positioning strategies',
      ],
    },
  ] as const

  // ── Solution areas ────────────────────────────────────────────────────────────
  // Business transformation outcomes FlowZint delivers — used to frame proposals.
  export const FLOWZINT_SOLUTIONS = [
    {
      id: 'digital_transformation',
      name: 'Digital Transformation',
      description:
        'Moving organisations from fragmented legacy systems to connected, modern digital infrastructure.',
    },
    {
      id: 'business_automation',
      name: 'Business Automation',
      description:
        'Replacing manual processes with intelligent automated workflows, reducing operational overhead.',
    },
    {
      id: 'ai_transformation',
      name: 'AI Transformation',
      description:
        'Embedding AI and machine learning directly into business operations for intelligent, adaptive systems.',
    },
    {
      id: 'customer_experience',
      name: 'Customer Experience',
      description:
        'Building connected digital experiences that strengthen customer interaction, accessibility, and engagement.',
    },
  ] as const

  // ── Architecture standard ─────────────────────────────────────────────────────
  export const FLOWZINT_ARCHITECTURE = {
    standard3Layer: {
      presentation: 'Client Interfaces & Dashboards',
      businessLogic: 'Microservices & API Gateway',
      data: 'Scalable Databases & Storage',
    },
    crossCuttingCapabilities: [
      'Microservices architecture',
      'API-first design',
      'Cloud-native auto-scaling',
      'Multi-tenant support',
      'High availability (99.9%+)',
      'Zero-downtime deployments',
      'Enterprise security',
      'Third-party API integrations',
      'Offline sync (mobile)',
      'Analytics and reporting dashboards',
      'Workflow automation',
    ],
  } as const

  // ── Formatter helpers ─────────────────────────────────────────────────────────

  /**
   * Format an INR amount in human-readable lakhs (L) or crores (Cr).
   * formatInrAmount(200_000) → "₹2L"
   * formatInrAmount(10_000_000) → "₹1Cr"
   */
  export function formatInrAmount(amount: number): string {
    if (amount >= 10_000_000) {
      return `₹${amount / 10_000_000}Cr`
    }
    return `₹${amount / 100_000}L`
  }

  function formatPricingTier(key: keyof typeof PRICING_TIERS): string {
    const tier = PRICING_TIERS[key]
    const inrRange = tier.inrMax
      ? `${formatInrAmount(tier.inrMin)} – ${formatInrAmount(tier.inrMax)}`
      : `${formatInrAmount(tier.inrMin)}+`

    let usdPart = ''
    if (SHOW_USD_PRICING) {
      const usdMin = Math.round(tier.inrMin / INR_TO_USD_RATE / 1000)
      const usdRange = tier.inrMax
        ? `~$${usdMin}k – $${Math.round(tier.inrMax / INR_TO_USD_RATE / 1000)}k`
        : `~$${usdMin}k+`
      usdPart = ` (${usdRange})`
    }

    return `  ${tier.label}: ${inrRange}${usdPart} — ${tier.description}`
  }

  // ── Main export: formatted prompt section ─────────────────────────────────────

  /**
   * Returns the company profile as a structured text block for injection into AI prompts.
   * Placed at the top of system prompts (before the ontology) to benefit from prompt caching.
   */
  export function getCompanyProfileSection(): string {
    const serviceLines = FLOWZINT_SERVICES.map(
      (s) => `  ${s.name}: ${s.description}`
    )

    const solutionLines = FLOWZINT_SOLUTIONS.map(
      (s) => `  ${s.name}: ${s.description}`
    )

    const pricingLines = (Object.keys(PRICING_TIERS) as Array<keyof typeof PRICING_TIERS>).map(
      formatPricingTier
    )

    const archLayer = FLOWZINT_ARCHITECTURE.standard3Layer
    const archLine = `${archLayer.presentation} → ${archLayer.businessLogic} → ${archLayer.data}`

    return [
      '## ABOUT FLOWZINT (THE AGENCY DELIVERING THIS PROJECT)',
      FLOWZINT_COMPANY.positioning,
      '',
      '### Services We Offer',
      ...serviceLines,
      '',
      '### Solution Areas (how we frame transformations)',
      ...solutionLines,
      '',
      '### Standard Architecture',
      `  ${archLine}`,
      '',
      `### Pricing Tiers (${FLOWZINT_COMPANY.primaryCurrency}${SHOW_USD_PRICING ? ' + USD' : ''})`,
      ...pricingLines,
      '',
      'Use this context to:',
      '- Identify which FlowZint service(s) the client project maps to',
      '- Frame proposals using FlowZint language and solution areas',
      `- Generate pricing in ₹ using the tiers above${SHOW_USD_PRICING ? ' (USD shown in parentheses)' : ''}`,
      '- Ask discovery questions relevant to what FlowZint actually builds',
    ].join('\n')
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  cd dealghost/ai-service
  npx vitest run src/knowledge/__tests__/company-profile.test.ts
  ```
  Expected: all 11 tests PASS.

- [ ] **Step 5: Add `companyProfileSection` param to extraction prompt builder**

  Open `dealghost/ai-service/src/prompts/extraction.ts` and update `buildExtractionSystemPrompt`:
  ```typescript
  // Change the signature — companyProfileSection placed FIRST (cached before ontology)
  export function buildExtractionSystemPrompt(
    ontologySection: string,
    companyProfileSection = ''
  ): string {
    const profileBlock = companyProfileSection
      ? `${companyProfileSection}\n\n---\n\n`
      : ''

    return `${profileBlock}You are a senior solution architect extracting project requirements from a client discovery conversation for FlowZint.

  Your job: extract ONLY what the client has explicitly stated. You are an extractor, not a consultant — do not add, infer, or suggest anything the client did not say.

  ## What you MAY extract (light inference allowed):
  - projectType — infer from context (e.g. "mobile app" → mobile_app, "website" → web_app)
  - industry — infer from domain (e.g. "café app" → food & beverage)
  - description — a concise summary of what the client said in their own words

  ## What you must NEVER do:
  - Add features the client did not explicitly name or describe
  - Add integrations the client did not mention (e.g. do NOT add "Stripe" unless the client said "payment" or "Stripe")
  - Fill in authRequirements, realtimeRequirements, adminPanelRequirements unless the client described them
  - Add platforms the client did not specify
  - Suggest what "typical apps of this type" have

  ## Critical rule on features:
  An empty features array is CORRECT when the client has not described specific features.
  A feature must only be added if the client used words that describe it.

  WRONG: Client says "I want a café app" → you add [menu management, ordering, loyalty program]
  RIGHT: Client says "I want a café app" → features: []  (ask about features next)

  ## Feature removal:
  If the client explicitly asks to remove a feature, return its name in featuresToRemove.

  ${ontologySection}

  ## JSON format (include only fields with new/changed data):
  {
    "projectType": "web_app" | "mobile_app" | "api" | "integration" | "redesign" | "saas" | "enterprise" | "ai_automation" | "other",
    "projectName": string,
    "description": string,
    "platforms": string[],
    "features": [{ "name": string, "description": string, "priority": "MUST" | "SHOULD" | "COULD" }],
    "featuresToRemove": string[],
    "integrations": string[],
    "authRequirements": string,
    "realtimeRequirements": string,
    "adminPanelRequirements": string,
    "targetUsers": string,
    "userScale": string,
    "industry": string,
    "compliance": string[],
    "technicalConstraints": string,
    "timelineExpectation": string,
    "budgetRange": { "min": number | null, "max": number | null, "currency": "INR" | "USD", "raw": string },
    "recommendedTechStack": { "frontend": string, "backend": string, "database": string, "hosting": string, "avoid": string[] }
  }

  ## Rules:
  - Return ONLY valid JSON. No explanation, no markdown, no code blocks.
  - If nothing new at all, return: {}
  - Do NOT overwrite existing state fields unless the client provided new/corrected information
  - An empty extraction ({}) is correct and expected when the message adds no new requirement information
  - Default currency for budgetRange is INR when the client gives a number without specifying currency`
  }
  ```

  > **Note:** Two things changed from the original: (1) `companyProfileSection` param added, (2) `projectType` enum extended with `"saas"`, `"enterprise"`, `"ai_automation"` to match FlowZint's service categories, (3) default `currency` in `budgetRange` is now `"INR"`.

- [ ] **Step 6: Update `l2-extraction.ts` to load and pass the company profile**

  Open `dealghost/ai-service/src/pipeline/l2-extraction.ts` and update the `runL2Extraction` function to load the profile once and pass it to the prompt builder:
  ```typescript
  import { getCompanyProfileSection } from '../knowledge/company-profile.js'

  // Load once at module level — static data, no need to reload per request
  const COMPANY_PROFILE_SECTION = getCompanyProfileSection()

  export async function runL2Extraction(input: L2Input): Promise<ExtractionResult> {
    const ontologySection = await getOntologyPromptSection()
    // Pass company profile BEFORE ontology — both are in the cached system prompt block
    const systemPrompt = buildExtractionSystemPrompt(ontologySection, COMPANY_PROFILE_SECTION)
    // ... rest of function unchanged
  }
  ```

- [ ] **Step 7: Smoke test — verify profile appears in extraction context**

  Start the dev server and hit `/debug/pipeline` with a budget mention in INR:
  ```bash
  curl -X POST http://localhost:3001/debug/pipeline \
    -H "Content-Type: application/json" \
    -d '{"message": "I need a SaaS platform for HR management with a budget of 15 lakhs"}'
  ```
  Expected: `l2_extraction` includes `"budgetRange": { "currency": "INR", "raw": "15 lakhs", ... }` — confirms the extraction prompt now defaults to INR and understands lakh notation.

- [ ] **Step 8: Commit**

  ```bash
  git add src/knowledge/ src/prompts/extraction.ts src/pipeline/l2-extraction.ts
  git commit -m "feat: add FlowZint company knowledge profile — services, pricing (₹), architecture injected into L2"
  ```

---

### Phase 2 Milestone Check

- [ ] `POST /chat` with a first message returns `conversationId`, a follow-up question, and a state object with canonical feature IDs
- [ ] Sending a second message with the same `conversationId` continues the conversation — state accumulates correctly
- [ ] `POST /debug/pipeline` shows raw L2 and L3 output for any test message
- [ ] Budget mentions in INR (e.g. "15 lakhs", "₹5 lakh") extract with `currency: "INR"` in `budgetRange`
- [ ] `npm test` in `ai-service/` passes all tests (Claude wrapper + feature mapper + state manager + company profile)
- [ ] Supabase `project_analysis` table shows a new row with filled `requirements` JSON after a chat turn
- [ ] Redis key `dealghost:state:<conversationId>` exists after a chat turn (verify via Upstash console)

---

## Phase 3 — Intelligence Layers

**Milestone:** Follow-up questions use architect-level reasoning (not generic PM questions), lead score updates every turn, L1+L2 parallel with intent-aware L3 merge preventing state corruption, conversations over 8 turns stay performant via memory compression, `npm test` passes all Phase 3 tests.

---

### Task 15: L1 understanding prompt builders

**Files:**
- Create: `dealghost/ai-service/src/prompts/understanding.ts`
- Create: `dealghost/ai-service/src/prompts/understanding.test.ts`

- [ ] **Step 1: Write failing tests for understanding prompt builders**

  Create `dealghost/ai-service/src/prompts/understanding.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import {
    buildUnderstandingSystemPrompt,
    summariseStateForUnderstanding,
    buildUnderstandingUserPrompt,
  } from './understanding.js'
  import { createEmptyState } from '@dealghost/shared'

  describe('buildUnderstandingSystemPrompt', () => {
    it('contains all valid semanticIntent values', () => {
      const prompt = buildUnderstandingSystemPrompt()
      for (const intent of ['adding', 'correcting', 'removing', 'clarifying', 'elaborating', 'questioning', 'done', 'confirming']) {
        expect(prompt).toContain(`"${intent}"`)
      }
    })

    it('contains uncertainty signal handling instructions', () => {
      const prompt = buildUnderstandingSystemPrompt()
      expect(prompt).toContain('uncertain')
      expect(prompt).toContain('"constraint"')
    })

    it('returns a non-empty string longer than 500 chars', () => {
      expect(buildUnderstandingSystemPrompt().length).toBeGreaterThan(500)
    })
  })

  describe('summariseStateForUnderstanding', () => {
    it('returns "(no state yet — first message)" for empty state', () => {
      const state = createEmptyState('test-conv')
      expect(summariseStateForUnderstanding(state)).toBe('(no state yet — first message)')
    })

    it('includes projectType when set', () => {
      const state = { ...createEmptyState('test-conv'), projectType: 'web_app' as const }
      expect(summariseStateForUnderstanding(state)).toContain('projectType: web_app')
    })

    it('includes platforms array when non-empty', () => {
      const state = { ...createEmptyState('test-conv'), platforms: ['iOS', 'Android'] }
      expect(summariseStateForUnderstanding(state)).toContain('platforms: [iOS, Android]')
    })

    it('excludes null/empty fields', () => {
      const state = createEmptyState('test-conv')
      const summary = summariseStateForUnderstanding(state)
      expect(summary).not.toContain('targetUsers')
      expect(summary).not.toContain('timeline')
      expect(summary).not.toContain('budget')
    })
  })

  describe('buildUnderstandingUserPrompt', () => {
    it('includes the latest message', () => {
      const prompt = buildUnderstandingUserPrompt('I need GPS tracking', '', createEmptyState('test-conv'))
      expect(prompt).toContain('I need GPS tracking')
    })

    it('includes RECENT CONVERSATION section when history is provided', () => {
      const prompt = buildUnderstandingUserPrompt(
        'Yes exactly',
        'Client: I need an app\nAssistant: What kind?',
        createEmptyState('test-conv')
      )
      expect(prompt).toContain('RECENT CONVERSATION:')
      expect(prompt).toContain('Client: I need an app')
    })

    it('omits RECENT CONVERSATION section when history is empty', () => {
      const prompt = buildUnderstandingUserPrompt('First message', '', createEmptyState('test-conv'))
      expect(prompt).not.toContain('RECENT CONVERSATION:')
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- src/prompts/understanding.test.ts
  ```
  Expected: FAIL — `Cannot find module './understanding.js'`

- [ ] **Step 3: Create `prompts/understanding.ts`**

  Create `dealghost/ai-service/src/prompts/understanding.ts`:
  ```typescript
  import type { ProjectRequirementState } from '@dealghost/shared'

  /**
   * Build the L1 understanding system prompt.
   * Static content — safe to cache with Anthropic prompt caching.
   */
  export function buildUnderstandingSystemPrompt(): string {
    return `You are a senior pre-sales business analyst listening to a software project discovery conversation.

  Your job: deeply understand what the client just said — their INTENT, what they're ADDING, CORRECTING, REMOVING, and surface any contradictions with what we already know.

  Return ONLY valid JSON matching this exact shape:
  {
    "semanticIntent": "adding" | "correcting" | "removing" | "clarifying" | "elaborating" | "questioning" | "done" | "confirming",
    "businessDomain": string,
    "keyEntities": [{ "type": "feature" | "integration" | "constraint" | "person" | "system", "value": string }],
    "corrections": [{ "field": string, "oldValue": string, "newValue": string }],
    "contradictions": [{ "existingFact": string, "newStatement": string, "field": string }],
    "workflowsDescribed": string[],
    "urgencySignals": string[],
    "businessModelHints": string[],
    "confidenceInUnderstanding": number
  }

  ## semanticIntent rules:
  - "adding" — client is providing new requirements or details
  - "correcting" — client is changing something stated before ("actually", "instead", "not X but Y", "we changed our mind")
  - "removing" — client explicitly removes a feature or requirement ("remove", "don't want", "take out", "cancel that")
  - "clarifying" — client explains something in more detail without changing it
  - "elaborating" — client expands on a topic, may or may not add new requirements
  - "questioning" — client asks about the process, pricing, timeline, or feasibility
  - "done" — client signals they are finished sharing requirements
  - "confirming" — client agrees with or acknowledges something

  ## corrections:
  Only populate when semanticIntent is "correcting". Each entry names the field being changed with old and new values.
  Trigger words: "actually", "I meant", "change that to", "not X, we need Y", "we decided against", "instead of".

  ## contradictions:
  Only flag when the new statement CLEARLY conflicts with a known fact in KNOWN PROJECT STATE.
  Example: state has platforms ["iOS", "Android"], client says "actually we only need iOS" → contradiction on field "platforms".
  Leave empty [] if no clear conflict exists.

  ## Uncertainty signals (captured in keyEntities):
  When the client expresses uncertainty about a specific field — "not sure yet", "haven't decided", "TBD", "maybe" — capture it as a constraint entity so downstream layers do not re-ask about that field.
  Format: { "type": "constraint", "value": "uncertain: <fieldName>" }
  Example: "not sure about the budget yet" → { "type": "constraint", "value": "uncertain: budgetRange" }
  Example: "we haven't decided on platforms" → { "type": "constraint", "value": "uncertain: platforms" }

  ## confidenceInUnderstanding:
  0.9+ = clear intent. 0.7 = reasonably clear. 0.5 = ambiguous. 0.3 = very unclear.

  Return ONLY valid JSON. No explanation, no markdown, no code blocks.`
  }

  /**
   * Summarise the current project state to a compact string for the L1 prompt.
   * Only includes non-null, non-empty fields to keep tokens minimal.
   */
  export function summariseStateForUnderstanding(state: ProjectRequirementState): string {
    const lines: string[] = []
    if (state.projectType) lines.push(`projectType: ${state.projectType}`)
    if (state.projectName) lines.push(`projectName: ${state.projectName}`)
    if (state.platforms.length > 0) lines.push(`platforms: [${state.platforms.join(', ')}]`)
    if (state.features.length > 0) lines.push(`features: [${state.features.map(f => f.canonicalId).join(', ')}]`)
    if (state.integrations.length > 0) lines.push(`integrations: [${state.integrations.join(', ')}]`)
    if (state.budgetRange.min || state.budgetRange.max) {
      lines.push(`budget: ${state.budgetRange.min ?? '?'}–${state.budgetRange.max ?? '?'} ${state.budgetRange.currency}`)
    }
    if (state.timelineExpectation) lines.push(`timeline: ${state.timelineExpectation}`)
    if (state.targetUsers) lines.push(`targetUsers: ${state.targetUsers}`)
    if (state.authRequirements) lines.push(`auth: ${state.authRequirements}`)
    if (state.realtimeRequirements) lines.push(`realtime: ${state.realtimeRequirements}`)
    return lines.length > 0 ? lines.join('\n') : '(no state yet — first message)'
  }

  /**
   * Build the user prompt for L1 understanding.
   */
  export function buildUnderstandingUserPrompt(
    latestMessage: string,
    conversationHistory: string,
    currentState: ProjectRequirementState
  ): string {
    const stateSummary = summariseStateForUnderstanding(currentState)
    const historySection = conversationHistory
      ? `\nRECENT CONVERSATION:\n${conversationHistory}\n\n`
      : '\n\n'

    return `KNOWN PROJECT STATE:
  ${stateSummary}
  ${historySection}LATEST CLIENT MESSAGE:
  ${latestMessage}

  Analyse this message and return the SemanticUnderstanding JSON.`
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- src/prompts/understanding.test.ts
  ```
  Expected: PASS — 9 tests passing

- [ ] **Step 5: Commit**

  ```bash
  git add src/prompts/understanding.ts src/prompts/understanding.test.ts
  git commit -m "feat: add L1 understanding prompt builders — intent classification + uncertainty signal detection"
  ```

---

### Task 16: L1 understanding pipeline runner

**Files:**
- Create: `dealghost/ai-service/src/pipeline/l1-understanding.ts`
- Create: `dealghost/ai-service/src/pipeline/l1-understanding.test.ts`

- [ ] **Step 1: Write failing tests for L1 runner**

  Create `dealghost/ai-service/src/pipeline/l1-understanding.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from 'vitest'
  import { createEmptyState } from '@dealghost/shared'

  vi.mock('../models/claude.js', () => ({
    callClaudeJSON: vi.fn().mockImplementation((_opts, parse) =>
      Promise.resolve(parse(JSON.stringify({
        semanticIntent: 'adding',
        businessDomain: 'food delivery',
        keyEntities: [{ type: 'feature', value: 'GPS tracking' }],
        corrections: [],
        contradictions: [],
        workflowsDescribed: ['driver picks up order'],
        urgencySignals: ['need it in 3 months'],
        businessModelHints: ['marketplace'],
        confidenceInUnderstanding: 0.9,
      })))
    ),
  }))

  describe('runL1Understanding', () => {
    it('returns semanticIntent from Claude output', async () => {
      const { runL1Understanding } = await import('./l1-understanding.js')
      const result = await runL1Understanding({
        latestMessage: 'I need GPS tracking for drivers',
        conversationHistory: '',
        currentState: createEmptyState('test-conv'),
      })
      expect(result.semanticIntent).toBe('adding')
    })

    it('returns empty arrays for corrections and contradictions by default', async () => {
      const { runL1Understanding } = await import('./l1-understanding.js')
      const result = await runL1Understanding({
        latestMessage: 'I need a food delivery app',
        conversationHistory: '',
        currentState: createEmptyState('test-conv'),
      })
      expect(result.corrections).toEqual([])
      expect(result.contradictions).toEqual([])
    })

    it('returns urgencySignals from Claude output', async () => {
      const { runL1Understanding } = await import('./l1-understanding.js')
      const result = await runL1Understanding({
        latestMessage: 'We need this in 3 months',
        conversationHistory: '',
        currentState: createEmptyState('test-conv'),
      })
      expect(result.urgencySignals).toContain('need it in 3 months')
    })

    it('captures keyEntities from Claude output', async () => {
      const { runL1Understanding } = await import('./l1-understanding.js')
      const result = await runL1Understanding({
        latestMessage: 'I need GPS tracking',
        conversationHistory: '',
        currentState: createEmptyState('test-conv'),
      })
      expect(result.keyEntities[0].type).toBe('feature')
      expect(result.keyEntities[0].value).toBe('GPS tracking')
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- src/pipeline/l1-understanding.test.ts
  ```
  Expected: FAIL — `Cannot find module './l1-understanding.js'`

- [ ] **Step 3: Create `pipeline/l1-understanding.ts`**

  Create `dealghost/ai-service/src/pipeline/l1-understanding.ts`:
  ```typescript
  import { z } from 'zod'
  import { callClaudeJSON } from '../models/claude.js'
  import {
    buildUnderstandingSystemPrompt,
    buildUnderstandingUserPrompt,
  } from '../prompts/understanding.js'
  import type { SemanticUnderstanding, ProjectRequirementState } from '@dealghost/shared'

  export interface L1Input {
    latestMessage: string
    conversationHistory: string
    currentState: ProjectRequirementState
  }

  const SemanticUnderstandingSchema = z.object({
    semanticIntent: z.enum([
      'adding', 'correcting', 'removing', 'clarifying',
      'elaborating', 'questioning', 'done', 'confirming',
    ]),
    businessDomain: z.string().default('software'),
    keyEntities: z.array(z.object({
      type: z.enum(['feature', 'integration', 'constraint', 'person', 'system']),
      value: z.string(),
    })).default([]),
    corrections: z.array(z.object({
      field: z.string(),
      oldValue: z.string(),
      newValue: z.string(),
    })).default([]),
    contradictions: z.array(z.object({
      existingFact: z.string(),
      newStatement: z.string(),
      field: z.string(),
    })).default([]),
    workflowsDescribed: z.array(z.string()).default([]),
    urgencySignals: z.array(z.string()).default([]),
    businessModelHints: z.array(z.string()).default([]),
    confidenceInUnderstanding: z.number().min(0).max(1).default(0.7),
  })

  // Cache system prompt at module level — static content, safe for Anthropic prompt caching
  const SYSTEM_PROMPT = buildUnderstandingSystemPrompt()

  export async function runL1Understanding(input: L1Input): Promise<SemanticUnderstanding> {
    const userPrompt = buildUnderstandingUserPrompt(
      input.latestMessage,
      input.conversationHistory,
      input.currentState
    )

    return callClaudeJSON(
      {
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 800,
        temperature: 0.1,
        cacheSystemPrompt: true,
      },
      (raw) => SemanticUnderstandingSchema.parse(JSON.parse(raw)) as SemanticUnderstanding
    )
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- src/pipeline/l1-understanding.test.ts
  ```
  Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

  ```bash
  git add src/pipeline/l1-understanding.ts src/pipeline/l1-understanding.test.ts
  git commit -m "feat: add L1 understanding pipeline runner — semantic intent + contradiction + uncertainty detection"
  ```

---

### Task 17: L4 discovery prompt builders

**Files:**
- Create: `dealghost/ai-service/src/prompts/discovery.ts`
- Create: `dealghost/ai-service/src/prompts/discovery.test.ts`

- [ ] **Step 1: Write failing tests for discovery prompt builders**

  Create `dealghost/ai-service/src/prompts/discovery.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { buildDiscoverySystemPrompt, buildDiscoveryUserPrompt } from './discovery.js'
  import { createEmptyState } from '@dealghost/shared'
  import type { SemanticUnderstanding, ExtractionResult } from '@dealghost/shared'

  const emptyUnderstanding: SemanticUnderstanding = {
    semanticIntent: 'adding', businessDomain: 'software',
    keyEntities: [], corrections: [], contradictions: [],
    workflowsDescribed: [], urgencySignals: [], businessModelHints: [],
    confidenceInUnderstanding: 0.8,
  }

  const emptyExtraction: ExtractionResult = {
    features: [], integrations: [], platforms: [],
    authRequirements: null, realtimeRequirements: null, adminPanelRequirements: null,
    targetUsers: null, userScale: null, businessModel: null, timelineExpectation: null,
    budgetRange: null, clientTechPreferences: null, compliance: [], technicalConstraints: null,
    workflows: [], userRoles: [], featuresToRemove: [], assumptions: [], newCanonicalEntries: [],
  }

  describe('buildDiscoverySystemPrompt', () => {
    it('contains all strategy values', () => {
      const prompt = buildDiscoverySystemPrompt()
      for (const strategy of ['clarify_scope', 'probe_complexity', 'resolve_contradiction', 'confirm_assumption', 'discover_workflow', 'ask_tech_preference', 'offer_summary']) {
        expect(prompt).toContain(`"${strategy}"`)
      }
    })

    it('contains GOOD question examples', () => {
      const prompt = buildDiscoverySystemPrompt()
      expect(prompt).toContain('GOOD:')
      expect(prompt).toContain('BAD:')
    })

    it('contains uncertainty handling instructions', () => {
      const prompt = buildDiscoverySystemPrompt()
      expect(prompt).toContain('not sure yet')
    })
  })

  describe('buildDiscoveryUserPrompt', () => {
    it('includes completeness score', () => {
      const state = createEmptyState('test-conv')
      const prompt = buildDiscoveryUserPrompt(state, emptyUnderstanding, emptyExtraction)
      expect(prompt).toContain('Completeness score: 0%')
    })

    it('includes contradiction section when contradictions exist', () => {
      const state = {
        ...createEmptyState('test-conv'),
        contradictions: [{ field: 'platforms', existingFact: 'iOS, Android', newStatement: 'iOS only' }],
      }
      const prompt = buildDiscoveryUserPrompt(state, emptyUnderstanding, emptyExtraction)
      expect(prompt).toContain('Unresolved contradictions:')
      expect(prompt).toContain('platforms')
    })

    it('includes uncertainty warning when keyEntities contains uncertain constraint', () => {
      const understanding: SemanticUnderstanding = {
        ...emptyUnderstanding,
        keyEntities: [{ type: 'constraint', value: 'uncertain: budgetRange' }],
      }
      const state = createEmptyState('test-conv')
      const prompt = buildDiscoveryUserPrompt(state, understanding, emptyExtraction)
      expect(prompt).toContain('budgetRange')
      expect(prompt).toContain('do NOT ask about these fields again')
    })

    it('includes newly extracted features', () => {
      const extraction: ExtractionResult = {
        ...emptyExtraction,
        features: [{ canonicalId: 'payment_processing', rawText: 'payments', confidence: 0.9, category: 'payments', priority: 'MUST', isConfirmed: true, dependencies: [] }],
      }
      const prompt = buildDiscoveryUserPrompt(createEmptyState('test-conv'), emptyUnderstanding, extraction)
      expect(prompt).toContain('payment_processing')
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- src/prompts/discovery.test.ts
  ```
  Expected: FAIL — `Cannot find module './discovery.js'`

- [ ] **Step 3: Create `prompts/discovery.ts`**

  Create `dealghost/ai-service/src/prompts/discovery.ts`:
  ```typescript
  import type { ProjectRequirementState, SemanticUnderstanding, ExtractionResult } from '@dealghost/shared'
  import { compactStateForPrompt } from './extraction.js'

  /**
   * Build the L4 discovery strategy system prompt.
   * Static content — safe to cache with Anthropic prompt caching.
   *
   * Contains concrete GOOD/BAD question examples to prevent generic PM-style questions.
   * This is the most quality-sensitive prompt in the system — keep examples sharp.
   */
  export function buildDiscoverySystemPrompt(): string {
    return `You are a senior solution architect at FlowZint Technologies conducting a pre-sales discovery conversation.

  FlowZint builds: web platforms, mobile apps, SaaS systems, AI automation, and enterprise software.

  Your goal: identify the single most valuable question that unblocks writing a detailed technical proposal.

  ## What blocks a proposal (in order of severity):
  1. No project type — can't size or architect anything
  2. No target users + scale — can't choose architecture tier
  3. No features described — can't estimate effort
  4. No budget range — can't tier the solution (FlowZint range: ₹2L–₹8Cr+)
  5. Unresolved contradictions — can't commit to a design
  6. Realtime requirements unknown — affects backend architecture significantly
  7. Auth requirements unknown — affects security design for B2B
  8. No timeline — can't plan delivery milestones

  ## Discovery strategies:
  - "clarify_scope" — project type, business model, or core purpose is unclear
  - "probe_complexity" — a feature exists but its workflow or depth hasn't been explored
  - "resolve_contradiction" — client said two conflicting things that must be resolved
  - "confirm_assumption" — something was inferred but never explicitly confirmed
  - "discover_workflow" — a feature was named but no user journey or workflow described
  - "ask_tech_preference" — existing systems, preferred stack, or constraints not explored
  - "offer_summary" — enough information gathered to begin proposal

  ## Uncertainty handling — CRITICAL:
  When a field is listed as uncertain (client said "not sure yet", "TBD", "haven't decided"):
  - Do NOT ask about that field again
  - Move to the NEXT most blocking unknown field
  - OR offer a concrete anchor: "Most apps at this scale budget ₹8–₹30L — does that range fit your thinking?"
  - Set strategy to "confirm_assumption", targetField to the uncertain field

  ## Question quality rules:
  1. Ask ONE specific, actionable question — never compound ("What about X and Y?")
  2. Never ask about a field already in KNOWN PROJECT STATE
  3. Sound like a human consultant, not a form or a chatbot
  4. Reference what the client already told you — show you were listening
  5. For complexity probing: ask about the DECISION the system needs to make, not just the feature name

  ## ✅ GOOD question examples (architect-level, specific, contextual):

  CONTEXT: Client mentioned "real-time driver tracking"
  GOOD: "Will dispatchers need to reassign drivers mid-route in real time, or is the tracking purely for customer-side order visibility?"
  WHY: Distinguishes a read-only map from a live logistics control system — completely different architecture.

  CONTEXT: Client mentioned "user notifications", nothing more
  GOOD: "Are notifications time-critical — within seconds of an event — or is a slight delay fine? That decides whether we need a dedicated push service or can batch them."
  WHY: Pushes on the technical implication, educates the client about the tradeoff.

  CONTEXT: Client described an admin panel without detail
  GOOD: "How granular does access control need to be in the admin panel — multiple roles with different permissions, or a single admin view?"
  WHY: Role-based access doubles complexity — needs clarification before scoping.

  CONTEXT: Client described a marketplace, no payment detail
  GOOD: "For payments — will the platform split funds between buyer and seller automatically, or does the seller handle payment outside the platform?"
  WHY: Marketplace payment splitting is a distinct complex integration vs. simple checkout.

  ## ❌ BAD question examples (generic, PM-style, kills the product demo):

  BAD: "Do you need real-time tracking?" — client already said they do
  BAD: "What features do you need?" — already being explored
  BAD: "Have you thought about your tech stack?" — vague, not grounded in their context
  BAD: "What are your scalability requirements?" — MBA buzzword, not an architect question
  BAD: "Do you have a budget in mind?" — cold and transactional; use a range anchor instead

  Return ONLY valid JSON:
  {
    "strategy": "clarify_scope" | "probe_complexity" | "resolve_contradiction" | "confirm_assumption" | "discover_workflow" | "ask_tech_preference" | "offer_summary",
    "targetField": string,
    "reasoning": string,
    "question": string,
    "readyForSummary": boolean
  }

  reasoning: One or two sentences explaining WHICH proposal-blocking gap this question addresses and WHY this field is the highest priority right now.
  question: The actual question to show the client. Must follow all quality rules above.
  readyForSummary: true ONLY when completenessScore >= 75 AND no unresolved contradictions AND budget range is known.

  Return ONLY valid JSON. No explanation, no markdown, no code blocks.`
  }

  /**
   * Build the user prompt for L4 discovery.
   * Surfaces uncertain fields to prevent L4 from re-asking about them.
   */
  export function buildDiscoveryUserPrompt(
    state: ProjectRequirementState,
    understanding: SemanticUnderstanding,
    extraction: ExtractionResult
  ): string {
    const compact = compactStateForPrompt(state as unknown as Record<string, unknown>)

    const newlyExtracted = extraction.features.length > 0
      ? `\nJust extracted this turn: ${extraction.features.map(f => f.canonicalId).join(', ')}`
      : ''

    const contradictionsSection = state.contradictions.length > 0
      ? `\nUnresolved contradictions:\n${state.contradictions.map(c => `  - ${c.field}: "${c.existingFact}" vs "${c.newStatement}"`).join('\n')}`
      : ''

    // Extract fields the client expressed uncertainty about — L4 must skip these
    const uncertainFields = understanding.keyEntities
      .filter(e => e.type === 'constraint' && e.value.startsWith('uncertain:'))
      .map(e => e.value.replace('uncertain: ', '').trim())
    const uncertainSection = uncertainFields.length > 0
      ? `\nClient expressed uncertainty about: ${uncertainFields.join(', ')} — do NOT ask about these fields again`
      : ''

    const urgencySection = understanding.urgencySignals.length > 0
      ? `\nUrgency signals: ${understanding.urgencySignals.join(', ')}`
      : ''

    return `CURRENT PROJECT STATE:
  ${compact}
  ${newlyExtracted}
  ${contradictionsSection}
  ${uncertainSection}
  ${urgencySection}
  Completeness score: ${state.completenessScore}%
  Client's current intent: ${understanding.semanticIntent}

  What is the single most valuable question to ask next to unblock the proposal?`
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- src/prompts/discovery.test.ts
  ```
  Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

  ```bash
  git add src/prompts/discovery.ts src/prompts/discovery.test.ts
  git commit -m "feat: add L4 discovery prompt builders — architect-level question strategy with GOOD/BAD examples + uncertainty handling"
  ```

---

### Task 18: L4 discovery pipeline runner

**Files:**
- Create: `dealghost/ai-service/src/pipeline/l4-discovery.ts`
- Create: `dealghost/ai-service/src/pipeline/l4-discovery.test.ts`

- [ ] **Step 1: Write failing tests for L4 runner**

  Create `dealghost/ai-service/src/pipeline/l4-discovery.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from 'vitest'
  import { createEmptyState } from '@dealghost/shared'
  import type { SemanticUnderstanding, ExtractionResult } from '@dealghost/shared'

  const emptyUnderstanding: SemanticUnderstanding = {
    semanticIntent: 'adding', businessDomain: 'software',
    keyEntities: [], corrections: [], contradictions: [],
    workflowsDescribed: [], urgencySignals: [], businessModelHints: [],
    confidenceInUnderstanding: 0.8,
  }

  const emptyExtraction: ExtractionResult = {
    features: [], integrations: [], platforms: [],
    authRequirements: null, realtimeRequirements: null, adminPanelRequirements: null,
    targetUsers: null, userScale: null, businessModel: null, timelineExpectation: null,
    budgetRange: null, clientTechPreferences: null, compliance: [], technicalConstraints: null,
    workflows: [], userRoles: [], featuresToRemove: [], assumptions: [], newCanonicalEntries: [],
  }

  vi.mock('../models/claude.js', () => ({
    callClaudeJSON: vi.fn().mockImplementation((_opts, parse) =>
      Promise.resolve(parse(JSON.stringify({
        strategy: 'clarify_scope',
        targetField: 'projectType',
        reasoning: 'No project type established — blocks all sizing and architecture decisions.',
        question: 'What type of product are you building — a mobile app, a web platform, or something else?',
        readyForSummary: false,
      })))
    ),
  }))

  describe('runL4Discovery', () => {
    it('returns a DiscoveryResult with a non-empty question', async () => {
      const { runL4Discovery } = await import('./l4-discovery.js')
      const result = await runL4Discovery({
        state: createEmptyState('test-conv'),
        understanding: emptyUnderstanding,
        extraction: emptyExtraction,
      })
      expect(result.question.length).toBeGreaterThan(10)
    })

    it('returns a valid strategy', async () => {
      const { runL4Discovery } = await import('./l4-discovery.js')
      const result = await runL4Discovery({
        state: createEmptyState('test-conv'),
        understanding: emptyUnderstanding,
        extraction: emptyExtraction,
      })
      const validStrategies = ['clarify_scope', 'probe_complexity', 'resolve_contradiction', 'confirm_assumption', 'discover_workflow', 'ask_tech_preference', 'offer_summary']
      expect(validStrategies).toContain(result.strategy)
    })

    it('returns non-empty reasoning', async () => {
      const { runL4Discovery } = await import('./l4-discovery.js')
      const result = await runL4Discovery({
        state: createEmptyState('test-conv'),
        understanding: emptyUnderstanding,
        extraction: emptyExtraction,
      })
      expect(result.reasoning.length).toBeGreaterThan(10)
    })

    it('throws Zod error if Claude returns empty question', async () => {
      const { callClaudeJSON } = await import('../models/claude.js')
      vi.mocked(callClaudeJSON).mockImplementationOnce((_opts, parse) =>
        Promise.resolve(parse(JSON.stringify({
          strategy: 'clarify_scope', targetField: 'projectType',
          reasoning: 'some reasoning', question: '', readyForSummary: false,
        })))
      )
      const { runL4Discovery } = await import('./l4-discovery.js')
      await expect(
        runL4Discovery({ state: createEmptyState('test-conv'), understanding: emptyUnderstanding, extraction: emptyExtraction })
      ).rejects.toThrow()
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- src/pipeline/l4-discovery.test.ts
  ```
  Expected: FAIL — `Cannot find module './l4-discovery.js'`

- [ ] **Step 3: Create `pipeline/l4-discovery.ts`**

  Create `dealghost/ai-service/src/pipeline/l4-discovery.ts`:
  ```typescript
  import { z } from 'zod'
  import { callClaudeJSON } from '../models/claude.js'
  import { buildDiscoverySystemPrompt, buildDiscoveryUserPrompt } from '../prompts/discovery.js'
  import type {
    DiscoveryResult, ProjectRequirementState,
    SemanticUnderstanding, ExtractionResult,
  } from '@dealghost/shared'

  export interface L4Input {
    state: ProjectRequirementState
    understanding: SemanticUnderstanding
    extraction: ExtractionResult
  }

  const DiscoveryResultSchema = z.object({
    strategy: z.enum([
      'clarify_scope', 'probe_complexity', 'resolve_contradiction',
      'confirm_assumption', 'discover_workflow', 'ask_tech_preference', 'offer_summary',
    ]),
    targetField: z.string().min(1),
    reasoning: z.string().min(10),  // enforce non-trivial reasoning
    question: z.string().min(10),   // enforce non-empty question
    readyForSummary: z.boolean().default(false),
  })

  // Cache system prompt at module level — static content, safe for Anthropic prompt caching
  const SYSTEM_PROMPT = buildDiscoverySystemPrompt()

  export async function runL4Discovery(input: L4Input): Promise<DiscoveryResult> {
    const userPrompt = buildDiscoveryUserPrompt(input.state, input.understanding, input.extraction)

    return callClaudeJSON(
      {
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 600,
        temperature: 0.3, // slight variation for natural question phrasing
        cacheSystemPrompt: true,
      },
      (raw) => DiscoveryResultSchema.parse(JSON.parse(raw)) as DiscoveryResult
    )
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- src/pipeline/l4-discovery.test.ts
  ```
  Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

  ```bash
  git add src/pipeline/l4-discovery.ts src/pipeline/l4-discovery.test.ts
  git commit -m "feat: add L4 discovery pipeline runner — architect-quality follow-up questions with Zod enforcement"
  ```

---

### Task 19: L5 lead scoring prompt builders

**Files:**
- Create: `dealghost/ai-service/src/prompts/scoring.ts`
- Create: `dealghost/ai-service/src/prompts/scoring.test.ts`

- [ ] **Step 1: Write failing tests for scoring prompt builders**

  Create `dealghost/ai-service/src/prompts/scoring.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { buildScoringSystemPrompt, buildScoringUserPrompt } from './scoring.js'
  import { createEmptyState } from '@dealghost/shared'
  import type { SemanticUnderstanding } from '@dealghost/shared'

  const emptyUnderstanding: SemanticUnderstanding = {
    semanticIntent: 'adding', businessDomain: 'software',
    keyEntities: [], corrections: [], contradictions: [],
    workflowsDescribed: [], urgencySignals: [], businessModelHints: [],
    confidenceInUnderstanding: 0.8,
  }

  describe('buildScoringSystemPrompt', () => {
    it('contains all 7 scoring dimension names', () => {
      const prompt = buildScoringSystemPrompt()
      for (const dim of ['businessMaturity', 'projectClarity', 'budgetRealism', 'urgencyAndIntent', 'engagementDepth', 'technicalFeasibility', 'commercialFit']) {
        expect(prompt).toContain(dim)
      }
    })

    it('contains FlowZint pricing tiers', () => {
      const prompt = buildScoringSystemPrompt()
      expect(prompt).toContain('₹')
    })

    it('contains evidence requirement instructions', () => {
      const prompt = buildScoringSystemPrompt()
      // Verify the prompt enforces evidence-based scoring, not MBA fluff
      expect(prompt).toContain('cite')
      expect(prompt).toContain('evidence')
      expect(prompt).toContain('WRONG:')
      expect(prompt).toContain('RIGHT:')
    })

    it('contains all label values', () => {
      const prompt = buildScoringSystemPrompt()
      for (const label of ['High Intent Lead', 'Qualified Prospect', 'Needs Nurturing', 'Low Qualification', 'Unqualified']) {
        expect(prompt).toContain(label)
      }
    })
  })

  describe('buildScoringUserPrompt', () => {
    it('includes feature count', () => {
      const state = createEmptyState('test-conv')
      const prompt = buildScoringUserPrompt(state, emptyUnderstanding)
      expect(prompt).toContain('Feature count: 0')
    })

    it('includes urgency signals when present', () => {
      const understanding: SemanticUnderstanding = {
        ...emptyUnderstanding,
        urgencySignals: ['must launch before Q3'],
      }
      const prompt = buildScoringUserPrompt(createEmptyState('test-conv'), understanding)
      expect(prompt).toContain('must launch before Q3')
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- src/prompts/scoring.test.ts
  ```
  Expected: FAIL — `Cannot find module './scoring.js'`

- [ ] **Step 3: Create `prompts/scoring.ts`**

  Create `dealghost/ai-service/src/prompts/scoring.ts`:
  ```typescript
  import type { ProjectRequirementState, SemanticUnderstanding } from '@dealghost/shared'
  import { compactStateForPrompt } from './extraction.js'
  import { PRICING_TIERS, formatInrAmount } from '../knowledge/company-profile.js'

  /**
   * Build the L5 lead scoring system prompt.
   * Includes FlowZint pricing tiers and enforces evidence-grounded scoring
   * to prevent generic "MBA fluff" narratives.
   */
  export function buildScoringSystemPrompt(): string {
    const pricingContext = Object.entries(PRICING_TIERS)
      .map(([, t]) => `${t.label}: ${formatInrAmount(t.inrMin)}–${t.inrMax ? formatInrAmount(t.inrMax) : '∞'} — ${t.description}`)
      .join('\n')

    return `You are a senior pre-sales lead scorer at FlowZint Technologies.

  Score this prospect across 7 business dimensions. Think like a sales director evaluating whether this opportunity is worth investing time in.

  ## FlowZint pricing reference (use for budgetRealism scoring):
  ${pricingContext}

  ## Scoring dimensions (max 100 total):
  - businessMaturity (0–15): Does the client have a clear business model, defined target users, and a commercial plan?
  - projectClarity (0–15): How well-defined are the requirements, scope, and features?
  - budgetRealism (0–15): Is the budget realistic for what they're describing? No budget = max 5. Budget matches FlowZint tier = higher.
  - urgencyAndIntent (0–15): Urgency signals, decisive language, clear deadline = higher. Vague and exploratory = lower.
  - engagementDepth (0–15): Are they giving detailed answers with context, or one-line vague responses?
  - technicalFeasibility (0–15): Can FlowZint build what they're asking? Is the scope technically coherent?
  - commercialFit (0–10): Does this project type match FlowZint's core services and strengths?

  ## Score labels:
  - 85–100: "High Intent Lead"
  - 70–84: "Qualified Prospect"
  - 50–69: "Needs Nurturing"
  - 30–49: "Low Qualification"
  - 0–29: "Unqualified"

  ## CRITICAL — Evidence requirement:
  The narrative MUST cite specific facts extracted from the project state.
  Never write generic statements. Every dimension score must be traceable to a fact.

  WRONG: "The client shows strong business maturity."
  RIGHT: "businessMaturity 12/15 — client defined a B2C marketplace model with 3 explicit user roles (buyer, seller, admin), though competitive differentiation is not yet stated."

  WRONG: "Budget realism is uncertain."
  RIGHT: "budgetRealism 4/15 — no budget mentioned. For the described 4-feature mobile app, FlowZint Standard tier (₹8L–₹30L) applies; without a budget anchor, commercial viability is unconfirmed."

  Return ONLY valid JSON:
  {
    "score": number,
    "label": "High Intent Lead" | "Qualified Prospect" | "Needs Nurturing" | "Low Qualification" | "Unqualified",
    "breakdown": {
      "businessMaturity": number,
      "projectClarity": number,
      "budgetRealism": number,
      "urgencyAndIntent": number,
      "engagementDepth": number,
      "technicalFeasibility": number,
      "commercialFit": number
    },
    "narrative": string
  }

  Return ONLY valid JSON. No explanation, no markdown, no code blocks.`
  }

  /**
   * Build the user prompt for L5 lead scoring.
   */
  export function buildScoringUserPrompt(
    state: ProjectRequirementState,
    understanding: SemanticUnderstanding
  ): string {
    const compact = compactStateForPrompt(state as unknown as Record<string, unknown>)
    const urgency = understanding.urgencySignals.length > 0
      ? `\nUrgency signals observed this turn: ${understanding.urgencySignals.join(', ')}`
      : ''
    const businessHints = understanding.businessModelHints.length > 0
      ? `\nBusiness model hints: ${understanding.businessModelHints.join(', ')}`
      : ''

    return `PROJECT STATE:
  ${compact}

  Feature count: ${state.features.length}
  Completeness: ${state.completenessScore}%
  ${urgency}
  ${businessHints}

  Score this lead. Every dimension score must cite evidence from the state above.`
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- src/prompts/scoring.test.ts
  ```
  Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

  ```bash
  git add src/prompts/scoring.ts src/prompts/scoring.test.ts
  git commit -m "feat: add L5 scoring prompt builders — evidence-grounded lead scoring with FlowZint pricing context"
  ```

---

### Task 20: L5 lead scoring pipeline runner

**Files:**
- Create: `dealghost/ai-service/src/pipeline/l5-scoring.ts`
- Create: `dealghost/ai-service/src/pipeline/l5-scoring.test.ts`

- [ ] **Step 1: Write failing tests for L5 runner**

  Create `dealghost/ai-service/src/pipeline/l5-scoring.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from 'vitest'
  import { createEmptyState } from '@dealghost/shared'
  import type { SemanticUnderstanding } from '@dealghost/shared'

  const emptyUnderstanding: SemanticUnderstanding = {
    semanticIntent: 'adding', businessDomain: 'software',
    keyEntities: [], corrections: [], contradictions: [],
    workflowsDescribed: [], urgencySignals: [], businessModelHints: [],
    confidenceInUnderstanding: 0.8,
  }

  vi.mock('../models/claude.js', () => ({
    callClaudeJSON: vi.fn().mockImplementation((_opts, parse) =>
      Promise.resolve(parse(JSON.stringify({
        score: 38,
        label: 'Low Qualification',
        breakdown: {
          businessMaturity: 5, projectClarity: 4, budgetRealism: 3,
          urgencyAndIntent: 6, engagementDepth: 8, technicalFeasibility: 8, commercialFit: 4,
        },
        narrative: 'projectClarity 4/15 — no features described yet. budgetRealism 3/15 — no budget mentioned; Standard tier (₹8L–₹30L) is likely. engagementDepth 8/15 — client provided meaningful initial context.',
      })))
    ),
  }))

  describe('runL5Scoring', () => {
    it('returns a LeadScore with score in 0–100 range', async () => {
      const { runL5Scoring } = await import('./l5-scoring.js')
      const result = await runL5Scoring({ state: createEmptyState('test-conv'), understanding: emptyUnderstanding })
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('returns a valid label', async () => {
      const { runL5Scoring } = await import('./l5-scoring.js')
      const result = await runL5Scoring({ state: createEmptyState('test-conv'), understanding: emptyUnderstanding })
      const validLabels = ['High Intent Lead', 'Qualified Prospect', 'Needs Nurturing', 'Low Qualification', 'Unqualified']
      expect(validLabels).toContain(result.label)
    })

    it('returns a non-trivial narrative (>20 chars)', async () => {
      const { runL5Scoring } = await import('./l5-scoring.js')
      const result = await runL5Scoring({ state: createEmptyState('test-conv'), understanding: emptyUnderstanding })
      expect(result.narrative.length).toBeGreaterThan(20)
    })

    it('breakdown dimensions stay within their max values', async () => {
      const { runL5Scoring } = await import('./l5-scoring.js')
      const result = await runL5Scoring({ state: createEmptyState('test-conv'), understanding: emptyUnderstanding })
      expect(result.breakdown.businessMaturity).toBeLessThanOrEqual(15)
      expect(result.breakdown.projectClarity).toBeLessThanOrEqual(15)
      expect(result.breakdown.commercialFit).toBeLessThanOrEqual(10)
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- src/pipeline/l5-scoring.test.ts
  ```
  Expected: FAIL — `Cannot find module './l5-scoring.js'`

- [ ] **Step 3: Create `pipeline/l5-scoring.ts`**

  Create `dealghost/ai-service/src/pipeline/l5-scoring.ts`:
  ```typescript
  import { z } from 'zod'
  import { callClaudeJSON } from '../models/claude.js'
  import { buildScoringSystemPrompt, buildScoringUserPrompt } from '../prompts/scoring.js'
  import type { LeadScore, ProjectRequirementState, SemanticUnderstanding } from '@dealghost/shared'

  export interface L5Input {
    state: ProjectRequirementState
    understanding: SemanticUnderstanding
  }

  const LeadScoreSchema = z.object({
    score: z.number().min(0).max(100),
    label: z.enum([
      'High Intent Lead', 'Qualified Prospect', 'Needs Nurturing',
      'Low Qualification', 'Unqualified',
    ]),
    breakdown: z.object({
      businessMaturity: z.number().min(0).max(15),
      projectClarity: z.number().min(0).max(15),
      budgetRealism: z.number().min(0).max(15),
      urgencyAndIntent: z.number().min(0).max(15),
      engagementDepth: z.number().min(0).max(15),
      technicalFeasibility: z.number().min(0).max(15),
      commercialFit: z.number().min(0).max(10),
    }),
    narrative: z.string().min(20), // enforce non-trivial narrative
  })

  // Cache system prompt at module level
  const SYSTEM_PROMPT = buildScoringSystemPrompt()

  export async function runL5Scoring(input: L5Input): Promise<LeadScore> {
    const userPrompt = buildScoringUserPrompt(input.state, input.understanding)

    return callClaudeJSON(
      {
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 700,
        temperature: 0.1,
        cacheSystemPrompt: true,
      },
      (raw) => LeadScoreSchema.parse(JSON.parse(raw)) as LeadScore
    )
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- src/pipeline/l5-scoring.test.ts
  ```
  Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

  ```bash
  git add src/pipeline/l5-scoring.ts src/pipeline/l5-scoring.test.ts
  git commit -m "feat: add L5 lead scoring pipeline runner — 7-dimension business reasoning with Zod enforcement"
  ```

---

### Task 21: Rolling conversation memory

**Files:**
- Create: `dealghost/ai-service/src/state/memory.ts`
- Create: `dealghost/ai-service/src/state/memory.test.ts`

- [ ] **Step 1: Write failing tests for memory module**

  Create `dealghost/ai-service/src/state/memory.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from 'vitest'
  import { shouldCompress, buildContextHistory, MEMORY_COMPRESSION_THRESHOLD } from './memory.js'
  import { createEmptyState } from '@dealghost/shared'

  vi.mock('../models/claude.js', () => ({
    callClaude: vi.fn().mockResolvedValue('Client wants a food delivery app with GPS tracking. They need iOS and Android. No budget mentioned yet.'),
  }))

  describe('shouldCompress', () => {
    it('returns false at threshold', () => {
      expect(shouldCompress(MEMORY_COMPRESSION_THRESHOLD)).toBe(false)
    })

    it('returns true above threshold', () => {
      expect(shouldCompress(MEMORY_COMPRESSION_THRESHOLD + 1)).toBe(true)
    })

    it('returns false for early conversations', () => {
      expect(shouldCompress(3)).toBe(false)
    })
  })

  describe('buildContextHistory', () => {
    const messages = [
      { role: 'user', content: 'Message 1' },
      { role: 'assistant', content: 'Reply 1' },
      { role: 'user', content: 'Message 2' },
      { role: 'assistant', content: 'Reply 2' },
      { role: 'user', content: 'Message 3' },
      { role: 'assistant', content: 'Reply 3' },
      { role: 'user', content: 'Message 4' },
      { role: 'assistant', content: 'Reply 4' },
      { role: 'user', content: 'Message 5' },
    ]

    it('returns plain history when no summary provided', () => {
      const result = buildContextHistory(messages, null)
      expect(result).not.toContain('[CONVERSATION CONTEXT SUMMARY]')
      expect(result).toContain('USER: Message 5')
    })

    it('prepends summary when provided', () => {
      const result = buildContextHistory(messages, 'Client wants a delivery app.')
      expect(result).toContain('[CONVERSATION CONTEXT SUMMARY]')
      expect(result).toContain('Client wants a delivery app.')
      expect(result).toContain('[RECENT MESSAGES]')
    })

    it('only includes last 6 messages by default', () => {
      const result = buildContextHistory(messages, null)
      // Message 1 is 9 messages ago — should be cut off with keepLastN=6
      expect(result).not.toContain('Message 1')
      expect(result).toContain('Message 5')
    })

    it('respects custom keepLastN', () => {
      const result = buildContextHistory(messages, null, 2)
      expect(result).not.toContain('Message 3')
      expect(result).toContain('Message 5')
    })
  })

  describe('compressHistory', () => {
    it('calls Claude and returns a non-empty string', async () => {
      const { compressHistory } = await import('./memory.js')
      const messages = [
        { role: 'user', content: 'I need a delivery app' },
        { role: 'assistant', content: 'What kind of delivery?' },
      ]
      const result = await compressHistory(messages, createEmptyState('test-conv'))
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- src/state/memory.test.ts
  ```
  Expected: FAIL — `Cannot find module './memory.js'`

- [ ] **Step 3: Create `state/memory.ts`**

  Create `dealghost/ai-service/src/state/memory.ts`:
  ```typescript
  import { callClaude } from '../models/claude.js'
  import type { ProjectRequirementState } from '@dealghost/shared'

  /**
   * Conversations with more than this many messages get their history compressed.
   * Keeps token usage stable for long conversations.
   */
  export const MEMORY_COMPRESSION_THRESHOLD = 8

  /**
   * Returns true when the conversation is long enough to warrant memory compression.
   */
  export function shouldCompress(messageCount: number): boolean {
    return messageCount > MEMORY_COMPRESSION_THRESHOLD
  }

  /**
   * Compresses a conversation history into a dense narrative summary using Claude.
   *
   * IMPORTANT ARCHITECTURAL BOUNDARY:
   * The summary captures conversational CONTEXT only — how the client described their idea,
   * their tone, corrections they made, and reasoning context. It does NOT re-encode
   * structured facts (features, budget, platforms, constraints) because those live in
   * ProjectRequirementState and are passed directly to every pipeline layer.
   * The summary supports conversational continuity. It is NOT a source of truth.
   */
  export async function compressHistory(
    messages: Array<{ role: string; content: string }>,
    currentState: ProjectRequirementState
  ): Promise<string> {
    const conversationText = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n')

    const knownFeatures = currentState.features.map(f => f.canonicalId).join(', ') || 'none yet'

    const systemPrompt = `You are a conversation summarizer for a pre-sales software discovery system.

  Write a compact narrative summary of the conversation FLOW — the reasoning, clarifications, and discussion context.

  ## INCLUDE in the summary:
  - How the client described their idea (their language, framing, emphasis)
  - Clarifications they gave when asked follow-up questions
  - Tone, urgency, and level of technical confidence they showed
  - Corrections or changes they made during the conversation
  - Context that explains WHY they want certain things

  ## EXCLUDE from the summary (these are already in structured state — do not repeat):
  - Feature lists (already in state.features)
  - Platform choices (already in state.platforms)
  - Budget numbers (already in state.budgetRange)
  - Timeline details (already in state.timelineExpectation)
  - Any data already captured as structured fields

  Max 250 words. Dense prose, no bullet points.`

    const userPrompt = `STRUCTURED STATE ALREADY CAPTURED (do not re-encode these):
  Features: ${knownFeatures}
  Platforms: ${currentState.platforms.join(', ') || 'none'}
  Budget: ${currentState.budgetRange.min ?? 'unknown'}–${currentState.budgetRange.max ?? 'unknown'} ${currentState.budgetRange.currency}

  CONVERSATION TO SUMMARIZE:
  ${conversationText}

  Write the conversational context summary now. Do not list features or repeat structured data.`

    return callClaude({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 350,
      temperature: 0.1,
    })
  }

  /**
   * Builds the context history string to pass to pipeline layers.
   * When a summary exists, it is prepended before recent messages.
   * Only the last `keepLastN` raw messages are included as full text.
   * This holds token usage stable after turn 8.
   */
  export function buildContextHistory(
    allMessages: Array<{ role: string; content: string }>,
    summary: string | null,
    keepLastN: number = 6
  ): string {
    const recent = allMessages.slice(-keepLastN)
    const recentText = recent.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')

    if (summary) {
      return `[CONVERSATION CONTEXT SUMMARY]\n${summary}\n\n[RECENT MESSAGES]\n${recentText}`
    }
    return recentText
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- src/state/memory.test.ts
  ```
  Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

  ```bash
  git add src/state/memory.ts src/state/memory.test.ts
  git commit -m "feat: add rolling conversation memory — compression after turn 8, structured state excluded from summary"
  ```

---

### Task 22: Update `state/manager.ts` — Option B intent-aware merge

**Files:**
- Modify: `dealghost/ai-service/src/state/manager.ts`
- Modify: `dealghost/ai-service/src/state/manager.test.ts`

This adds an optional `understanding` parameter to `mergeExtractionIntoState`. When L1 detects `semanticIntent = "correcting"`, array fields listed in `corrections` use **replacement** instead of union. When intent is `"removing"`, `"questioning"`, or `"confirming"`, new feature additions are suppressed. Existing callers without the third argument are unaffected (backward compatible).

- [ ] **Step 1: Add intent-aware merge tests to `manager.test.ts`**

  Open `dealghost/ai-service/src/state/manager.test.ts` and add these tests to the existing `describe('mergeExtractionIntoState')` block:
  ```typescript
  // Add this import at the top of the test file:
  import type { SemanticUnderstanding } from '@dealghost/shared'

  // Add this helper at the top of the test file (after emptyExtraction):
  const baseUnderstanding: SemanticUnderstanding = {
    semanticIntent: 'adding', businessDomain: 'software',
    keyEntities: [], corrections: [], contradictions: [],
    workflowsDescribed: [], urgencySignals: [], businessModelHints: [],
    confidenceInUnderstanding: 0.8,
  }

  // Add inside describe('mergeExtractionIntoState'):

  it('replaces platforms (not union) when semanticIntent is "correcting" and platforms in corrections', () => {
    const state = { ...createEmptyState('conv-test'), platforms: ['iOS', 'Android'] }
    const extraction: ExtractionResult = { ...emptyExtraction, platforms: ['iOS'] }
    const understanding: SemanticUnderstanding = {
      ...baseUnderstanding,
      semanticIntent: 'correcting',
      corrections: [{ field: 'platforms', oldValue: 'iOS, Android', newValue: 'iOS' }],
    }
    const result = mergeExtractionIntoState(state, extraction, understanding)
    expect(result.platforms).toEqual(['iOS'])
    expect(result.platforms).not.toContain('Android')
  })

  it('suppresses new feature additions when semanticIntent is "removing"', () => {
    const state = {
      ...createEmptyState('conv-test'),
      features: [{
        canonicalId: 'user_auth', rawText: 'login', confidence: 0.95,
        category: 'auth', priority: 'MUST' as const, isConfirmed: true, dependencies: [],
      }],
    }
    const extraction: ExtractionResult = {
      ...emptyExtraction,
      features: [{
        canonicalId: 'payment_processing', rawText: 'payments', confidence: 0.9,
        category: 'payments', priority: 'MUST' as const, isConfirmed: true, dependencies: [],
      }],
    }
    const understanding: SemanticUnderstanding = { ...baseUnderstanding, semanticIntent: 'removing' }
    const result = mergeExtractionIntoState(state, extraction, understanding)
    // user_auth should remain; payment_processing should NOT be added
    expect(result.features.find(f => f.canonicalId === 'user_auth')).toBeDefined()
    expect(result.features.find(f => f.canonicalId === 'payment_processing')).toBeUndefined()
  })

  it('still processes featuresToRemove even when semanticIntent is "removing"', () => {
    const state = {
      ...createEmptyState('conv-test'),
      features: [{
        canonicalId: 'realtime_delivery_tracking', rawText: 'tracking', confidence: 0.9,
        category: 'logistics', priority: 'MUST' as const, isConfirmed: true, dependencies: [],
      }],
    }
    const extraction: ExtractionResult = {
      ...emptyExtraction,
      featuresToRemove: ['realtime_delivery_tracking'],
    }
    const understanding: SemanticUnderstanding = { ...baseUnderstanding, semanticIntent: 'removing' }
    const result = mergeExtractionIntoState(state, extraction, understanding)
    expect(result.features.find(f => f.canonicalId === 'realtime_delivery_tracking')).toBeUndefined()
  })

  it('performs union merge as before when no understanding provided (backward compatible)', () => {
    const state = { ...createEmptyState('conv-test'), platforms: ['iOS'] }
    const extraction: ExtractionResult = { ...emptyExtraction, platforms: ['Android'] }
    const result = mergeExtractionIntoState(state, extraction) // no third arg
    expect(result.platforms).toContain('iOS')
    expect(result.platforms).toContain('Android')
  })
  ```

- [ ] **Step 2: Run tests to confirm new tests fail**

  ```bash
  npm test -- src/state/manager.test.ts
  ```
  Expected: The 4 new tests FAIL (the existing 8 tests still pass)

- [ ] **Step 3: Update `state/manager.ts` — add intent-aware merge**

  Open `dealghost/ai-service/src/state/manager.ts` and make two targeted changes:

  **Change 1** — Add `SemanticUnderstanding` import (add to the existing import line at the top):
  ```typescript
  // BEFORE:
  import type { ProjectRequirementState, ExtractionResult } from '@dealghost/shared'

  // AFTER:
  import type { ProjectRequirementState, ExtractionResult, SemanticUnderstanding } from '@dealghost/shared'
  ```

  **Change 2** — Update the `mergeExtractionIntoState` function signature and add intent-aware logic. Replace the entire function with:
  ```typescript
  /**
   * Merge an ExtractionResult into the current ProjectRequirementState.
   * Returns a new state object — does not mutate the input.
   *
   * Option B intent-aware merge:
   * When `understanding` is provided, the merge strategy adapts based on L1 semantic intent:
   * - "correcting" + field in corrections → REPLACE array field (not union)
   * - "removing" | "questioning" | "confirming" → suppress new feature additions
   * Removals via `featuresToRemove` are always processed regardless of intent.
   * Without `understanding`, behavior is identical to Phase 2 (backward compatible).
   */
  export function mergeExtractionIntoState(
    current: ProjectRequirementState,
    extraction: ExtractionResult,
    understanding?: SemanticUnderstanding
  ): ProjectRequirementState {
    const updated: ProjectRequirementState = { ...current }

    // ── Derive intent context ─────────────────────────────────────────────────
    const correctedFields = new Set(understanding?.corrections.map(c => c.field) ?? [])
    const suppressFeatureAdd =
      understanding?.semanticIntent === 'removing' ||
      understanding?.semanticIntent === 'questioning' ||
      understanding?.semanticIntent === 'confirming'

    // ── Features: dedup by canonicalId, keep higher confidence ───────────────
    // When intent suppresses additions, start from current features only
    const featureMap = new Map(current.features.map((f) => [f.canonicalId, f]))

    if (!suppressFeatureAdd) {
      for (const f of extraction.features) {
        if (extraction.featuresToRemove.includes(f.canonicalId)) continue
        const existing = featureMap.get(f.canonicalId)
        if (existing) {
          featureMap.set(f.canonicalId, f.confidence > existing.confidence ? f : existing)
        } else {
          featureMap.set(f.canonicalId, f)
        }
      }
    }

    // Always process removals — regardless of intent
    for (const id of extraction.featuresToRemove) {
      featureMap.delete(id)
    }
    updated.features = Array.from(featureMap.values())

    // ── Scalar fields: only overwrite if new value is non-null ────────────────
    if (extraction.targetUsers) updated.targetUsers = extraction.targetUsers
    if (extraction.userScale) updated.userScale = extraction.userScale
    if (extraction.businessModel) updated.businessModel = extraction.businessModel
    if (extraction.timelineExpectation) updated.timelineExpectation = extraction.timelineExpectation
    if (extraction.budgetRange) updated.budgetRange = extraction.budgetRange
    if (extraction.authRequirements) updated.authRequirements = extraction.authRequirements
    if (extraction.realtimeRequirements) updated.realtimeRequirements = extraction.realtimeRequirements
    if (extraction.adminPanelRequirements) updated.adminPanelRequirements = extraction.adminPanelRequirements
    if (extraction.technicalConstraints) updated.technicalConstraints = extraction.technicalConstraints
    if (extraction.clientTechPreferences) updated.clientTechPreferences = extraction.clientTechPreferences

    // ── Arrays: replace when correcting that field, else merge + deduplicate ──
    if (extraction.platforms.length > 0) {
      updated.platforms = correctedFields.has('platforms')
        ? extraction.platforms                                         // REPLACE
        : [...new Set([...current.platforms, ...extraction.platforms])] // UNION
    }
    if (extraction.integrations.length > 0) {
      updated.integrations = [...new Set([...current.integrations, ...extraction.integrations])]
    }
    if (extraction.compliance.length > 0) {
      updated.compliance = [...new Set([...current.compliance, ...extraction.compliance])]
    }

    // ── Workflows: merge by name ──────────────────────────────────────────────
    if (extraction.workflows.length > 0) {
      const existingNames = new Set(current.workflows.map((w) => w.name))
      const newWorkflows = extraction.workflows.filter((w) => !existingNames.has(w.name))
      updated.workflows = [...current.workflows, ...newWorkflows]
    }

    // ── User roles: merge by name ─────────────────────────────────────────────
    if (extraction.userRoles.length > 0) {
      const existingNames = new Set(current.userRoles.map((r) => r.name))
      const newRoles = extraction.userRoles.filter((r) => !existingNames.has(r.name))
      updated.userRoles = [...current.userRoles, ...newRoles]
    }

    // ── Assumptions: merge without duplicates ─────────────────────────────────
    if (extraction.assumptions.length > 0) {
      const existingSet = new Set(current.assumptions)
      const newAssumptions = extraction.assumptions.filter((a) => !existingSet.has(a))
      updated.assumptions = [...current.assumptions, ...newAssumptions]
    }

    // ── Update field confidence ───────────────────────────────────────────────
    updated.fieldConfidence = updateFieldConfidence(current.fieldConfidence, extraction)

    // ── Recalculate completeness ──────────────────────────────────────────────
    updated.completenessScore = calculateCompleteness(updated)

    return updated
  }
  ```

- [ ] **Step 4: Run all manager tests to confirm they pass**

  ```bash
  npm test -- src/state/manager.test.ts
  ```
  Expected: PASS — all 12 tests passing (8 original + 4 new intent-aware tests)

- [ ] **Step 5: Commit**

  ```bash
  git add src/state/manager.ts src/state/manager.test.ts
  git commit -m "feat: Option B intent-aware L3 merge — correcting=replace, removing=suppress additions, always process removals"
  ```

---

### Task 23: Pipeline orchestrator

**Files:**
- Create: `dealghost/ai-service/src/pipeline/orchestrator.ts`

- [ ] **Step 1: Create `pipeline/orchestrator.ts`**

  Create `dealghost/ai-service/src/pipeline/orchestrator.ts`:
  ```typescript
  import type {
    SemanticUnderstanding, ExtractionResult,
    DiscoveryResult, LeadScore, ProjectRequirementState,
  } from '@dealghost/shared'
  import { callGroqIntent } from '../models/groq.js'
  import { runL1Understanding } from './l1-understanding.js'
  import { runL2Extraction } from './l2-extraction.js'
  import { mergeExtractionIntoState } from '../state/manager.js'
  import { runL4Discovery } from './l4-discovery.js'
  import { runL5Scoring } from './l5-scoring.js'
  import { shouldCompress, compressHistory, buildContextHistory } from '../state/memory.js'
  import type { DiscoveryStrategy } from '@dealghost/shared'

  export interface PipelineInput {
    message: string
    conversationHistory: string
    currentState: ProjectRequirementState
    messageCount: number
    allMessages: Array<{ role: string; content: string }>
  }

  export interface PipelineOutput {
    responseMessage: string
    updatedState: ProjectRequirementState
    intent: string
    understanding: SemanticUnderstanding
    extraction: ExtractionResult
    discovery: DiscoveryResult
    leadScore: LeadScore
    readyForProposal: boolean
  }

  export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
    const { message, currentState, messageCount, allMessages } = input

    // ── Pre-flight: Groq intent classification (fast ~200ms, cheap) ────────────
    const intent = await callGroqIntent(message, input.conversationHistory)

    // ── Memory: compress history when turns > threshold ────────────────────────
    let contextHistory = input.conversationHistory
    let updatedSummary = currentState.conversationSummary

    if (shouldCompress(messageCount)) {
      updatedSummary = await compressHistory(allMessages, currentState)
      contextHistory = buildContextHistory(allMessages, updatedSummary)
    }

    // ── L1 + L2: parallel ─────────────────────────────────────────────────────
    // L1: semantic understanding — intent, corrections, contradictions, uncertainty
    // L2: structured extraction — features, platforms, budget, constraints
    // Both see the same message. L3 resolves any divergence using L1 as authority.
    const [understanding, extraction] = await Promise.all([
      runL1Understanding({
        latestMessage: message,
        conversationHistory: contextHistory,
        currentState,
      }),
      runL2Extraction({
        latestMessage: message,
        conversationHistory: contextHistory,
        currentState,
      }),
    ])

    // ── L3: intent-aware state merge (Option B) ────────────────────────────────
    // understanding passed in — merge uses replace vs. union based on semanticIntent.
    // "correcting" + field in corrections → replace (not union) for that field.
    // "removing" / "questioning" / "confirming" → suppress new feature additions.
    // featuresToRemove always processed regardless of intent.
    let mergedState = mergeExtractionIntoState(currentState, extraction, understanding)

    // Carry forward L1-detected contradictions into state
    if (understanding.contradictions.length > 0) {
      mergedState = {
        ...mergedState,
        contradictions: [
          ...mergedState.contradictions,
          ...understanding.contradictions,
        ],
      }
    }

    // Apply updated conversation summary if memory was compressed this turn
    if (updatedSummary !== currentState.conversationSummary) {
      mergedState = { ...mergedState, conversationSummary: updatedSummary }
    }

    // ── L4 + L5: parallel ─────────────────────────────────────────────────────
    // L4: discovery strategy — which question unblocks the proposal
    // L5: lead scoring — 7-dimension business reasoning
    const [discovery, leadScore] = await Promise.all([
      runL4Discovery({ state: mergedState, understanding, extraction }),
      runL5Scoring({ state: mergedState, understanding }),
    ])

    // ── Apply L4 + L5 results to state ─────────────────────────────────────────
    const finalState: ProjectRequirementState = {
      ...mergedState,
      leadScore,
      discoveryTargets: discovery.targetField
        ? [
            {
              field: discovery.targetField,
              strategy: discovery.strategy as DiscoveryStrategy,
              blockingScore: discovery.readyForSummary ? 0 : 0.8,
              suggestedQuestion: discovery.question,
            },
            // Keep previous targets for other fields (exclude current to avoid duplication)
            ...mergedState.discoveryTargets.filter(d => d.field !== discovery.targetField),
          ]
        : mergedState.discoveryTargets,
    }

    return {
      responseMessage: discovery.question,
      updatedState: finalState,
      intent,
      understanding,
      extraction,
      discovery,
      leadScore,
      readyForProposal: discovery.readyForSummary || finalState.completenessScore >= 80,
    }
  }
  ```

- [ ] **Step 2: Smoke test the orchestrator manually**

  Start the dev server and send a test message to `/debug/pipeline`:
  ```bash
  curl -X POST http://localhost:3001/debug/pipeline \
    -H "Content-Type: application/json" \
    -d '{"message": "I need a food delivery app with real-time GPS tracking and Stripe payments for iOS and Android"}'
  ```
  Expected: response includes `l1_understanding`, `l2_extraction`, `l3_merged_state`, `l4_discovery`, `l5_lead_score` keys.

  > The `/debug/pipeline` route is updated in Task 24.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pipeline/orchestrator.ts
  git commit -m "feat: add pipeline orchestrator — L1+L2 parallel, intent-aware L3, L4+L5 parallel, memory compression"
  ```

---

### Task 24: Wire `routes/chat.ts` to orchestrator + update `/debug/pipeline`

**Files:**
- Modify: `dealghost/ai-service/src/routes/chat.ts`
- Modify: `dealghost/ai-service/src/index.ts`

- [ ] **Step 1: Update `routes/chat.ts` — replace basic followup with orchestrator**

  Open `dealghost/ai-service/src/routes/chat.ts` and make three targeted changes:

  **Change 1** — Replace the old pipeline imports with the orchestrator:
  ```typescript
  // REMOVE these lines:
  import { runL2Extraction } from '../pipeline/l2-extraction.js'
  import { mergeExtractionIntoState, formatConversationHistory } from '../state/manager.js'

  // ADD these lines:
  import { formatConversationHistory } from '../state/manager.js'
  import { runPipeline } from '../pipeline/orchestrator.js'
  ```

  **Change 2** — Replace steps 7–9 (L2 extraction → L3 merge → generateBasicFollowup) with the orchestrator call. Find this block:
  ```typescript
  // ── 7. L2 — Canonical extraction ─────────────────────────────────────────
  const extraction = await runL2Extraction({
    latestMessage: message,
    conversationHistory,
    currentState: state,
  })

  // ── 8. L3 — State merge ───────────────────────────────────────────────────
  const updatedState = mergeExtractionIntoState(state, extraction)

  // ── 9. Generate follow-up question (basic version — replaced by L4 in Phase 3) ─
  const responseMsg = generateBasicFollowup(updatedState, extraction)
  ```
  Replace it with:
  ```typescript
  // ── 7–9. Full intelligence pipeline (L1+L2 parallel → L3 → L4+L5 parallel) ──
  const pipelineResult = await runPipeline({
    message,
    conversationHistory,
    currentState: state,
    messageCount: recentMessages.length,
    allMessages: recentMessages.map(m => ({ role: m.role.toLowerCase(), content: m.content })),
  })
  const { updatedState, responseMessage: responseMsg, intent: pipelineIntent, readyForProposal } = pipelineResult
  ```

  **Change 3** — Update the return value to use `pipelineIntent` and `readyForProposal` from the pipeline:
  ```typescript
  // Find this return statement:
  return c.json({
    conversationId: convId,
    message: responseMsg,
    state: updatedState,
    intent,
    readyForProposal: updatedState.completenessScore >= 80,
  })

  // Replace with:
  return c.json({
    conversationId: convId,
    message: responseMsg,
    state: updatedState,
    intent: pipelineIntent,
    readyForProposal,
  })
  ```

  **Change 4** — Delete the `generateBasicFollowup` function and its `FOLLOW_UP_PRIORITY` / `fieldLabels` constants from the bottom of the file. They are no longer needed.

- [ ] **Step 2: Update `/debug/pipeline` in `src/index.ts` to show all 5 layer outputs**

  Open `dealghost/ai-service/src/index.ts` and replace the `/debug/pipeline` handler:
  ```typescript
  app.post('/debug/pipeline', async (c) => {
    const body = await c.req.json<{ message: string; conversationId?: string }>()
    const message = body.message ?? 'I need a food delivery app with GPS tracking and Stripe payments'

    const { createEmptyState } = await import('@dealghost/shared')
    const { runPipeline } = await import('./pipeline/orchestrator.js')

    const state = createEmptyState(body.conversationId ?? 'debug-session')

    const result = await runPipeline({
      message,
      conversationHistory: '',
      currentState: state,
      messageCount: 0,
      allMessages: [],
    })

    return c.json({
      input: { message },
      l1_understanding: result.understanding,
      l2_extraction: result.extraction,
      l3_merged_state: {
        features: result.updatedState.features,
        platforms: result.updatedState.platforms,
        completenessScore: result.updatedState.completenessScore,
        contradictions: result.updatedState.contradictions,
      },
      l4_discovery: result.discovery,
      l5_lead_score: result.leadScore,
      response_message: result.responseMessage,
      ready_for_proposal: result.readyForProposal,
    })
  })
  ```

- [ ] **Step 3: Start the server and run an end-to-end test**

  ```bash
  npm run dev
  ```

  In a second terminal, send a first message:
  ```bash
  curl -X POST http://localhost:3001/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "I need a food delivery app with GPS tracking and Stripe payments for iOS and Android"}'
  ```
  Expected response includes:
  - `conversationId` — new UUID
  - `message` — an architect-level follow-up question (not "what features do you need?")
  - `state.features` — contains `realtime_delivery_tracking` and `payment_processing`
  - `state.leadScore` — not null, has `score`, `label`, `breakdown`, `narrative`
  - `readyForProposal: false`

- [ ] **Step 4: Run all tests**

  ```bash
  npm test
  ```
  Expected: PASS — all tests passing (including all new Phase 3 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add src/routes/chat.ts src/index.ts
  git commit -m "feat: wire orchestrator into chat route — full L1–L5 pipeline active, remove generateBasicFollowup"
  ```

---

### Phase 3 Milestone Check

- [ ] `POST /chat` returns a follow-up question that references what the client just said (not a generic PM question)
- [ ] Saying "actually remove GPS tracking" removes the feature — it does not get re-added on the next turn
- [ ] Saying "actually we only need iOS" removes Android from `state.platforms` (replace, not union)
- [ ] Saying "not sure about the budget yet" is followed by a question about a *different* field on the next turn
- [ ] `state.leadScore` is non-null after any turn — has `score`, `label`, `breakdown`, `narrative`
- [ ] `state.leadScore.narrative` contains references to specific extracted facts (not generic statements)
- [ ] `GET /debug/pipeline` shows `l1_understanding`, `l2_extraction`, `l3_merged_state`, `l4_discovery`, `l5_lead_score`
- [ ] `npm test` passes all tests in `src/` (Phase 1 + 2 + 3 tests)
- [ ] After 9+ turns, `state.conversationSummary` is non-null (memory compression ran)
- [ ] Token usage stays stable beyond turn 8 (verify via Anthropic dashboard or approximate by checking prompt length in debug output)

---

<!-- Phase 4 will be added here -->

