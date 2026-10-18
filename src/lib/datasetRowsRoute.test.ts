import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./requireSubscriptionPlan', () => ({ requireSubscriptionPlan: vi.fn() }))
import { requireSubscriptionPlan } from './requireSubscriptionPlan'
import { GET } from '@/app/api/datasets/[id]/rows/route'
const find = vi.fn()
const findByID = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
})
const request = (page = '1') =>
  GET(new Request(`https://example.test/api/datasets/3/rows?page=${page}`), {
    params: Promise.resolve({ id: '3' }),
  })
describe('paginated dataset rows', () => {
  it('enforces Premium before returning data or querying a dataset', async () => {
    vi.mocked(requireSubscriptionPlan).mockRejectedValue(new Response('Forbidden', { status: 403 }))
    expect((await request()).status).toBe(403)
    expect(requireSubscriptionPlan).toHaveBeenCalledWith('premium')
    expect(find).not.toHaveBeenCalled()
  })
  it('returns stable numbered pages and complete counts so viewers can pass 10,000 rows', async () => {
    vi.mocked(requireSubscriptionPlan).mockResolvedValue({ payload: { find, findByID } } as never)
    findByID.mockResolvedValue({
      id: 3,
      columns: [{ key: 'value', label: 'Value', type: 'number' }],
    })
    find.mockImplementation(async ({ collection }) =>
      collection === 'countries'
        ? { docs: [] }
        : { docs: [{ values: { value: 0 } }], page: 6, totalPages: 11, totalDocs: 21000 },
    )
    const response = await request('6')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      rows: [{ value: 0 }],
      page: 6,
      totalPages: 11,
      totalDocs: 21000,
    })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'dataset-rows', page: 6, limit: 2000, sort: 'id' }),
    )
  })
  it.each(['0', '-1', '1.5', 'NaN'])('rejects invalid page %s', async (page) => {
    vi.mocked(requireSubscriptionPlan).mockResolvedValue({ payload: { find, findByID } } as never)
    expect((await request(page)).status).toBe(400)
    expect(findByID).not.toHaveBeenCalled()
  })
})
