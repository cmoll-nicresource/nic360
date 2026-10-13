import type { Where } from 'payload'

export type TrademarkFilterParams = {
  keyword?: string
  dateFrom?: string
  dateTo?: string
}

/** Narrows Next's searchParams (string | string[] | undefined) down to single values we care about. */
export function parseTrademarkFilters(searchParams: Record<string, string | string[] | undefined>): TrademarkFilterParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return {
    keyword: one(searchParams.keyword),
    dateFrom: one(searchParams.dateFrom),
    dateTo: one(searchParams.dateTo),
  }
}

// Unlike Articles/Bills, a Trademark has no single canonical date — which one
// is set depends on its status (published/registered/cancelled/renewed, see
// src/lib/tmog/classify.ts). A date-range filter has to match activity on
// *any* of them, not just one field.
const DATE_FIELDS = ['publishedDate', 'filedDate', 'registeredDate', 'cancelledDate', 'renewedDate'] as const

/** Builds a Payload `where` clause for the date-range filter. Keyword matching is a separate Postgres full-text search — see excerptWhere's comment for why. */
export function trademarkWhere(filters: TrademarkFilterParams): Where {
  if (!filters.dateFrom && !filters.dateTo) return {}

  const or: Where[] = DATE_FIELDS.map((field) => {
    const and: Where[] = []
    if (filters.dateFrom) and.push({ [field]: { greater_than_equal: filters.dateFrom } })
    if (filters.dateTo) and.push({ [field]: { less_than_equal: filters.dateTo } })
    return { and }
  })

  return { or }
}
