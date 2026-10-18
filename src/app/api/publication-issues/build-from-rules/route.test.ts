import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ requireStaff: vi.fn(), findByID: vi.fn(), build: vi.fn(), create: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/requireStaff', () => ({ requireStaff: m.requireStaff }))
vi.mock('@/lib/publicationRules', () => ({ buildSectionsFromRules: m.build }))
import { POST } from './route'
const input = { format: 'excerpt-list', publication: 7, issueDate: '2090-10-16T00:00:00Z' }
const request = (data: unknown) => new Request('http://site.example/api/publication-issues/build-from-rules', { method: 'POST', body: JSON.stringify(data) })
beforeEach(() => {
  vi.resetAllMocks()
  m.requireStaff.mockResolvedValue({ payload: m, user: { id: 1, collection: 'staff', role: 'editor' } })
  m.findByID.mockResolvedValue({ id: 7 })
  m.build.mockResolvedValue([{ heading: 'Regulation', items: [{ relationTo: 'articles', value: 9 }] }])
})
it('builds from current form selections without creating or updating an issue', async () => {
  const response = await POST(request(input))
  expect(await response.json()).toEqual({ sections: [{ heading: 'Regulation', items: [{ relationTo: 'articles', value: 9 }] }], sectionCount: 1, itemCount: 1 })
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(m.findByID.mock.calls[0][0]).toMatchObject({ collection: 'publications', id: 7, overrideAccess: false })
  expect(m.build).toHaveBeenCalledWith(m, { id: 7 }, input.issueDate)
  expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled()
})
it.each([{ format: 'pdf-report' }, { publication: null }, { publication: 'invalid' }, { issueDate: '2090-02-30' }, { issueDate: null }, null])('rejects incomplete or invalid selections: %j', async extra => {
  expect((await POST(request(extra ? { ...input, ...extra } : null))).status).toBe(400)
  expect(m.build).not.toHaveBeenCalled()
})
it('does not build for users or anonymous requests', async () => {
  m.requireStaff.mockRejectedValue(new Response('Forbidden', { status: 403 }))
  expect((await POST(request(input))).status).toBe(403)
  expect(m.findByID).not.toHaveBeenCalled()
})
it('returns a clear missing-publication error and leaves the issue untouched', async () => {
  m.findByID.mockRejectedValue(new Error('not found'))
  expect((await POST(request(input))).status).toBe(404)
  expect(m.build).not.toHaveBeenCalled()
})
it('returns an empty section list for a valid window with no matching excerpts', async () => {
  m.build.mockResolvedValue([])
  expect(await (await POST(request(input))).json()).toMatchObject({ sections: [], itemCount: 0, sectionCount: 0 })
})
