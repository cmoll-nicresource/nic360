import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), get: vi.fn() }))
vi.mock('payload', () => ({ getPayload: m.get }))
vi.mock('@/payload.config', () => ({ default: {} }))
import { GET } from './route'
beforeEach(() => { vi.resetAllMocks(); m.get.mockResolvedValue(m) })
it('returns every page of existing terms with hierarchy labels', async () => {
  m.auth.mockResolvedValue({ user: { collection: 'staff', role: 'editor' } })
  m.find.mockResolvedValueOnce({ docs: [{ id: 1, name: 'Canada', level: 'country', parent: 2 }], hasNextPage: true })
    .mockResolvedValueOnce({ docs: [{ id: 2, name: 'North America', level: 'region' }], hasNextPage: false })
  const response = await GET(new Request('https://site.example/api/extension/locations'))
  expect((await response.json()).locations).toHaveLength(2)
  expect(m.find).toHaveBeenCalledTimes(2)
  expect(m.find.mock.calls[0][0].overrideAccess).toBe(false)
})
it('rejects non-staff users', async () => {
  m.auth.mockResolvedValue({ user: { collection: 'users' } })
  expect((await GET(new Request('https://site.example'))).status).toBe(401)
  expect(m.find).not.toHaveBeenCalled()
})
