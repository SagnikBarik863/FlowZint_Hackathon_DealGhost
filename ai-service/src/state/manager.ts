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
