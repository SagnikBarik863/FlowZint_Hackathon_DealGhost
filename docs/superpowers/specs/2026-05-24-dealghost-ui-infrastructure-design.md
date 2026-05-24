# DealGhost UI Infrastructure Design
**Date:** 2026-05-24  
**Scope:** shadcn/ui setup, react-resizable-panels, Groq JSON mode, chat workspace layout  
**Status:** Approved

---

## 1. Problem Statement

DealGhost needs three infrastructure pieces before the intelligence pipeline can be built and demoed:

1. **Component library** — building enterprise-style cards, tabs, badges, and progress bars from scratch wastes hackathon time. shadcn/ui provides pre-built Tailwind + Radix components that already match the dark enterprise aesthetic.
2. **Split panel workspace** — the core demo UX is a chat panel (left) + live intelligence panel (right). react-resizable-panels handles the draggable split so neither panel overflows or collapses.
3. **Reliable AI JSON output** — the extraction pipeline requires structured JSON on every call. Without enforced JSON mode, Groq's llama-3.3-70b-versatile occasionally returns prose or malformed JSON, crashing the pipeline during the demo.

---

## 2. Design Decisions

### 2.1 Demo Access Mechanism

**Decision:** Branded toggle button inside the chat header.

- A pill button labelled **"👁 View Intelligence"** sits in the top-right of the chat header.
- Clicking it slides the intelligence panel open from the right; clicking **✕** closes it.
- The button only renders when `NEXT_PUBLIC_DEMO_MODE=true` is set. Real customers never see it.
- No separate `/admin` route. Everything lives at `/chat`.

**Rationale:** Single URL to manage, no auth complexity, presenter controls the exact moment of the reveal, instant panel open (data already in DB from previous AI calls — no loading state).

### 2.2 Intelligence Panel Layout

**Decision:** Tabbed panel with three tabs — **Overview**, **Features**, **Proposal**.

- **Overview tab** (default): decorated cards showing lead score, project details, qualification, and missing information.
- **Features tab**: list of extracted features with complexity tags (built in a later sprint).
- **Proposal tab**: rendered markdown proposal output (built in a later sprint).

Tabs are built with shadcn `Tabs` + `TabsContent`. For this sprint, only Overview tab is fully populated; Features and Proposal tabs render a placeholder.

### 2.3 Overview Tab — Card Structure

Four decorated cards stacked vertically inside a scrollable panel:

| Card | Content | Color signal |
|---|---|---|
| **Lead Score** | Big score number, complexity badge, completeness progress bar | Green border |
| **Project Details** | Type, platforms (as pill badges), target users | Neutral |
| **Qualification** | Budget + timeline as two side-by-side mini cards | Green tint |
| **Missing Information** | Bullet list of detected gaps | Red border / warning |

### 2.4 Page Layout

```
/chat
├── ChatWorkspace (manages panel open/close state)
│   ├── ResizablePanelGroup (horizontal, react-resizable-panels)
│   │   ├── ResizablePanel (chat, default 60%, min 40%)
│   │   │   └── ChatPanel
│   │   │       ├── ChatHeader  ← contains "👁 View Intelligence" button
│   │   │       ├── MessageList
│   │   │       └── MessageInput
│   │   ├── ResizableHandle (drag divider, only rendered when panel open)
│   │   └── ResizablePanel (intelligence, default 40%, min 30%, collapsible)
│   │       └── IntelligencePanel
│   │           ├── PanelHeader (title + ✕ close)
│   │           ├── Tabs (Overview | Features | Proposal)
│   │           └── TabsContent
│   │               ├── OverviewTab
│   │               │   ├── LeadScoreCard
│   │               │   ├── ProjectDetailsCard
│   │               │   ├── QualificationCard
│   │               │   └── MissingInfoCard
│   │               ├── FeaturesTab (placeholder)
│   │               └── ProposalTab (placeholder)
```

