import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { logPageView } from './logPageView'

function fakePayload() {
  const create = vi.fn().mockResolvedValue({ id: 1 })
  return { payload: { create } as unknown as Payload, create }
}

describe('logPageView', () => {
  it('records a signed-out visit with no visitor', async () => {
    const { payload, create } = fakePayload()
    await logPageView(payload, '/articles', null)
    expect(create).toHaveBeenCalledWith({
      collection: 'page-views',
      data: { path: '/articles', visitor: undefined },
      overrideAccess: true,
    })
  })

  it('records a user visit with their id as the visitor', async () => {
    const { payload, create } = fakePayload()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = { id: 7, collection: 'users' } as any
    await logPageView(payload, '/dashboard', user)
    expect(create).toHaveBeenCalledWith({
      collection: 'page-views',
      data: { path: '/dashboard', visitor: 7 },
      overrideAccess: true,
    })
  })

  it('does not log staff visits at all', async () => {
    const { payload, create } = fakePayload()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = { id: 3, collection: 'staff' } as any
    await logPageView(payload, '/admin', user)
    expect(create).not.toHaveBeenCalled()
  })

  it('never throws, even if the write fails', async () => {
    const payload = { create: vi.fn().mockRejectedValue(new Error('db down')) } as unknown as Payload
    await expect(logPageView(payload, '/articles', null)).resolves.toBeUndefined()
  })
})
