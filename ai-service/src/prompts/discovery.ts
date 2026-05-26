import type { ProjectRequirementState, SemanticUnderstanding } from '@dealghost/shared'

/**
 * L4 — Discovery Question prompts
 *
 * Runs on Sonnet. Purpose: decide the SINGLE most valuable follow-up question
 * given everything known about the project so far.
 *
 * This is the intelligence moat. A bad L4 prompt asks generic questions in a
 * fixed order. A great L4 prompt acts like a senior business analyst who has
 * read everything, understood the domain, and knows exactly what to ask next.
 */

export function buildDiscoverySystemPrompt(): string {
  return `You are the Discovery Intelligence layer of DEALGHOST, a pre-sales AI system for FlowZint software agency.

Your role: act as a senior business analyst who has absorbed everything known about a client's software project and must decide the SINGLE most valuable question to ask next.

## YOUR INTELLIGENCE RULES

### Priority hierarchy — check in order:
1. CONTRADICTION first — if anything contradicts something already stated, surface it immediately. Do not move on with conflicting data in state.
2. UNRESOLVED ASSUMPTIONS — if a high-confidence assumption is blocking accurate scoping, confirm it.
3. BLOCKING GAPS — missing info that directly affects project cost/scope estimate (budget, timeline, user scale, platform choices).
4. WORKFLOW DEPTH — if features exist but no workflow is described, the scope is undefined. Probe how key processes work.
5. COMPLEXITY PROBING — when core features exist but ambiguity remains about scale/real-time/offline/integrations.
6. OFFER SUMMARY — when completeness ≥ 75% and all blocking gaps are resolved, offer to summarize.

### Strategy definitions:
- clarify_scope       : Two possible interpretations exist; ask which one applies
- probe_complexity    : Feature exists but its scale/depth/edge cases are unknown
- resolve_contradiction : Two facts in state conflict; surface the conflict directly
- confirm_assumption  : You've inferred something important that hasn't been confirmed
- discover_workflow   : A key user journey is mentioned but not described step-by-step
- ask_tech_preference : Tech stack choices are unknown but have major cost implications
- offer_summary       : Enough is known; offer to summarize and move to proposal

### Question quality rules:
- ONE question. Never ask multiple questions in one message.
- Be specific. Reference what you already know. "You mentioned GPS tracking — does that mean drivers see the customer's location, or customers track the driver, or both?"
- Be conversational, not robotic. Avoid "Please provide information about X."
- If resolving a contradiction, quote both conflicting facts exactly.
- If confirming an assumption, state the assumption clearly before asking.
- Never ask about something already explicitly confirmed (see confirmedFacts).
- Never ask a question that was clearly answered in recent conversation history.

## OUTPUT FORMAT
Return ONLY valid JSON. No explanation. No markdown fences.

{
  "strategy": "clarify_scope"|"probe_complexity"|"resolve_contradiction"|"confirm_assumption"|"discover_workflow"|"ask_tech_preference"|"offer_summary",
  "targetField": string,
  "reasoning": string,
  "question": string,
  "readyForSummary": boolean
}`
}

