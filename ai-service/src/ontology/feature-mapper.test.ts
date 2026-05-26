import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/prisma.js', () => ({
  prisma: {
    featureOntology: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'user_auth',
          canonicalName: 'User Authentication',
          category: 'auth',
          description: 'Core account creation and session management.',
          aliases: ['login', 'sign in', 'sign up'],
          typicalComplexity: 'MEDIUM',
          typicalHoursMin: 16,
          typicalHoursMax: 32,
          dependencies: [],
          incompatibleWith: [],
          relatedFeatures: ['oauth_social_login'],
          commonProjectTypes: ['saas_platform'],
        },
        {
          id: 'payment_processing',
          canonicalName: 'Payment Processing',
          category: 'payments',
          description: 'Accept card and digital wallet payments.',
          aliases: ['stripe', 'payments', 'checkout'],
          typicalComplexity: 'MEDIUM',
          typicalHoursMin: 24,
          typicalHoursMax: 48,
          dependencies: ['user_auth'],
          incompatibleWith: [],
          relatedFeatures: ['invoice_generation'],
          commonProjectTypes: ['ecommerce_store'],
        },
      ]),
    },
  },
}))

describe('getOntologyPromptSection', () => {
  it('returns a non-empty string containing canonical IDs', async () => {
    const { getOntologyPromptSection } = await import('./feature-mapper.js')
    const result = await getOntologyPromptSection()
    expect(result).toContain('user_auth')
    expect(result).toContain('payment_processing')
  })

  it('includes aliases in the output', async () => {
    const { getOntologyPromptSection } = await import('./feature-mapper.js')
    const result = await getOntologyPromptSection()
    expect(result).toContain('login')
    expect(result).toContain('stripe')
  })

  it('accepts optional domain parameter without throwing', async () => {
    const { getOntologyPromptSection } = await import('./feature-mapper.js')
    await expect(getOntologyPromptSection('logistics')).resolves.toBeTruthy()
  })
})

describe('formatOntologyForPrompt', () => {
  it('groups entries by category', async () => {
    const { formatOntologyForPrompt } = await import('./feature-mapper.js')
    const result = formatOntologyForPrompt([
      {
        id: 'user_auth',
        canonicalName: 'User Authentication',
        category: 'auth',
        description: null,
        aliases: ['login'],
        typicalComplexity: 'MEDIUM',
        typicalHoursMin: 16,
        typicalHoursMax: 32,
        dependencies: [],
        incompatibleWith: [],
        relatedFeatures: [],
        commonProjectTypes: [],
      },
    ])
    expect(result).toContain('### AUTH')
    expect(result).toContain('user_auth')
  })

  it('handles entry with null description gracefully', async () => {
    const { formatOntologyForPrompt } = await import('./feature-mapper.js')
    expect(() =>
      formatOntologyForPrompt([
        {
          id: 'test_feature',
          canonicalName: 'Test Feature',
          category: 'test',
          description: null,
          aliases: [],
          typicalComplexity: null,
          typicalHoursMin: null,
          typicalHoursMax: null,
          dependencies: [],
          incompatibleWith: [],
          relatedFeatures: [],
          commonProjectTypes: [],
        },
      ])
    ).not.toThrow()
  })
})
