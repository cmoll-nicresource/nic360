/**
 * Removes duplicate Bills created by the original migration. The old
 * site's `bills` table itself has the duplicates — 770 groups, 3,304 extra
 * rows, sharing an identical (title, bill_number) pair but different ids
 * and `created_at` spread over weeks/months (e.g. one bill appears 46
 * times, same bill_date, re-created every time some periodic StateNet
 * re-check ran instead of updating the existing row). The live old site
 * doesn't show these as duplicates, so something downstream of this table
 * already collapses them — this migration didn't, and should have.
 *
 * For each duplicate group, keeps the row with the latest old `created_at`
 * (the most recently re-synced, presumably most up to date) and deletes
 * the rest. Before deleting, re-points any Publication Issue section item
 * that referenced a soon-to-be-deleted duplicate onto the surviving
 * canonical bill instead — `bills` has `ON DELETE CASCADE` from
 * `publication_issues_rels`, so a plain delete would have silently
 * dropped that bill out of whatever issue listed it.
 *
 * Usage: npx tsx migration/dedupeBills.ts
 *
 * Re-pointing is done via direct SQL against `publication_issues_rels` and
 * its version-snapshot twin `_publication_issues_v_rels` (confirmed to
 * mirror each other 1:1 here — these issues were created already-published,
 * with no separate draft edit history): Payload's query engine doesn't
 * support filtering on a polymorphic relationship nested inside an array
 * field (`sections.items`), so there's no API-level way to find "every
 * issue referencing bill X" — tried it directly, it throws `APIError: Not
 * supported`. Deleting the duplicate bills themselves still goes through
 * the local API `delete()`, which cleans up the standard way (Bills'
 * own `ON DELETE CASCADE` rel rows, and `ON DELETE SET NULL` for its
 * version-history row — a few harmless orphaned version rows are an
 * acceptable, Payload-internal cost here).
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import zlib from 'zlib'
import { getPayload } from 'payload'

import config from '../src/payload.config'

const DUMP_PATH = path.join(process.cwd(), 'old-db', 'truecms.sql.gz')
const NULL = '\\N'

async function streamTable(tableName: string, onRow: (fields: string[]) => void): Promise<void> {
  const copyPrefix = `COPY public.${tableName} (`
  let inBlock = false
  const rl = readline.createInterface({
    input: fs.createReadStream(DUMP_PATH).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    if (!inBlock) {
      if (line.startsWith(copyPrefix)) inBlock = true
      continue
    }
    if (line === '\\.') break
    onRow(line.split('\t'))
  }
  rl.close()
}

const BILL_COL = { id: 0, title: 3, billNumber: 5, status: 6, createdAt: 23 }

async function main() {
  console.log('Reading old bills, grouping by (title, bill_number)...')
  const groups = new Map<string, { oldId: string; createdAt: string }[]>()
  await streamTable('bills', (f) => {
    if (f[BILL_COL.status] !== 'Published') return
    const title = f[BILL_COL.title]
    const billNumber = f[BILL_COL.billNumber]
    if (title === NULL || billNumber === NULL) return
    const key = `${title}\u0000${billNumber}`
    const list = groups.get(key) ?? []
    list.push({ oldId: f[BILL_COL.id], createdAt: f[BILL_COL.createdAt] })
    groups.set(key, list)
  })

  const dupGroups = [...groups.values()].filter((g) => g.length > 1)
  console.log(`  ${dupGroups.length} duplicate groups`)

  const payload = await getPayload({ config })

  let canonicalCount = 0
  let deleted = 0
  let repointed = 0
  let notFound = 0

  for (const group of dupGroups) {
    const sorted = [...group].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const canonicalOldId = sorted[0].oldId
    const duplicateOldIds = sorted.slice(1).map((g) => g.oldId)

    const canonical = (
      await payload.find({
        collection: 'bills',
        where: { and: [{ 'ingestion.source': { equals: 'migration' } }, { 'ingestion.externalId': { equals: canonicalOldId } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]
    if (!canonical) {
      notFound++
      continue
    }
    canonicalCount++

    for (const dupOldId of duplicateOldIds) {
      const dup = (
        await payload.find({
          collection: 'bills',
          where: { and: [{ 'ingestion.source': { equals: 'migration' } }, { 'ingestion.externalId': { equals: dupOldId } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      ).docs[0]
      if (!dup) {
        notFound++
        continue
      }

      // Re-point any Publication Issue section item that referenced this
      // duplicate onto the canonical bill before it's gone (direct SQL —
      // see the file header on why the Payload API can't do this query).
      const liveResult = await payload.db.pool.query(
        'UPDATE publication_issues_rels SET bills_id = $1 WHERE bills_id = $2',
        [canonical.id, dup.id],
      )
      const versionResult = await payload.db.pool.query(
        'UPDATE _publication_issues_v_rels SET bills_id = $1 WHERE bills_id = $2',
        [canonical.id, dup.id],
      )
      repointed += (liveResult.rowCount ?? 0) + (versionResult.rowCount ?? 0)

      await payload.delete({ collection: 'bills', id: dup.id, overrideAccess: true })
      deleted++
    }
  }

  console.log(`\nDone. ${canonicalCount} canonical bills kept, ${deleted} duplicates deleted, ${repointed} issue references re-pointed, ${notFound} not found (likely drafts never migrated).`)
  const { totalDocs } = await payload.count({ collection: 'bills', overrideAccess: true })
  console.log(`${totalDocs} bills remain.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
