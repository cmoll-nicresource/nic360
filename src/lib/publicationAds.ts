import type { Payload, Where } from 'payload'

import type { PublicationAd } from '@/payload-types'

/** How many ad slots an issue has: one before item 1, then one more every 2 items after. */
export function adSlotCount(itemCount: number): number {
  if (itemCount <= 0) return 0
  return Math.ceil(itemCount / 2)
}

/** True if an ad slot falls immediately before the item at this 0-indexed position (before item 0, 2, 4, …). Shared by the email and web renderers so both place ads the same way. */
export function isAdSlotBeforeIndex(index: number): boolean {
  return index % 2 === 0
}

/** A campaign's start date must be on or before its end date. */
export function isValidAdWindow(startDate: Date | string, endDate: Date | string): boolean {
  return new Date(startDate).getTime() <= new Date(endDate).getTime()
}

export function buildActiveAdsWhere(publicationId: number, now: Date): Where {
  const iso = now.toISOString()
  return {
    and: [
      { publication: { equals: publicationId } },
      { startDate: { less_than_equal: iso } },
      { endDate: { greater_than_equal: iso } },
    ],
  }
}

/** Ranked, currently-active ads for a publication, capped to `limit` slots. */
export async function getActiveAdsForPublication(
  payload: Payload,
  publicationId: number,
  limit: number,
  now: Date = new Date(),
): Promise<PublicationAd[]> {
  if (limit <= 0) return []

  const { docs } = await payload.find({
    collection: 'publication-ads',
    where: buildActiveAdsWhere(publicationId, now),
    sort: 'rank',
    limit,
    depth: 1,
    overrideAccess: true,
  })
  return docs
}
