import { describe, expect, it } from 'vitest'

import { excerptFiltersToQueryString, excerptWhere, parseExcerptFilters } from './excerptFilters'

describe('parseExcerptFilters', () => {
  it('picks the single values we care about off searchParams', () => {
    const filters = parseExcerptFilters({
      sector: '1',
      product: '2',
      subject: '3',
      location: '4',
      keyword: 'tax',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      unrelated: 'ignored',
    })
    expect(filters).toEqual({
      sector: '1',
      product: '2',
      subject: '3',
      location: '4',
      keyword: 'tax',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
    })
  })

  it('takes the first value when Next hands back an array (repeated query param)', () => {
    const filters = parseExcerptFilters({ sector: ['1', '2'] })
    expect(filters.sector).toBe('1')
  })

  it('leaves fields undefined when absent', () => {
    expect(parseExcerptFilters({})).toEqual({
      sector: undefined,
      product: undefined,
      subject: undefined,
      location: undefined,
      keyword: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  })
})

describe('excerptWhere', () => {
  it('returns an empty where clause when no filters are set', () => {
    expect(excerptWhere({}, 'sourceDate')).toEqual({})
  })

  it('builds an "in" clause for each index-term filter', () => {
    expect(excerptWhere({ sector: '5' }, 'sourceDate')).toEqual({ and: [{ sectors: { in: ['5'] } }] })
  })

  it('uses the given date field for range filters', () => {
    expect(excerptWhere({ dateFrom: '2026-01-01' }, 'billDate')).toEqual({
      and: [{ billDate: { greater_than_equal: '2026-01-01' } }],
    })
    expect(excerptWhere({ dateTo: '2026-06-30' }, 'sourceDate')).toEqual({
      and: [{ sourceDate: { less_than_equal: '2026-06-30' } }],
    })
  })

  it('combines every active filter with and', () => {
    const where = excerptWhere(
      { sector: '1', product: '2', subject: '3', location: '4', dateFrom: '2026-01-01', dateTo: '2026-12-31' },
      'sourceDate',
    )
    expect(where).toEqual({
      and: [
        { sectors: { in: ['1'] } },
        { products: { in: ['2'] } },
        { subjects: { in: ['3'] } },
        { locations: { in: ['4'] } },
        { sourceDate: { greater_than_equal: '2026-01-01' } },
        { sourceDate: { less_than_equal: '2026-12-31' } },
      ],
    })
  })

  it('does not add a clause for keyword — that is handled via full-text search separately', () => {
    expect(excerptWhere({ keyword: 'tax' }, 'sourceDate')).toEqual({})
  })
})

describe('excerptFiltersToQueryString', () => {
  it('returns an empty string when no filters are set', () => {
    expect(excerptFiltersToQueryString({})).toBe('')
  })

  it('includes only the filters that are set', () => {
    expect(excerptFiltersToQueryString({ sector: '1', keyword: 'tax oh' })).toBe('sector=1&keyword=tax+oh')
  })

  it('round-trips through URLSearchParams parsing', () => {
    const qs = excerptFiltersToQueryString({ sector: '1', dateFrom: '2026-01-01', dateTo: '2026-06-30' })
    const parsed = Object.fromEntries(new URLSearchParams(qs))
    expect(parsed).toEqual({ sector: '1', dateFrom: '2026-01-01', dateTo: '2026-06-30' })
  })
})
