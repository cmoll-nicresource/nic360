import { describe, expect, it, vi } from 'vitest'
import type { Payload, Where } from 'payload'
import type { Publication } from '@/payload-types'
import { buildSectionsFromRules } from './publicationRules'
import { publicationDateWindow } from './publicationDateWindow'

const locations = [
  { id: 1, name: 'United States', level: 'country', parent: 7 },
  { id: 2, name: 'Pennsylvania', level: 'state', parent: 1 },
  { id: 3, name: 'Philadelphia', level: 'city', parent: 2 },
  { id: 4, name: 'China', level: 'country', parent: 5 },
  { id: 5, name: 'Asia', level: 'region' },
  { id: 6, name: 'United Kingdom', level: 'country' },
  { id: 7, name: 'North America', level: 'region' },
]
const article = (id: number, locs: number[], extra = {}) => ({
  id,
  title: 'Story ' + id,
  locations: locs,
  _status: 'published',
  sourceDate: '2026-10-15T12:00:00Z',
  products: [],
  ...extra,
})
const articles = [
  article(1, [1]),
  article(2, [4]),
  article(3, [1, 4]),
  article(4, [3]),
  article(5, []),
  article(6, [1], { _status: 'draft' }),
  article(7, [1], { sourceDate: '2026-10-17T04:00:00Z' }),
  article(8, [1], { sourceDate: '2026-10-10T03:59:59Z' }),
  article(9, [1], { products: [75] }),
  article(10, [4], { products: [75] }),
]
function matches(doc: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return (condition as Where[]).every((c) => matches(doc, c))
    if (field === 'or') return (condition as Where[]).some((c) => matches(doc, c))
    const value = doc[field],
      values = Array.isArray(value) ? value : [value]
    return Object.entries(condition as Record<string, unknown>).every(([op, test]) => {
      if (op === 'equals') return values.includes(test)
      if (op === 'in') return values.some((v) => (test as unknown[]).includes(v))
      if (op === 'not_in') return values.every((v) => !(test as unknown[]).includes(v))
      if (op === 'greater_than_equal') return String(value) >= String(test)
      if (op === 'less_than') return String(value) < String(test)
      throw Error('Unexpected operator ' + op)
    })
  })
}
function fixture() {
  const find = vi.fn(
    async (options: { collection: string; where?: Where; page?: number; limit?: number }) => {
      let docs: Record<string, unknown>[] =
        options.collection === 'locations'
          ? locations
          : options.collection === 'articles'
            ? articles
            : [
                {
                  id: 20,
                  title: 'Bill',
                  locations: [1],
                  _status: 'published',
                  billDate: '2026-10-15T12:00:00Z',
                },
              ]
      if (options.where) docs = docs.filter((d) => matches(d, options.where!))
      const page = options.page ?? 1,
        limit = options.limit ?? 500
      return {
        docs: structuredClone(docs.slice((page - 1) * limit, page * limit)),
        hasNextPage: page * limit < docs.length,
      }
    },
  )
  return { payload: { find } as unknown as Payload, find }
}
const pub = (slug: string, selectionRules = {}) =>
  ({
    id: 1,
    title: slug.replaceAll('-', ' '),
    slug,
    frequency: 'weekly',
    selectionRules,
    groupingRules: { groupBy: 'none', sortBy: 'title' },
  }) as Publication
const ids = (sections: Awaited<ReturnType<typeof buildSectionsFromRules>>) =>
  sections.flatMap((s) => s.items.map((i) => i.value)).sort((a, b) => a - b)
describe('publication selection boundaries', () => {
  it('includes US state/city stories and vapor, excludes foreign-only, untagged, draft and out-of-window stories', async () => {
    const { payload } = fixture()
    expect(
      ids(
        await buildSectionsFromRules(
          payload,
          pub('us-news-clippings', { products: { exclude: [75] } }),
          '2026-10-16T00:00:00Z',
        ),
      ),
    ).toEqual([1, 3, 4, 9])
  })
  it('includes mixed US/China stories in Global and groups under the non-US location', async () => {
    const { payload, find } = fixture(),
      publication = pub('global-news-clippings', { excerptTypes: ['articles', 'bills'] })
    publication.groupingRules = { groupBy: 'region' }
    const sections = await buildSectionsFromRules(payload, publication, '2026-10-16T00:00:00Z')
    expect(ids(sections)).toEqual([2, 3, 10])
    expect(sections.map((s) => s.heading)).toEqual(['Asia'])
    expect(find.mock.calls.some(([o]) => o.collection === 'bills')).toBe(false)
  })
  it('keeps Vapor product filtering and makes any Clippings publication news-only', async () => {
    const { payload, find } = fixture()
    expect(
      ids(
        await buildSectionsFromRules(
          payload,
          pub('vapor-news-clippings', {
            excerptTypes: ['articles', 'bills'],
            products: { include: [75] },
          }),
          '2026-10-16',
        ),
      ),
    ).toEqual([9, 10])
    expect(find.mock.calls.some(([o]) => o.collection === 'bills')).toBe(false)
  })
  it('fails closed when the US country cannot be resolved', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
    } as unknown as Payload
    await expect(
      buildSectionsFromRules(payload, pub('us-news-clippings'), '2026-10-16'),
    ).rejects.toThrow('United States')
    await expect(
      buildSectionsFromRules(payload, pub('global-news-clippings'), '2026-10-16'),
    ).rejects.toThrow('United States')
  })
  it('paginates locations and matching excerpts instead of truncating at the first page', async () => {
    const items = Array.from({ length: 501 }, (_, i) => article(i + 1, [3]))
    const find = vi.fn(async (o: { collection: string; page: number }) =>
      o.collection === 'locations'
        ? {
            docs: o.page === 1 ? locations.slice(0, 2) : locations.slice(2),
            hasNextPage: o.page === 1,
          }
        : { docs: items.slice((o.page - 1) * 500, o.page * 500), hasNextPage: o.page === 1 },
    )
    const result = await buildSectionsFromRules(
      { find } as unknown as Payload,
      pub('us-news-clippings'),
      '2026-10-16',
    )
    expect(ids(result)).toHaveLength(501)
    expect(find.mock.calls.filter(([o]) => o.collection === 'locations')).toHaveLength(2)
  })
})
describe('issue-date windows', () => {
  it('uses seven inclusive calendar days ending on the saved issue date', () => {
    expect(publicationDateWindow('2026-10-16T00:00:00Z', 7)).toEqual({
      since: '2026-10-10T04:00:00.000Z',
      until: '2026-10-17T04:00:00.000Z',
    })
    expect(publicationDateWindow('2026-10-16T18:00:00Z', 7)).toEqual(
      publicationDateWindow('2026-10-16', 7),
    )
  })
  it('handles spring and fall daylight saving days', () => {
    expect(publicationDateWindow('2026-03-08', 1)).toEqual({
      since: '2026-03-08T05:00:00.000Z',
      until: '2026-03-09T04:00:00.000Z',
    })
    expect(publicationDateWindow('2026-11-01', 1)).toEqual({
      since: '2026-11-01T04:00:00.000Z',
      until: '2026-11-02T05:00:00.000Z',
    })
  })
  it('rejects invalid dates and windows', () => {
    for (const [date, days] of [
      ['bad', 7],
      ['2026-10-16', -1],
      ['2026-10-16', 1.5],
    ] as const)
      expect(() => publicationDateWindow(date, days)).toThrow()
  })
})