When `isPanelOpen = false`, the intelligence `ResizablePanel` uses the `collapsible` and `defaultSize={0}` props to collapse to zero width, and the `ResizableHandle` is conditionally not rendered. The chat panel fills the full width. When `isPanelOpen = true`, the intelligence panel snaps to its default size (40%) via a `ref.expand()` call on the panel instance.

### 2.5 Groq JSON Mode

All Groq calls that require structured output (extraction, scoring, follow-up generation) must include:

```ts
response_format: { type: "json_object" }
```

This is applied in the central Groq client wrapper (`src/lib/ai/groq.ts`) so every caller gets it automatically. Individual prompt files are responsible for instructing the model to return the correct JSON shape — the client just enforces the format constraint.

---

## 3. Component Inventory

### shadcn/ui components to install
- `card` — base card wrapper for all intelligence panel cards
- `badge` — platform tags, complexity label, lead status
- `progress` — completeness progress bar
- `tabs` — Overview / Features / Proposal tab switcher
- `scroll-area` — scrollable intelligence panel content
- `separator` — dividers within cards
- `button` — "👁 View Intelligence" button and send button

### New project files
```
src/
├── app/
│   └── chat/
│       └── page.tsx                  ← /chat route
├── components/
│   ├── chat/
│   │   ├── ChatWorkspace.tsx         ← panel state manager
│   │   ├── ChatPanel.tsx             ← left: full chat UI
│   │   ├── ChatHeader.tsx            ← header with toggle button
│   │   ├── MessageList.tsx           ← conversation messages
│   │   └── MessageInput.tsx          ← input + send
│   └── intelligence/
│       ├── IntelligencePanel.tsx     ← right: tabbed panel shell
│       ├── OverviewTab.tsx           ← Overview tab content
│       ├── LeadScoreCard.tsx
│       ├── ProjectDetailsCard.tsx
│       ├── QualificationCard.tsx
│       └── MissingInfoCard.tsx
└── lib/
    └── ai/
        └── groq.ts                   ← Groq client with JSON mode
```

---

## 4. Data Flow (this sprint)

This sprint wires up the UI shell with **static mock data**. The real AI pipeline (extraction, scoring) is a separate sprint. The card components accept typed props derived from `ProjectRequirementState` — when the pipeline is built, it drops real data into the same props.

```
ChatWorkspace
  → holds: isPanelOpen (boolean), projectState (ProjectRequirementState | null)
  → passes projectState down to IntelligencePanel → OverviewTab → individual cards
  → for this sprint: projectState is a hardcoded mock object
```

---

## 5. Environment Variables

```bash
# .env.local (demo machine only)
NEXT_PUBLIC_DEMO_MODE=true

# .env (production / real customer deployment)
# NEXT_PUBLIC_DEMO_MODE omitted or false
```

---

## 6. Package Changes

```bash
# Component library (copies components into src/components/ui/)
npx shadcn@latest init
npx shadcn@latest add card badge progress tabs scroll-area separator button

# Split panel
npm install react-resizable-panels

# Groq JSON mode — no new package, config change in groq.ts only
```

---

## 7. Out of Scope (this sprint)

- AI pipeline (extraction, scoring, follow-up generation) — separate sprint
- Real message persistence to DB — separate sprint
- Features tab content — separate sprint
- Proposal tab content — separate sprint
- Streaming AI responses — future enhancement
- Animations / transitions — future enhancement
- Auth — not in hackathon scope

---

## 8. Success Criteria

- [ ] `/chat` route renders correctly with dark enterprise theme
- [ ] Chat UI shows message bubbles (left = AI, right = user)
- [ ] "👁 View Intelligence" button only visible when `NEXT_PUBLIC_DEMO_MODE=true`
- [ ] Clicking button opens intelligence panel; clicking ✕ closes it
- [ ] Panel is resizable by dragging the divider
- [ ] Chat panel fills full width when intelligence panel is closed
- [ ] All four Overview cards render with mock data
- [ ] Features and Proposal tabs render placeholder text
- [ ] Groq client sends `response_format: { type: "json_object" }` on all structured calls
- [ ] No TypeScript errors, no ESLint errors
