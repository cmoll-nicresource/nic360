import type { Payload, Where } from 'payload'

export type AdStatsRow = {
  id: number
  advertiser: string
  publicationId: number | null
  publicationTitle: string
  rank: number
  startDate: string
  endDate: string
  impressions: number
  clicks: number
  ctr: number | null
}

export type AdStatsFilters = {
  publicationId?: number
}

function ctr(clicks: number, impressions: number): number | null {
  return impressions > 0 ? clicks / impressions : null
}

/** Every ad matching the filter, ranked order within each publication, with its impression/click counts and computed click-through rate. */
export async function searchAdStats(payload: Payload, filters: AdStatsFilters): Promise<AdStatsRow[]> {
  const where: Where = filters.publicationId ? { publication: { equals: filters.publicationId } } : {}

  const { docs } = await payload.find({
    collection: 'publication-ads',
    where,
    sort: 'rank',
    depth: 1,
    limit: 500,
    overrideAccess: true,
  })

  return docs.map((ad) => {
    const impressions = ad.stats?.impressions ?? 0
    const clicks = ad.stats?.clicks ?? 0
    return {
      id: ad.id,
      advertiser: ad.advertiser,
      publicationId: typeof ad.publication === 'object' ? ad.publication.id : ad.publication,
      publicationTitle: typeof ad.publication === 'object' ? ad.publication.title : '',
      rank: ad.rank,
      startDate: ad.startDate,
      endDate: ad.endDate,
      impressions,
      clicks,
      ctr: ctr(clicks, impressions),
    }
  })
}

export type AdStatsTotals = {
  count: number
  totalImpressions: number
  totalClicks: number
  avgCtr: number | null
}

/** Totals across a set of ads, plus the overall click-through rate (clicks over impressions across the whole set — unlike the Publications tab's per-issue average, ad campaigns don't vary enough in size for that distinction to matter here). */
export function summarizeAdStats(rows: AdStatsRow[]): AdStatsTotals {
  const totalImpressions = rows.reduce((n, r) => n + r.impressions, 0)
  const totalClicks = rows.reduce((n, r) => n + r.clicks, 0)

  return {
    count: rows.length,
    totalImpressions,
    totalClicks,
    avgCtr: ctr(totalClicks, totalImpressions),
  }
}
