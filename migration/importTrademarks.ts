/**
 * Migrates Trademarks from the old site. All 13,605 rows are status =
 * 'Published' already, so there's no draft/published split to make here
 * (unlike Articles/Bills). Trademarks stay unindexed (no Subject/Sector/
 * Product tags), per the entity map.
 *
 * `style`/`design` are always null in the real data (never populated, even
 * though the new schema has Yes/No/N/A selects for them) — left unset.
 * `serial_number` is Payload's `unique: true` field but repeats on 75 old
 * rows; the first row for a given serial number wins, the rest are skipped
 * and logged rather than erroring the whole run.
 *
 * No image re-hosting: `image_url` pointed at the USPTO's own image
 * endpoint, which already 404s for plenty of marks today (the schema's own
 * comment anticipates this) — downloading and re-hosting 13,605 external
 * images is its own job, not part of this historical backfill. `image`
 * stays blank for every migrated row; the weekly USPTO import job (not yet
 * built) is the real path for images going forward.
 *
 * Usage: npx tsx migration/importTrademarks.ts
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
const clean = (v: string | undefined) => (v === undefined || v === NULL || v === '' ? undefined : v)

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

function toISO(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const d = new Date(raw.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return undefined
  if (d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100) return undefined
  return d.toISOString()
}

const TM_COL = {
  id: 0, status: 3, company: 4, classType: 5, filedDate: 6, publishedDate: 7, products: 8,
  serialNumber: 9, title: 12, firstUsedDate: 15, createdAt: 16, commercialUseDate: 19,
  registeredDate: 20, registeredNumber: 21, cancelledDate: 22, renewedDate: 23, renewedOwner: 24,
}

type Trademark = Record<keyof typeof TM_COL, string>

async function main() {
  console.log('Reading trademarks...')
  const trademarks: Trademark[] = []
  await streamTable('trademarks', (f) => {
    if (f[TM_COL.status] !== 'Published') return
    const row = {} as Trademark
    for (const [key, idx] of Object.entries(TM_COL)) row[key as keyof typeof TM_COL] = f[idx]
    trademarks.push(row)
  })
  console.log(`  ${trademarks.length} published trademarks`)

  const seenSerialNumbers = new Set<string>()
  let dupesSkipped = 0
  const deduped = trademarks.filter((t) => {
    const sn = clean(t.serialNumber)
    if (!sn) return true
    if (seenSerialNumbers.has(sn)) {
      dupesSkipped++
      return false
    }
    seenSerialNumbers.add(sn)
    return true
  })
  console.log(`  ${dupesSkipped} duplicate serial numbers skipped (kept the first occurrence of each)`)

  const payload = await getPayload({ config })

  console.log('\nImporting Trademarks...')
  let created = 0
  let skippedExisting = 0
  let failed = 0
  for (const t of deduped) {
    const existing = await payload.find({
      collection: 'trademarks',
      where: { and: [{ 'ingestion.source': { equals: 'migration' } }, { 'ingestion.externalId': { equals: t.id } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      skippedExisting++
      continue
    }

    try {
      await payload.create({
        collection: 'trademarks',
        data: {
          title: clean(t.title) ?? `Untitled (legacy #${t.id})`,
          serialNumber: clean(t.serialNumber),
          class: clean(t.classType),
          owner: clean(t.company),
          publishedDate: toISO(clean(t.publishedDate)),
          firstUsedDate: toISO(clean(t.firstUsedDate)),
          commercialUseDate: toISO(clean(t.commercialUseDate)),
          filedDate: toISO(clean(t.filedDate)),
          registeredDate: toISO(clean(t.registeredDate)),
          registrationNumber: clean(t.registeredNumber),
          cancelledDate: toISO(clean(t.cancelledDate)),
          renewedDate: toISO(clean(t.renewedDate)),
          renewal: { owner: clean(t.renewedOwner) },
          goods: clean(t.products),
          ingestion: { source: 'migration', externalId: t.id, importedAt: new Date().toISOString() },
          _status: 'published',
        },
        overrideAccess: true,
      })
      created++
      if (created % 1000 === 0) console.log(`  ...${created} created`)
    } catch (err) {
      failed++
      console.error(`  FAILED trademark legacy #${t.id}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nDone. ${created} created, ${skippedExisting} already existed, ${failed} failed.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
