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
