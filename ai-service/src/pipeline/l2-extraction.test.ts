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
  callClaudeJSON: vi.fn().mockImplementation((_opts: unknown, parse: (raw: string) => unknown) =>
    Promise.resolve(parse(mockClaudeOutput))
  ),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentState: {} as any,
    })
    const tracking = result.features.find((f) => f.canonicalId === 'realtime_delivery_tracking')
    expect(tracking?.isConfirmed).toBe(true)
  })
})
