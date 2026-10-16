import { sql } from '@payloadcms/db-postgres'
import type { CollectionBeforeChangeHook } from 'payload'
import { transactionDb } from '@/lib/payloadTransaction'

/** Metrics belong to the issue, not its editable version snapshot. Serialize
 * version writes with webhook increments and always carry authoritative counters.
 */
export const preserveIssueStats: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation !== 'update' || !originalDoc?.id) return data
  const tx = transactionDb(req.payload, await req.transactionID)
  const current = await tx.execute(
    sql`SELECT stats_recipient_count,stats_delivered,stats_opens,stats_clicks,stats_bounces,stats_complaints FROM publication_issues WHERE id=${originalDoc.id} FOR UPDATE`,
  )
  const row = current.rows[0]
  if (row) {
    const counters: Record<string, number> = {}
    for (const [column, value] of Object.entries(row)) {
      const number = Number(value ?? 0)
      if (!Number.isSafeInteger(number) || number < 0)
        throw new Error(`Invalid issue metric ${column}`)
      const field = column
        .replace(/^stats_/, '')
        .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())
      counters[field] = number
    }
    data.stats = counters
  }
  return data
}
