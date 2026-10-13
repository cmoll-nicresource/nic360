import { describe, expect, it } from 'vitest'

import { parseTrademarkFilters, trademarkWhere } from './trademarkFilters'

describe('parseTrademarkFilters', () => {
  it('picks the single values we care about', () => {
    expect(parseTrademarkFilters({ keyword: 'smoky', dateFrom: '2026-01-01', dateTo: '2026-06-30', other: 'x' })).toEqual({
      keyword: 'smoky',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
    })
  })

  it('takes the first value from a repeated query param', () => {
    expect(parseTrademarkFilters({ keyword: ['a', 'b'] }).keyword).toBe('a')
  })
})

describe('trademarkWhere', () => {
  it('returns an empty where clause when no date filter is set', () => {
    expect(trademarkWhere({})).toEqual({})
    expect(trademarkWhere({ keyword: 'smoky' })).toEqual({})
  })

  it('matches a dateFrom against any of the five status dates', () => {
    const where = trademarkWhere({ dateFrom: '2026-01-01' })
    expect(where).toEqual({
      or: [
        { and: [{ publishedDate: { greater_than_equal: '2026-01-01' } }] },
        { and: [{ filedDate: { greater_than_equal: '2026-01-01' } }] },
        { and: [{ registeredDate: { greater_than_equal: '2026-01-01' } }] },
        { and: [{ cancelledDate: { greater_than_equal: '2026-01-01' } }] },
        { and: [{ renewedDate: { greater_than_equal: '2026-01-01' } }] },
      ],
    })
  })

  it('combines dateFrom and dateTo within each status date', () => {
    const where = trademarkWhere({ dateFrom: '2026-01-01', dateTo: '2026-06-30' })
    expect(where.or).toHaveLength(5)
    expect(where.or?.[0]).toEqual({
      and: [
        { publishedDate: { greater_than_equal: '2026-01-01' } },
        { publishedDate: { less_than_equal: '2026-06-30' } },
      ],
    })
  })
})
