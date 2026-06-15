import type {
  ProjectRequirementState,
  SemanticUnderstanding,
  ExtractionResult,
  DiscoveryResult,
  CanonicalProjectType,
} from '@dealghost/shared'
import { runL1Understanding } from './l1-understanding.js'
import { runL2Extraction } from './l2-extraction.js'
import { runL4Discovery } from './l4-discovery.js'
import { mergeExtractionIntoState, calculateCompleteness } from '../state/manager.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PipelineInput {
  latestMessage: string
  conversationHistory: string
  currentState: ProjectRequirementState
  /** Last 3 bot questions — passed to L4 to prevent repeating recently asked topics */
  recentBotQuestions?: string[]
}

export interface PipelineOutput {
  state: ProjectRequirementState
  response: string           // the question/message to return to the user
  readyForProposal: boolean
  l1: SemanticUnderstanding
  l2: ExtractionResult
  l4: DiscoveryResult
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Full intelligence pipeline: L1 → L2 → L3 (sync) → L4
 *
 * Execution strategy:
 * - L1 runs first (Haiku, ~1s) — corrections and contradictions inform L2
 * - L2 runs after L1 (Sonnet, ~10–20s) — extraction informed by L1 context
 * - L3 runs sync — pure state merge, no AI
 * - L4 runs last (Sonnet, ~5–10s) — discovery question based on final state
 *
 * L4 and L1/L2 cannot be parallelised because L4 needs the merged state.
 * L1 and L2 are sequential because L1 corrections should inform L2 focus.
 */
export async function runFullPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { latestMessage, conversationHistory, currentState } = input

  // ── Step 1: L1 Semantic Understanding (Haiku, fast) ────────────────────────
  const l1 = await runL1Understanding({
    latestMessage,
    conversationHistory,
    currentState,
  })

  // ── Step 2: L2 Extraction (Sonnet, L1-informed) ────────────────────────────
  const l2 = await runL2Extraction({
    latestMessage,
    conversationHistory,
    currentState,
    l1Context: buildL1ContextForL2(l1),
  })

  // ── Step 3: L3 State merge (sync, no AI) ──────────────────────────────────
  let updatedState = mergeExtractionIntoState(currentState, l2)

  // ── Step 4: Apply L1 intelligence to state ─────────────────────────────────
  updatedState = applyL1ToState(updatedState, l1)

  // ── Step 5: Infer projectType if not yet set ───────────────────────────────
  if (!updatedState.projectType) {
    updatedState = inferProjectType(updatedState)
  }

  // Recalculate completeness after all mutations
  updatedState = {
    ...updatedState,
    completenessScore: calculateCompleteness(updatedState),
  }

  // ── Step 6: L4 Discovery Question (Sonnet) ─────────────────────────────────
  // If the message looks like a question but L1 missed it, force "questioning"
  // so L4's mandatory answer_question strategy fires correctly.
  const QUESTION_WORDS = /^(should|what|how|can|do|is|which|why|will|when|where|are|could|would|does|did|has|have)\b/i
  const looksLikeQuestion =
    latestMessage.trim().endsWith('?') || QUESTION_WORDS.test(latestMessage.trim())
  const l1ForL4 =
    l1.semanticIntent !== 'questioning' && looksLikeQuestion
      ? { ...l1, semanticIntent: 'questioning' as const }
      : l1

  const l4 = await runL4Discovery({
    state: updatedState,
    l1Understanding: l1ForL4,
    conversationHistory,
    latestMessage,
    recentBotQuestions: input.recentBotQuestions,
  })

  const readyForProposal = l4.readyForSummary || updatedState.completenessScore >= 80

