import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./requireSubscriptionPlan', () => ({ requireSubscriptionPlan: vi.fn() }))
import { requireSubscriptionPlan } from './requireSubscriptionPlan'
import { GET } from '@/app/api/datasets/[id]/export/route'
const find = vi.fn()
const findByID = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
})
describe('complete dataset downloads', () => {
  it.each(['csv', 'xlsx'])(
    'exports all pages as %s, preserving zero and country labels',
    async (format) => {
      vi.mocked(requireSubscriptionPlan).mockResolvedValue({ payload: { find, findByID } } as never)
      findByID.mockResolvedValue({
        id: 3,
        slug: 'qa',
        columns: [
          { key: 'country', label: 'Country', type: 'country' },
          { key: 'value', label: 'Value', type: 'number' },
        ],
      })
      find.mockImplementation(async ({ collection, page }) =>
        collection === 'countries'
          ? { docs: [{ iso2: 'US', name: 'United States' }] }
          : { docs: [{ values: { country: 'US', value: page === 1 ? 0 : 12 } }], totalPages: 2 },
      )
      const response = await GET(
        new Request(`https://example.test/api/datasets/3/export?format=${format}`),
        { params: Promise.resolve({ id: '3' }) },
      )
      expect(response.status).toBe(200)
      const rows =
        format === 'csv'
          ? Papa.parse(await response.text()).data
          : XLSX.utils.sheet_to_json(XLSX.read(await response.arrayBuffer()).Sheets.Data, {
              header: 1,
            })
      expect(rows).toEqual(
        format === 'csv'
          ? [
              ['Country', 'Value'],
              ['United States', '0'],
              ['United States', '12'],
            ]
          : [
              ['Country', 'Value'],
              ['United States', 0],
              ['United States', 12],
            ],
      )
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'dataset-rows', page: 2, sort: 'id' }),
      )
      expect(requireSubscriptionPlan).toHaveBeenCalledWith('premium')
    },
  )
})
