import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runL1Understanding } from './l1-understanding.js'
import { createEmptyState } from '@dealghost/shared'

vi.mock('../models/claude.js', () => ({
  callClaudeJSON: vi.fn(),
}))

import { callClaudeJSON } from '../models/claude.js'
const mockCallClaude = vi.mocked(callClaudeJSON)

beforeEach(() => {
  vi.clearAllMocks()
})

const makeL1Result = (overrides = {}) => ({
  semanticIntent: 'adding' as const,
  businessDomain: 'food delivery',
  keyEntities: [{ type: 'feature' as const, value: 'GPS tracking' }],
  corrections: [],
  contradictions: [],
  workflowsDescribed: [],
  urgencySignals: [],
  businessModelHints: [],
  confidenceInUnderstanding: 0.9,
  ...overrides,
})

describe('runL1Understanding', () => {
  it('returns SemanticUnderstanding for a simple adding message', async () => {
    const expected = makeL1Result()
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL1Understanding({
      latestMessage: 'I need GPS tracking for drivers',
      conversationHistory: '',
      currentState: createEmptyState('test-1'),
    })

    expect(result.semanticIntent).toBe('adding')
    expect(result.businessDomain).toBe('food delivery')
    expect(result.confidenceInUnderstanding).toBe(0.9)
  })

  it('detects corrections when user changes a previous statement', async () => {
    const expected = makeL1Result({
      semanticIntent: 'correcting',
      corrections: [{ field: 'platforms', oldValue: 'web only', newValue: 'web and mobile' }],
    })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL1Understanding({
      latestMessage: 'Actually I want both web and mobile, not just web',
      conversationHistory: 'Client: web app only',
      currentState: { ...createEmptyState('test-2'), platforms: ['web'] },
    })

    expect(result.semanticIntent).toBe('correcting')
    expect(result.corrections).toHaveLength(1)
    expect(result.corrections[0].field).toBe('platforms')
    expect(result.corrections[0].newValue).toBe('web and mobile')
  })

  it('detects contradictions against existing state', async () => {
    const expected = makeL1Result({
      semanticIntent: 'adding',
      contradictions: [
        {
          existingFact: '50,000 users at launch',
          newStatement: 'only 50 users at start',
          field: 'userScale',
        },
      ],
    })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL1Understanding({
      latestMessage: 'Actually we only expect 50 users at launch',
      conversationHistory: '',
      currentState: { ...createEmptyState('test-3'), userScale: '50,000 at launch' },
    })

    expect(result.contradictions).toHaveLength(1)
    expect(result.contradictions[0].field).toBe('userScale')
  })

  it('detects urgency signals', async () => {
    const expected = makeL1Result({
      urgencySignals: ['investor demo in 3 weeks'],
    })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL1Understanding({
      latestMessage: 'We need this done in 3 weeks — we have an investor demo',
      conversationHistory: '',
      currentState: createEmptyState('test-4'),
    })

    expect(result.urgencySignals).toContain('investor demo in 3 weeks')
  })

  it('classifies done intent when user signals wrap-up', async () => {
    const expected = makeL1Result({ semanticIntent: 'done', businessDomain: 'SaaS' })
    mockCallClaude.mockResolvedValueOnce(expected)

    const result = await runL1Understanding({
      latestMessage: "That's everything, I think we've covered it all",
      conversationHistory: '',
      currentState: createEmptyState('test-5'),
    })

    expect(result.semanticIntent).toBe('done')
  })
})
