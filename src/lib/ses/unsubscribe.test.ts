import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readUnsubscribeToken, unsubscribeToken } from './unsubscribe'
import { GET, POST } from '@/app/api/newsletters/unsubscribe/route'
import { flagUserByEmail } from '@/lib/emailFlags'
import { getPayload } from 'payload'

vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/payloadTransaction', () => ({
  inPayloadTransaction: async (_payload: unknown, work: (req: unknown) => Promise<unknown>) =>
    work({ transactionID: 'fixture' }),
}))
vi.mock('@/lib/emailFlags', () => ({ flagUserByEmail: vi.fn() }))
const findByID = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('PAYLOAD_SECRET', 'fixture-signing-secret')
  vi.mocked(getPayload).mockResolvedValue({ findByID } as unknown as Awaited<
    ReturnType<typeof getPayload>
  >)
  findByID.mockResolvedValue({ id: 8, email: 'user@example.invalid' })
})
afterEach(() => vi.unstubAllEnvs())
const url = (test = false) =>
  `https://beta.example.invalid/api/newsletters/unsubscribe?token=${unsubscribeToken(8, 'user@example.invalid', test)}`
it('authenticates the address, user ID and test scope; rejects altered and oversized tokens', () => {
  const token = unsubscribeToken(8, 'User@Example.invalid')
  expect(readUnsubscribeToken(token)).toEqual({
    userId: 8,
    email: 'user@example.invalid',
    test: false,
  })
  expect(readUnsubscribeToken('x' + token)).toBeNull()
  expect(readUnsubscribeToken('x'.repeat(2001))).toBeNull()
  expect(readUnsubscribeToken(token + '.extra')).toBeNull()
})
it('GET confirms without changing preferences or opening a database connection', async () => {
  const response = await GET(new Request(url()))
  expect(response.status).toBe(200)
  expect(await response.text()).toContain('method="post"')
  expect(getPayload).not.toHaveBeenCalled()
})
it('accepts RFC8058 one-click POST without login and uses the transactional flag pipeline', async () => {
  expect(
    (await POST(new Request(url(), { method: 'POST', body: 'List-Unsubscribe=One-Click' }))).status,
  ).toBe(200)
  expect(flagUserByEmail).toHaveBeenCalledWith(
    expect.anything(),
    'user@example.invalid',
    'unsubscribed',
    expect.any(String),
    expect.objectContaining({ transactionID: 'fixture' }),
  )
})
it('test links do not change a real user’s preferences', async () => {
  expect((await POST(new Request(url(true), { method: 'POST', body: 'confirm=yes' }))).status).toBe(
    200,
  )
  expect(getPayload).not.toHaveBeenCalled()
})
it('rejects unconfirmed requests and never unsubscribes an account that has changed email', async () => {
  expect((await POST(new Request(url(), { method: 'POST', body: '' }))).status).toBe(400)
  findByID.mockResolvedValue({ id: 8, email: 'changed@example.invalid' })
  expect((await POST(new Request(url(), { method: 'POST', body: 'confirm=yes' }))).status).toBe(200)
  expect(flagUserByEmail).not.toHaveBeenCalled()
})
