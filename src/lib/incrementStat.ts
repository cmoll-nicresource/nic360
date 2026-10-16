import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { transactionDb } from './payloadTransaction'

export type PublicationIssueStatColumn =
  'stats_delivered' | 'stats_opens' | 'stats_clicks' | 'stats_bounces' | 'stats_complaints'

// Allowlisted, never request input — see src/lib/fullTextSearch.ts for the same pattern/reasoning.
const ALLOWED_COLUMNS = new Set<PublicationIssueStatColumn>([
  'stats_delivered',
  'stats_opens',
  'stats_clicks',
  'stats_bounces',
  'stats_complaints',
])

/**
 * Atomically increments one `publication_issues` stat column via raw SQL,
 * rather than fetch-then-update through the Local API — the SES webhook can
 * receive bursts of concurrent events (many opens close together), and a
 * read-modify-write in application code would lose increments under that.
 */
export async function incrementPublicationIssueStat(
  payload: Payload,
  issueId: number,
  column: PublicationIssueStatColumn,
  by = 1,
  req?: PayloadRequest,
): Promise<void> {
  if (!ALLOWED_COLUMNS.has(column)) throw new Error(`Unknown stat column: ${column}`)
  if (!Number.isSafeInteger(by) || by < 0)
    throw new Error('Issue statistic increments must be nonnegative safe integers')
  const statement = sql`WITH counters AS (
    UPDATE publication_issues SET ${sql.raw(`"${column}"`)}=coalesce(${sql.raw(`"${column}"`)},0)+${by}
    WHERE id=${issueId} RETURNING id,${sql.raw(`"${column}"`)}
  ) UPDATE _publication_issues_v v SET ${sql.raw(`"version_${column}"`)}=counters.${sql.raw(`"${column}"`)}
    FROM counters WHERE v.parent_id=counters.id AND v.latest=true`
  if (req?.transactionID) {
    const transactionID = await req.transactionID
    await transactionDb(payload, transactionID).execute(statement)
    return
  }
  await payload.db.pool.query(
    `WITH counters AS (UPDATE publication_issues SET "${column}"=coalesce("${column}",0)+$1 WHERE id=$2 RETURNING id,"${column}")
     UPDATE _publication_issues_v v SET "version_${column}"=counters."${column}" FROM counters WHERE v.parent_id=counters.id AND v.latest=true`,
    [by, issueId],
  )
}
