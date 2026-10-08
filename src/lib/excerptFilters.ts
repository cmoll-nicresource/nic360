import type { Where } from 'payload'

export type ExcerptFilterParams = {
  sector?: string
  product?: string
  subject?: string
  location?: string
}

/** Narrows Next's searchParams (string | string[] | undefined) down to single values we care about. */
export function parseExcerptFilters(searchParams: Record<string, string | string[] | undefined>): ExcerptFilterParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return {
    sector: one(searchParams.sector),
    product: one(searchParams.product),
    subject: one(searchParams.subject),
    location: one(searchParams.location),
  }
}

/** Builds a Payload `where` clause for hasMany index-term fields shared by Articles and Bills. */
export function excerptWhere(filters: ExcerptFilterParams): Where {
  const and: Where[] = []
  if (filters.sector) and.push({ sectors: { in: [filters.sector] } })
  if (filters.product) and.push({ products: { in: [filters.product] } })
  if (filters.subject) and.push({ subjects: { in: [filters.subject] } })
  if (filters.location) and.push({ locations: { in: [filters.location] } })
  return and.length ? { and } : {}
}
