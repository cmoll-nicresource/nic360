import { describe, expect, it } from 'vitest'

import type { Payload } from 'payload'

import { getReaderPlan, planSatisfies } from './readerPlan'
import type { AccessProvider, User } from '@/payload-types'

function provider(overrides: Partial<AccessProvider>): AccessProvider {
  return {
    id: 1,
    name: 'Test Co',
    status: 'live',
    plan: 'premium',
    allowedDomains: [],
    updatedAt: '',
    createdAt: '',
    ...overrides,
  } as AccessProvider
}

const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

describe('planSatisfies', () => {
  it('none satisfies nothing', () => {
    expect(planSatisfies('none', 'base')).toBe(false)
    expect(planSatisfies('none', 'premium')).toBe(false)
  })

  it('base satisfies a base requirement but not a premium one', () => {
    expect(planSatisfies('base', 'base')).toBe(true)
    expect(planSatisfies('base', 'premium')).toBe(false)
  })

  it('premium satisfies both', () => {
    expect(planSatisfies('premium', 'base')).toBe(true)
    expect(planSatisfies('premium', 'premium')).toBe(true)
  })
})

describe('getReaderPlan', () => {
  it('denies suspended and unverified accounts regardless of provider tier', async () => {
    for (const override of [{ status: 'suspended' as const }, { _verified: false }])
      expect(
        await getReaderPlan(
          { accessProvider: provider({ status: 'live', plan: 'premium' }), ...override },
          {} as Payload,
        ),
      ).toBe('none')
  })
  it('is none for a user with no access provider', async () => {
    const user = { accessProvider: undefined } as Pick<User, 'accessProvider'>
    const plan = await getReaderPlan(user, {} as Payload)
    expect(plan).toBe('none')
  })

  it('is premium for a live, unexpired premium provider', async () => {
    const user = {
      accessProvider: provider({
        status: 'live',
        plan: 'premium',
        licenseExpiresAt: oneYearFromNow,
      }),
    }
    expect(await getReaderPlan(user, {} as Payload)).toBe('premium')
  })

  it('is base for a live, unexpired base provider', async () => {
    const user = {
      accessProvider: provider({ status: 'live', plan: 'base', licenseExpiresAt: oneYearFromNow }),
    }
    expect(await getReaderPlan(user, {} as Payload)).toBe('base')
  })

  it('is base for a trial provider (trial counts the same as live)', async () => {
    const user = {
      accessProvider: provider({ status: 'trial', plan: 'base', licenseExpiresAt: oneYearFromNow }),
    }
    expect(await getReaderPlan(user, {} as Payload)).toBe('base')
  })

  it('is none for a pending provider, whatever its plan says', async () => {
    const user = {
      accessProvider: provider({
        status: 'pending',
        plan: 'premium',
        licenseExpiresAt: oneYearFromNow,
      }),
    }
    expect(await getReaderPlan(user, {} as Payload)).toBe('none')
  })

  it('is none for a provider with no license expiry set but plan none', async () => {
    const user = {
      accessProvider: provider({ status: 'live', plan: 'none', licenseExpiresAt: oneYearFromNow }),
    }
    expect(await getReaderPlan(user, {} as Payload)).toBe('none')
  })

  it('is none for an expired license, even if status is live and plan is premium', async () => {
    const user = {
      accessProvider: provider({ status: 'live', plan: 'premium', licenseExpiresAt: oneYearAgo }),
    }
    expect(await getReaderPlan(user, {} as Payload)).toBe('none')
  })

  it('treats a blank license expiry as not expired', async () => {
    const user = {
      accessProvider: provider({ status: 'live', plan: 'premium', licenseExpiresAt: undefined }),
    }
    expect(await getReaderPlan(user, {} as Payload)).toBe('premium')
  })

  it('looks the provider up by id when accessProvider is not already populated', async () => {
    const user = { accessProvider: 42 } as Pick<User, 'accessProvider'>
    const fakePayload = {
      findByID: async ({ id }: { id: number }) =>
        id === 42
          ? provider({ id: 42, status: 'live', plan: 'base', licenseExpiresAt: oneYearFromNow })
          : null,
    } as unknown as Payload
    expect(await getReaderPlan(user, fakePayload)).toBe('base')
  })

  it('is none when the looked-up provider cannot be found', async () => {
    const user = { accessProvider: 999 } as Pick<User, 'accessProvider'>
    const fakePayload = {
      findByID: async () => {
        throw new Error('not found')
      },
    } as unknown as Payload
    expect(await getReaderPlan(user, fakePayload)).toBe('none')
  })
})
