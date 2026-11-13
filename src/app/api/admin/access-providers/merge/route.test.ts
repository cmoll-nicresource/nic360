import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireStaff: vi.fn(), inspect: vi.fn(), apply: vi.fn(), connect: vi.fn(), query: vi.fn(), release: vi.fn(), info: vi.fn() }))
vi.mock('@/lib/requireStaff', () => ({ requireStaff: mocks.requireStaff }))
vi.mock('@/lib/mergeAccessProvider', async original => ({ ...(await original<typeof import('@/lib/mergeAccessProvider')>()), inspectProviderMerge: mocks.inspect, applyProviderMerge: mocks.apply }))
import { ProviderMergeError } from '@/lib/mergeAccessProvider'
import { POST } from './route'

const preview = { source: { users: 3 }, discountCodesToMove: 2, fingerprint: 'reviewed-state' }
const request = (body: unknown, origin = 'https://example.invalid') => new Request('https://example.invalid/api/admin/access-providers/merge', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireStaff.mockResolvedValue({ payload: { config: { serverURL: 'https://example.invalid' }, db: { pool: { connect: mocks.connect } }, logger: { info: mocks.info } }, user: { id: 1 } })
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release })
  mocks.query.mockResolvedValue({ rows: [] })
  mocks.inspect.mockResolvedValue({ preview })
  mocks.apply.mockResolvedValue(preview)
})
it('requires admin authorization before opening a database connection', async () => {
  mocks.requireStaff.mockRejectedValue(new Response('Forbidden', { status: 403 }))
  expect((await POST(request({ action: 'preview', sourceId: 1, targetId: 2 }))).status).toBe(403)
  expect(mocks.requireStaff).toHaveBeenCalledWith('admin')
  expect(mocks.connect).not.toHaveBeenCalled()
})
it('rejects cross-origin requests, self merges and unconfirmed writes before accessing the database', async () => {
  expect((await POST(request({ action: 'preview', sourceId: 1, targetId: 2 }, 'https://evil.invalid'))).status).toBe(403)
  expect((await POST(request({ action: 'preview', sourceId: 1, targetId: 1 }))).status).toBe(400)
  expect((await POST(request({ action: 'merge', sourceId: 1, targetId: 2 }))).status).toBe(400)
  expect(mocks.connect).not.toHaveBeenCalled()
})
it('previews in a private read-only transaction without applying or logging a merge', async () => {
  const res = await POST(request({ action: 'preview', sourceId: 1, targetId: 2 }))
  expect(res.status).toBe(200)
  expect(res.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.query).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  expect(mocks.apply).not.toHaveBeenCalled()
  expect(mocks.info).not.toHaveBeenCalled()
  expect(mocks.release).toHaveBeenCalledOnce()
})
it('accepts the configured public origin when a proxy changes the internal request URL', async () => {
  const req = new Request('http://localhost:3000/api/admin/access-providers/merge', { method: 'POST', headers: { origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', sourceId: 1, targetId: 2 }) })
  expect((await POST(req)).status).toBe(200)
})
it('commits confirmed merges and records the actor and moved counts', async () => {
  expect((await POST(request({ action: 'merge', sourceId: 1, targetId: 2, confirm: true, fingerprint: 'reviewed-state' }))).status).toBe(200)
  expect(mocks.apply).toHaveBeenCalledWith(expect.anything(), 1, 2, 'reviewed-state')
  expect(mocks.query).toHaveBeenCalledWith('COMMIT')
  expect(mocks.info).toHaveBeenCalledWith(expect.objectContaining({ staffId: 1, usersMoved: 3 }), expect.any(String))
})
it('rolls back stale merges and releases the connection', async () => {
  mocks.apply.mockRejectedValue(new ProviderMergeError('Changed since preview', 409))
  expect((await POST(request({ action: 'merge', sourceId: 1, targetId: 2, confirm: true, fingerprint: 'old' }))).status).toBe(409)
  expect(mocks.query).toHaveBeenCalledWith('ROLLBACK')
  expect(mocks.query).not.toHaveBeenCalledWith('COMMIT')
  expect(mocks.info).not.toHaveBeenCalled()
  expect(mocks.release).toHaveBeenCalledOnce()
})
