import type { ExtractionResult } from '@dealghost/shared'

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
  const confirmedFeatures = extraction.features.filter((f) => f.isConfirmed)
  if (confirmedFeatures.length > 0) {
    const avg = confirmedFeatures.reduce((sum, f) => sum + f.confidence, 0) / confirmedFeatures.length
    updated['features'] = Math.max(updated['features'] ?? 0, avg)
  }

  return updated
}
