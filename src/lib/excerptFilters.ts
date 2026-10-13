import type { Where } from 'payload'

export type ExcerptFilterParams = {
  sector?: string
  product?: string
  subject?: string
  location?: string
  keyword?: string
  dateFrom?: string
  dateTo?: string
}

/** Narrows Next's searchParams (string | string[] | undefined) down to single values we care about. */
export function parseExcerptFilters(searchParams: Record<string, string | string[] | undefined>): ExcerptFilterParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return {
    sector: one(searchParams.sector),
    product: one(searchParams.product),
    subject: one(searchParams.subject),
    location: one(searchParams.location),
    keyword: one(searchParams.keyword),
    dateFrom: one(searchParams.dateFrom),
    dateTo: one(searchParams.dateTo),
  }
}

/**
 * Builds a Payload `where` clause for the index-term and date-range filters
 * shared by Articles and Bills. `dateField` is `sourceDate` for Articles,
 * `billDate` for Bills — each collection's own "when did this happen" field.
 * Keyword matching isn't handled here: that's a Postgres full-text search
 * (src/lib/fullTextSearch.ts) run separately and combined by the caller via
 * an `id: { in: [...] }` clause, since Payload's own `where` operators can't
 * express `to_tsvector`/`ts_rank`.
 */
export function excerptWhere(filters: ExcerptFilterParams, dateField: 'sourceDate' | 'billDate'): Where {
  const and: Where[] = []
  if (filters.sector) and.push({ sectors: { in: [filters.sector] } })
  if (filters.product) and.push({ products: { in: [filters.product] } })
  if (filters.subject) and.push({ subjects: { in: [filters.subject] } })
  if (filters.location) and.push({ locations: { in: [filters.location] } })
  if (filters.dateFrom) and.push({ [dateField]: { greater_than_equal: filters.dateFrom } })
  if (filters.dateTo) and.push({ [dateField]: { less_than_equal: filters.dateTo } })
  return and.length ? { and } : {}
}
