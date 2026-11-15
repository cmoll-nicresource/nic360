import { describe, expect, it } from 'vitest'

import { summarizeUserAccess } from './userAccessSummary'

const now = Date.parse('2026-11-13T12:00:00Z')
const provider = (over = {}) => ({
  name: 'Acme Tobacco',
  plan: 'premium' as const,
  status: 'live' as const,
  licenseExpiresAt: null,
  ...over,
})

describe('summarizeUserAccess', () => {
  it('calls a user with no provider non-subscribing', () => {
    expect(summarizeUserAccess({ provider: null }, now)).toMatchObject({ tone: 'none', headline: 'Non-subscribing' })
  })

  it('reports Premium and Base for an active provider, trial included', () => {
    expect(summarizeUserAccess({ provider: provider(), verified: true }, now)).toMatchObject({ tone: 'premium', headline: 'Premium subscriber' })
    expect(summarizeUserAccess({ provider: provider({ plan: 'base', status: 'trial' }) }, now)).toMatchObject({ tone: 'base', headline: 'Base subscriber' })
  })

  it('shows the expiry date and keeps access through a future one', () => {
    const result = summarizeUserAccess({ provider: provider({ licenseExpiresAt: '2027-01-31T00:00:00.000Z' }) }, now)
    expect(result.tone).toBe('premium')
    expect(result.detail).toContain('expires 2027-01-31')
  })

  it('explains why a plan is switched off', () => {
    expect(summarizeUserAccess({ provider: provider({ licenseExpiresAt: '2026-11-01T00:00:00.000Z' }) }, now)).toMatchObject({ tone: 'blocked', detail: expect.stringContaining('expired') })
    expect(summarizeUserAccess({ provider: provider({ status: 'pending' }) }, now)).toMatchObject({ tone: 'blocked', detail: expect.stringContaining('pending') })
    expect(summarizeUserAccess({ provider: provider(), suspended: true }, now).headline).toMatch(/Suspended/)
    expect(summarizeUserAccess({ provider: provider(), verified: false }, now).headline).toMatch(/not verified/)
  })

  it('treats an active provider on the None plan as non-subscribing', () => {
    expect(summarizeUserAccess({ provider: provider({ plan: 'none' }) }, now)).toMatchObject({ tone: 'none', headline: 'Non-subscribing' })
  })
})