export function buildDiscoveryUserPrompt(
  state: ProjectRequirementState,
  l1: SemanticUnderstanding | null,
  conversationHistory: string
): string {
  // Build a structured discovery brief — not a raw state dump
  const gaps = buildGapSummary(state)
  const assumptionsList = state.assumptions.slice(0, 5).map(a => `• ${a}`).join('\n') || '(none)'
  const contradictionsList = state.contradictions
    .filter(c => !c.resolved)
    .map(c => `• [${c.field}] Known: "${c.existingFact}" | New: "${c.newStatement}"`)
    .join('\n') || '(none)'
  const confirmedList = state.confirmedFacts.slice(0, 10).map(f => `• ${f}`).join('\n') || '(none)'
  const featuresKnown = state.features.length > 0
    ? state.features.map(f => `${f.canonicalId} [${f.priority}] conf=${f.confidence.toFixed(2)}`).join(', ')
    : '(none yet)'
  const l1Summary = l1
    ? `Intent: ${l1.semanticIntent} | Domain: ${l1.businessDomain} | Confidence: ${l1.confidenceInUnderstanding.toFixed(2)}`
    : '(L1 not available)'

  return `## PROJECT STATE SUMMARY
- Type: ${state.projectType ?? 'unknown'}
- Description: ${state.description ?? 'unknown'}
- Platforms: ${state.platforms.length ? state.platforms.join(', ') : 'unknown'}
- Business model: ${state.businessModel ?? 'unknown'}
- Target users: ${state.targetUsers ?? 'unknown'}
- User scale: ${state.userScale ?? 'unknown'}
- Timeline: ${state.timelineExpectation ?? 'unknown'}
- Budget: ${state.budgetRange?.min != null ? `$${state.budgetRange.min}–$${state.budgetRange.max}` : 'unknown'}
- Auth: ${state.authRequirements ?? 'unknown'}
- Real-time: ${state.realtimeRequirements ?? 'unknown'}
- Admin panel: ${state.adminPanelRequirements ?? 'unknown'}
- Completeness: ${state.completenessScore}%

## KNOWN FEATURES (${state.features.length})
${featuresKnown}

## WORKFLOWS DESCRIBED (${state.workflows.length})
${state.workflows.length ? state.workflows.map(w => w.name).join(', ') : '(none)'}

## CONFIRMED FACTS
${confirmedList}

## ASSUMPTIONS NEEDING CONFIRMATION
${assumptionsList}

## UNRESOLVED CONTRADICTIONS
${contradictionsList}

## HIGHEST-PRIORITY GAPS
${gaps}

## LAST MESSAGE CONTEXT (L1)
${l1Summary}

## RECENT CONVERSATION
${conversationHistory || '(none)'}

Based on all of the above, decide the single most valuable question to ask next. Use the priority hierarchy: contradictions first, then assumptions, then blocking gaps, then workflows, then complexity, then offer summary if ≥75% complete.`
}

/**
 * Build a prioritised list of gaps for L4 to reason over.
 * Returns the top 6 most blocking unknown fields.
 */
function buildGapSummary(state: ProjectRequirementState): string {
  const gaps: Array<{ field: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string }> = []

  if (!state.projectType) gaps.push({ field: 'projectType', priority: 'HIGH', reason: 'Determines architecture and cost model' })
  if (!state.platforms.length) gaps.push({ field: 'platforms', priority: 'HIGH', reason: 'Web vs mobile changes scope dramatically' })
  if (!state.targetUsers) gaps.push({ field: 'targetUsers', priority: 'HIGH', reason: 'User types determine auth complexity and feature depth' })
  if (!state.budgetRange?.min) gaps.push({ field: 'budgetRange', priority: 'HIGH', reason: 'Blocks proposal generation entirely' })
  if (!state.timelineExpectation) gaps.push({ field: 'timelineExpectation', priority: 'HIGH', reason: 'Affects team composition and sprint planning' })
  if (!state.userScale) gaps.push({ field: 'userScale', priority: 'MEDIUM', reason: 'Determines infrastructure, caching, and database design' })
  if (!state.authRequirements) gaps.push({ field: 'authRequirements', priority: 'MEDIUM', reason: 'OAuth/SSO/2FA adds significant dev time' })
  if (!state.realtimeRequirements) gaps.push({ field: 'realtimeRequirements', priority: 'MEDIUM', reason: 'WebSocket infra doubles backend complexity' })
  if (!state.adminPanelRequirements && state.features.length > 3) {
    gaps.push({ field: 'adminPanelRequirements', priority: 'MEDIUM', reason: 'Most platforms need an admin panel; scope is unclear' })
  }
  if (!state.workflows.length && state.features.length > 4) {
    gaps.push({ field: 'workflows', priority: 'MEDIUM', reason: 'Features exist but no workflow described — scope ambiguous' })
  }
  if (!state.businessModel) gaps.push({ field: 'businessModel', priority: 'LOW', reason: 'Affects billing, subscription, and monetisation features' })

  // Also include any explicit discovery targets from state
  for (const dt of state.discoveryTargets.slice(0, 3)) {
    if (!gaps.find(g => g.field === dt.field)) {
      gaps.push({ field: dt.field, priority: dt.blockingScore > 0.7 ? 'HIGH' : 'MEDIUM', reason: dt.suggestedQuestion })
    }
  }

  const topGaps = gaps
    .sort((a, b) => { const o = { HIGH: 0, MEDIUM: 1, LOW: 2 }; return o[a.priority] - o[b.priority] })
    .slice(0, 6)

  if (!topGaps.length) return '(all key fields have data)'
  return topGaps.map(g => `• [${g.priority}] ${g.field}: ${g.reason}`).join('\n')
}
