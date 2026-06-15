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

  return formatOntologyForPrompt(entries as FeatureOntologyEntry[])
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
    'Map extracted features to these canonical IDs. Each entry: ID | Name | Aliases',
    '',
  ]

  for (const [category, features] of byCategory) {
    lines.push(`### ${category.toUpperCase()}`)
    for (const f of features) {
      lines.push(`- ${f.id} | "${f.canonicalName}" | aliases: [${f.aliases.join(', ')}]`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
