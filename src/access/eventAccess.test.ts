import { describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { hasActiveRegistration } from './eventAccess'
import { getSubscriptionPlan } from './subscriptionPlan'
import type { AccessProvider } from '@/payload-types'

describe('subscription and conference registration are independent', () => {
  const user = (accessProvider: AccessProvider | null) => ({
    id: 7, collection: 'users', status: 'active', _verified: true, accessProvider,
  }) as NonNullable<PayloadRequest['user']> & { collection: 'users' }

  it.each([
    { subscribed: false, registered: false },
    { subscribed: false, registered: true },
    { subscribed: true, registered: false },
    { subscribed: true, registered: true },
  ])('supports subscribed=$subscribed, registered=$registered without inferring either from the other', async ({ subscribed, registered }) => {
    const account = user(subscribed
      ? { id: 1, name: 'Provider', status: 'live', plan: 'base' } as AccessProvider
      : null)
    const find = vi.fn().mockImplementation(async ({ where }) => {
      const event = where.and.find((clause: { event?: unknown }) => clause.event)?.event.equals
      return { totalDocs: registered && event === 12 ? 1 : 0 }
    })
    const payload = { find } as unknown as Payload

    expect(await getSubscriptionPlan(account, payload)).toBe(subscribed ? 'base' : 'none')
    expect(find).not.toHaveBeenCalled()
    expect(await hasActiveRegistration(payload, account, 12)).toBe(registered)
    expect(await hasActiveRegistration(payload, account, 13)).toBe(false)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'event-registrations',
      where: { and: [
        { event: { equals: 12 } }, { attendee: { equals: 7 } },
        { status: { equals: 'active' } }, { 'order.status': { equals: 'paid' } },
      ] },
    }))
  })
})