  return {
    state: updatedState,
    response: l4.question,
    readyForProposal,
    l1,
    l2,
    l4,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a short L1 context string to prepend to the L2 user prompt.
 * Tells L2 specifically what type of message this is and any corrections.
 */
function buildL1ContextForL2(l1: SemanticUnderstanding): string | undefined {
  if (l1.semanticIntent === 'adding' && l1.corrections.length === 0) {
    return undefined // no special context needed for simple additions
  }

  const lines: string[] = [`[L1 Context: intent=${l1.semanticIntent}]`]

  if (l1.corrections.length > 0) {
    lines.push('Corrections detected:')
    for (const c of l1.corrections) {
      lines.push(`  - ${c.field}: "${c.oldValue}" → "${c.newValue}"`)
    }
  }

  if (l1.semanticIntent === 'removing') {
    lines.push('Client is REMOVING requirements — focus featuresToRemove[] carefully.')
  }

  if (l1.semanticIntent === 'correcting' || l1.semanticIntent === 'clarifying') {
    lines.push('Client is correcting/clarifying — do not create duplicate features for both old and new values.')
  }

  return lines.join('\n')
}

/**
 * Merge L1 contradictions and corrections into state.
 * Called after L3 state merge so it operates on the fully updated state.
 */
function applyL1ToState(
  state: ProjectRequirementState,
  l1: SemanticUnderstanding
): ProjectRequirementState {
  const updated = { ...state }

  // Merge new contradictions (avoid duplicates on same field)
  if (l1.contradictions.length > 0) {
    const existingFields = new Set(state.contradictions.map((c) => c.field))
    const turnNumber = Math.max(0, state.keyDiscoveries.length)

    const newContradictions = l1.contradictions
      .filter((c) => !existingFields.has(c.field))
      .map((c) => ({
        field: c.field,
        existingFact: c.existingFact,
        newStatement: c.newStatement,
        turnNumber,
        resolved: false,
      }))

    updated.contradictions = [...state.contradictions, ...newContradictions]
  }

  // Track business domain as a key discovery
  if (l1.businessDomain) {
    const domainEntry = `Domain: ${l1.businessDomain}`
    if (!state.keyDiscoveries.includes(domainEntry)) {
      updated.keyDiscoveries = [...state.keyDiscoveries, domainEntry]
    }
  }

  // Track urgency signals
  if (l1.urgencySignals.length > 0) {
    const urgencyEntry = `Urgency: ${l1.urgencySignals[0]}`
    if (!state.keyDiscoveries.includes(urgencyEntry)) {
      updated.keyDiscoveries = [...updated.keyDiscoveries, urgencyEntry]
    }
  }

  return updated
}

/**
 * Infer projectType from available state signals.
 * Only called when projectType is null — avoids overwriting explicit values.
 *
 * Key rules:
 * - "shopping_cart" is the clearest e-commerce signal — restaurant/booking apps never have carts
 * - "product_catalog" alone is too weak (menus, service listings, and real products all map to it)
 * - "payment_processing" alone is far too weak (nearly every app takes payments)
 * - Domain hints from L1 keyDiscoveries are used to block false-positive e-commerce classifications
 */
function inferProjectType(state: ProjectRequirementState): ProjectRequirementState {
  let inferred: CanonicalProjectType | null = null

  const featureIds = new Set(state.features.map((f) => f.canonicalId))
  const hasMobile = state.platforms.some((p) => /ios|android|mobile/i.test(p))
  const hasWeb = state.platforms.some((p) => /web|browser/i.test(p))

  // L1 stores domain as "Domain: <string>" in keyDiscoveries — use it to block false positives
  const detectedDomain = state.keyDiscoveries
    .filter((d) => d.startsWith('Domain:'))
    .join(' ')
    .toLowerCase()
  const isFoodOrServiceDomain =
    /restaurant|cafe|caf|food|dining|catering|hotel|hospitality|salon|barber|clinic|spa|gym|fitness|beauty/i.test(
      detectedDomain
    )

  // True e-commerce signals: shopping_cart = explicit browse-and-purchase UX.
  // product_catalog + inventory_management together also signals an online store.
  // payment_processing alone is NOT sufficient — restaurants, booking apps, SaaS tools all take payments.
  const hasEcommerceSignal =
    featureIds.has('shopping_cart') ||
    (featureIds.has('product_catalog') && featureIds.has('inventory_management'))

  if (state.businessModel === 'marketplace') {
    inferred = 'marketplace'
  } else if (hasMobile && !hasWeb) {
    inferred = 'mobile_app'
  } else if (
    state.businessModel === 'B2B' &&
    (featureIds.has('admin_panel') || featureIds.has('role_based_access_control') || featureIds.has('analytics_dashboard'))
  ) {
    inferred = 'saas_platform'
  } else if (hasEcommerceSignal && !isFoodOrServiceDomain) {
    inferred = 'e_commerce'
  } else if (state.platforms.length > 0 || state.features.length >= 3) {
    inferred = 'web_app'
  }

  if (!inferred) return state

  return {
    ...state,
    projectType: inferred,
    keyDiscoveries: [...state.keyDiscoveries, `Inferred project type: ${inferred}`],
  }
}
