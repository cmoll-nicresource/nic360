import type { Payload } from 'payload'

/**
 * Atomic `publication_ads` stat increments via raw SQL, same reasoning as
 * `incrementStat.ts`: click-throughs can arrive concurrently and a
 * read-modify-write in application code would lose increments under that.
 */
export async function incrementAdClicks(payload: Payload, adId: number, by = 1): Promise<void> {
  await payload.db.pool.query(`update "publication_ads" set "stats_clicks" = coalesce("stats_clicks", 0) + $1 where id = $2`, [
    by,
    adId,
  ])
}

export async function incrementAdImpressions(payload: Payload, adId: number, by = 1): Promise<void> {
  await payload.db.pool.query(
    `update "publication_ads" set "stats_impressions" = coalesce("stats_impressions", 0) + $1 where id = $2`,
    [by, adId],
  )
}
