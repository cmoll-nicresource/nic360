import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Dataset } from '@/payload-types'
vi.mock('./frontendContext', () => ({ frontendContext: vi.fn() }))
import { frontendContext } from './frontendContext'
import { datasetPreview } from './datasetPreview'
const dataset = {
  id: 3,
  title: 'Test',
  slug: 'test',
  category: 'markets',
  columns: [
    { key: 'country', label: 'Country', type: 'country' },
    { key: 'year', label: 'Year', type: 'year' },
    { key: 'value', label: 'Value', type: 'number' },
  ],
} as Dataset
const find = vi.fn()
const query = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
})
describe('subscription protected dataset previews', () => {
  it('does not query any record data or coverage for an ineligible visitor', async () => {
    vi.mocked(frontendContext).mockResolvedValue({
      canReadData: false,
      payload: { find, db: { pool: { query } } },
    } as never)
    expect(await datasetPreview(dataset)).toBeNull()
    expect(find).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })
  it('uses full-dataset coverage but labels a bounded sample without aggregating its figures', async () => {
    const user = { id: 9, collection: 'users' }
    vi.mocked(frontendContext).mockResolvedValue({
      canReadData: true,
      user,
      payload: { find, db: { pool: { query } } },
    } as never)
    query.mockResolvedValue({ rows: [{ first: '2010', last: '2026', countries: '20' }] })
    find.mockImplementation(async ({ collection }) =>
      collection === 'countries'
        ? { docs: [{ iso2: 'US', name: 'United States' }] }
        : {
            docs: [
              { values: { country: 'US', year: 2026, value: 0 } },
              { values: { country: 'US', year: 2026, value: 10 } },
            ],
          },
    )
    const preview = await datasetPreview(dataset)
    expect(preview).toMatchObject({ first: '2010', last: '2026', countries: 20 })
    expect(preview!.bars.map((bar) => bar.value)).toEqual([10, 0])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'dataset-rows',
        limit: 5,
        user,
        overrideAccess: false,
      }),
    )
    expect(query).toHaveBeenCalledWith(expect.any(String), [3, 'year', 'country'])
  })
})
