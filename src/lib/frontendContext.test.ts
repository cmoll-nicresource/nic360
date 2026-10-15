import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('@/access/readerPlan', () => ({
  getReaderPlan: vi.fn(),
  planSatisfies: (plan: string, required: string) => plan === 'premium' || plan === required,
}))
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { getReaderPlan } from '@/access/readerPlan'
import { frontendContext } from './frontendContext'
beforeEach(() => vi.resetAllMocks())
describe('request-scoped reader context', () => {
  it('does not initialize the private database when Next suspends static rendering at headers()', async () => {
    vi.mocked(headers).mockRejectedValue(new Error('Dynamic server usage'))
    await expect(frontendContext()).rejects.toThrow('Dynamic server usage')
    expect(getPayload).not.toHaveBeenCalled()
  })
  it('authenticates the current request before resolving its effective plan', async () => {
    const requestHeaders = new Headers({ cookie: 'example=test' })
    const auth = vi.fn().mockResolvedValue({ user: { id: 1, collection: 'users' } })
    vi.mocked(headers).mockResolvedValue(requestHeaders as never)
    vi.mocked(getPayload).mockResolvedValue({ auth } as never)
    vi.mocked(getReaderPlan).mockResolvedValue('base')
    const result = await frontendContext()
    expect(auth).toHaveBeenCalledWith({ headers: requestHeaders })
    expect(result).toMatchObject({
      plan: 'base',
      canRead: true,
      canReadData: false,
      isStaff: false,
    })
  })
})
