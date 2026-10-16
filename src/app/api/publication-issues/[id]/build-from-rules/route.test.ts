import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), build: vi.fn(), find: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/requireStaff', () => ({ requireStaff: mocks.auth }))
vi.mock('@/lib/publicationRules', () => ({ buildSectionsFromRules: mocks.build }))
import { POST } from './route'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ payload: { findByID: mocks.find, update: mocks.update } })
})
it('uses the saved draft issue date and writes only a draft', async () => {
  mocks.find
    .mockResolvedValueOnce({
      id: 1,
      _status: 'draft',
      format: 'excerpt-list',
      publication: 2,
      issueDate: '2026-10-16T00:00:00Z',
    })
    .mockResolvedValueOnce({ id: 2 })
  mocks.build.mockResolvedValue([{ heading: 'All', items: [{ relationTo: 'articles', value: 3 }] }])
  mocks.update.mockResolvedValue({ id: 1 })
  expect(
    (await POST(new Request('https://example.invalid'), { params: Promise.resolve({ id: '1' }) }))
      .status,
  ).toBe(200)
  expect(mocks.build.mock.calls[0][2]).toBe('2026-10-16T00:00:00Z')
  expect(mocks.update.mock.calls[0][0].draft).toBe(true)
  expect(mocks.find.mock.calls[0][0].draft).toBe(true)
})
it('protects published issues against rebuilding', async () => {
  mocks.find.mockResolvedValueOnce({ id: 1, _status: 'published', format: 'excerpt-list' })
  expect(
    (await POST(new Request('https://example.invalid'), { params: Promise.resolve({ id: '1' }) }))
      .status,
  ).toBe(400)
  expect(mocks.update).not.toHaveBeenCalled()
  expect(mocks.build).not.toHaveBeenCalled()
})
