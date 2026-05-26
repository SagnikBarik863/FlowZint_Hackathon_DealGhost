import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runL4Discovery } from './l4-discovery.js'
import { createEmptyState } from '@dealghost/shared'
import type { ProjectRequirementState } from '@dealghost/shared'

vi.mock('../models/claude.js', () => ({
  callClaudeJSON: vi.fn(),
}))

import { callClaudeJSON } from '../models/claude.js'
const mockCallClaude = vi.mocked(callClaudeJSON)

beforeEach(() => {
  vi.clearAllMocks()
})

const makeDiscoveryResult = (overrides = {}) => ({
  strategy: 'probe_complexity' as const,
  targetField: 'userScale',
  reasoning: 'User scale unknown — affects infra cost significantly',
  question: 'How many users are you expecting at launch?',
  readyForSummary: false,
  ...overrides,
})

const makeStateWithFeatures = (partial: Partial<ProjectRequirementState> = {}): ProjectRequirementState => ({
  ...createEmptyState('test'),
  features: [
    { canonicalId: 'user_auth', rawText: 'auth', confidence: 0.95, category: 'AUTH', priority: 'MUST', isConfirmed: true, dependencies: [] },
    { canonicalId: 'payment_processing', rawText: 'payments', confidence: 0.95, category: 'PAYMENTS', priority: 'MUST', isConfirmed: true, dependencies: [] },
    { canonicalId: 'realtime_delivery_tracking', rawText: 'GPS tracking', confidence: 0.9, category: 'TRACKING', priority: 'MUST', isConfirmed: true, dependencies: [] },
    { canonicalId: 'order_management', rawText: 'orders', confidence: 0.85, category: 'CORE', priority: 'MUST', isConfirmed: true, dependencies: [] },
    { canonicalId: 'maps_integration', rawText: 'maps', confidence: 0.9, category: 'MAPS', priority: 'MUST', isConfirmed: true, dependencies: [] },
  ],
  ...partial,
})

describe('runL4Discovery', () => {
  it('asks about missing blocking fields when state is incomplete', async () => {
    const expected = makeDiscoveryResult({
      strategy: 'probe_complexity',
      targetField: 'platforms',
      question: 'Do you need this as a web app, mobile app, or both?',
    })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL4Discovery({
      state: makeStateWithFeatures(),
      l1Understanding: null,
      conversationHistory: '',
    })

    expect(result.strategy).toBe('probe_complexity')
    expect(result.question).toContain('web app')
    expect(result.readyForSummary).toBe(false)
  })

  it('resolves contradictions before asking other questions', async () => {
    const state = makeStateWithFeatures({
      contradictions: [
        {
          field: 'userScale',
          existingFact: '50,000 users at launch',
          newStatement: 'only 50 users at start',
          turnNumber: 2,
          resolved: false,
        },
      ],
    })

    const expected = makeDiscoveryResult({
      strategy: 'resolve_contradiction',
      targetField: 'userScale',
      question: 'Earlier you mentioned 50,000 users at launch, but just now you said 50 users — which is correct?',
    })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL4Discovery({
      state,
      l1Understanding: null,
      conversationHistory: '',
    })

    expect(result.strategy).toBe('resolve_contradiction')
    expect(result.targetField).toBe('userScale')
  })

  it('offers summary when completenessScore is high enough', async () => {
    const highCompletnessState = makeStateWithFeatures({
      completenessScore: 78,
      projectType: 'marketplace',
      platforms: ['web', 'ios', 'android'],
      targetUsers: 'restaurant customers and restaurant owners',
      businessModel: 'marketplace',
      timelineExpectation: '6 months',
      budgetRange: { min: 50000, max: 80000, currency: 'USD' },
      userScale: '10,000 at launch',
      authRequirements: 'email + social login',
    })

    const expected = makeDiscoveryResult({
      strategy: 'offer_summary',
      targetField: 'summary',
      question: "I have a solid picture of your project now. Would you like me to put together a detailed proposal?",
      readyForSummary: true,
    })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL4Discovery({
      state: highCompletnessState,
      l1Understanding: null,
      conversationHistory: '',
    })

    expect(result.strategy).toBe('offer_summary')
    expect(result.readyForSummary).toBe(true)
  })

  it('confirms high-priority assumptions before moving on', async () => {
    const state = makeStateWithFeatures({
      assumptions: ['Delivery tracking is real-time, not periodic'],
      completenessScore: 35,
    })

    const expected = makeDiscoveryResult({
      strategy: 'confirm_assumption',
      targetField: 'realtimeRequirements',
      question: "I'm assuming the delivery tracking updates in real-time (live GPS position), not every 30 seconds or so — is that right?",
    })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL4Discovery({
      state,
      l1Understanding: null,
      conversationHistory: '',
    })

    expect(result.strategy).toBe('confirm_assumption')
  })

  it('probes workflows when features exist but no workflow described', async () => {
    const state = makeStateWithFeatures({
      workflows: [], // no workflows yet despite 5 features
    })

    const expected = makeDiscoveryResult({
      strategy: 'discover_workflow',
      targetField: 'workflows',
      question: 'Walk me through the delivery flow — from when a customer places an order to when it arrives.',
    })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL4Discovery({
      state,
      l1Understanding: null,
      conversationHistory: '',
    })

    expect(result.strategy).toBe('discover_workflow')
  })
})
