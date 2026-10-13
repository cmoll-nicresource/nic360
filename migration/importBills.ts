/**
 * Migrates published Bills from the old site. Field mapping, confirmed
 * against the real data rather than guessed:
 *
 * - `bill_type_id` (103 = "Bill", 786 = "Regulations") -> `billType`
 *   ('Bill'/'Regulation'); defaults to 'Bill' for the 41% of rows with no
 *   bill_type_id set, rather than leaving the required select empty.
 * - `government_level`: only "State/Province" (5,344 rows) and "National"
 *   (66 rows, mapped to 'Federal') are usable — the rest is null, blank, or
 *   literally "- Select a value -" placeholder junk, so this field was
 *   relaxed to optional (see the 2026-10-13 changelog entry).
 * - `bill_date`, falling back to `publication_date`, then `created_at`
 *   (every published row has at least one of the three) -> `billDate`.
 * - `link` (always present) -> `billUrl.url`; `url_title` -> `billUrl.title`.
 *   `action_url` is "non-null" on 5,661 rows but every one of those is an
 *   empty string, not real data — left unset.
 * - `statue_url`/`statue_title` (a real typo in the old column name, not
 *   mine) -> `statute.url`/`statute.title`.
 * - `abstract`/`content` (EditorJS blocks, both populated on every
 *   published row) -> `abstract`/`fullText` via editorJsToParagraphs().
 * - Sectors/Products/Subjects come from `excerpt_indices`
 *   (subjectable_type = 'Bill'), resolved the same way as Articles.
 * - `bill_actions` (a real child table: action/date/bill_id, 45,709 rows)
 *   -> the `actions` array. No per-action sponsor field existed, so
 *   `actor` is left unset on every migrated action.
 * - `related_articles` is "non-null" on 5,661 rows but every one is an
 *   empty string — nothing real to resolve, left unset.
 *
 * Usage: npx tsx migration/importBills.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import zlib from 'zlib'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { editorJsToParagraphs } from '../src/lib/editorJsImport'
import { lexicalFromParagraphs, lexicalFromText } from '../src/lib/lexical'

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
  // One real row has bill_date = "0015-12-30" (a year-4-digit typo for
  // 2015, presumably) — valid to JS's Date but outside any sane range,
  // and Postgres/Payload reject it on the read-back after insert.
  if (d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100) return undefined
  return d.toISOString()
}

const BILL_COL = {
  id: 0, title: 3, billNumber: 5, status: 6, session: 7, lawNumber: 8, governmentLevel: 9,
  actionUrl: 10, urlTitle: 11, link: 12, carriedBy: 13, billDate: 14, approvalDate: 15,
  effectiveDate: 16, publicationDate: 17, abstract: 18, content: 19, createdAt: 23,
  latestText: 27, latestActivity: 28, statueUrl: 39, statueTitle: 40, statusText: 44,
  committee: 45, primarySubjectId: 48, billTypeId: 49,
}

type Bill = Record<keyof typeof BILL_COL, string>

function mapGovernmentLevel(raw: string | undefined): 'Federal' | 'State/Province' | 'Local' | 'International' | undefined {
  if (raw === 'State/Province') return 'State/Province'
  if (raw === 'National') return 'Federal'
  return undefined
}

function mapBillType(billTypeId: string | undefined): 'Bill' | 'Resolution' | 'Amendment' | 'Executive Order' | 'Regulation' {
  if (billTypeId === '786') return 'Regulation'
  return 'Bill'
}

async function main() {
  console.log('Reading old taxonomies (for category + name lookup)...')
  const taxonomyCategoryById = new Map<string, string>()
  const taxonomyNameById = new Map<string, string>()
  await streamTable('taxonomies', (f) => {
    const [id, , category, name] = f
    taxonomyCategoryById.set(id, category)
    taxonomyNameById.set(id, name)
  })

  console.log('Reading excerpt_indices for Bills...')
  const tagsByBillId = new Map<string, string[]>()
  await streamTable('excerpt_indices', (f) => {
    const [, subjectableType, subjectableId, taxonomyId] = f
    if (subjectableType !== 'Bill' || taxonomyId === NULL) return
    const list = tagsByBillId.get(subjectableId) ?? []
    list.push(taxonomyId)
    tagsByBillId.set(subjectableId, list)
  })

  console.log('Reading bill_actions...')
  const actionsByBillId = new Map<string, { date: string; action: string }[]>()
  await streamTable('bill_actions', (f) => {
    const [, action, date, , billId] = f
    if (clean(action) === undefined) return
    const list = actionsByBillId.get(billId) ?? []
    list.push({ date, action })
    actionsByBillId.set(billId, list)
  })
  console.log(`  ${[...actionsByBillId.values()].reduce((sum, l) => sum + l.length, 0)} actions across ${actionsByBillId.size} bills`)

  console.log('Reading bills...')
  const allBills: Bill[] = []
  await streamTable('bills', (f) => {
    if (f[BILL_COL.status] !== 'Published') return
    const row = {} as Bill
    for (const [key, idx] of Object.entries(BILL_COL)) row[key as keyof typeof BILL_COL] = f[idx]
    allBills.push(row)
  })
  console.log(`  ${allBills.length} published bills`)

  // The old data has real duplicates: 770 groups sharing an identical
  // (title, bill_number) pair but different ids and created_at spread over
  // weeks/months — a periodic re-check job re-created the row instead of
  // updating it (confirmed: same bill_date every time, only created_at
  // differs). Keep the most recently created copy of each.
  const byKey = new Map<string, Bill[]>()
  for (const b of allBills) {
    if (b.title === NULL || b.billNumber === NULL) {
      byKey.set(`unique-${b.id}`, [b])
      continue
    }
    const key = `${b.title}\u0000${b.billNumber}`
    const list = byKey.get(key) ?? []
    list.push(b)
    byKey.set(key, list)
  }
  const bills = [...byKey.values()].map((group) =>
    group.length === 1 ? group[0] : group.reduce((latest, b) => (b.createdAt > latest.createdAt ? b : latest)),
  )
  console.log(`  ${allBills.length - bills.length} duplicates skipped, ${bills.length} unique bills to import`)

  const payload = await getPayload({ config })

  console.log('Loading Sectors/Products/Subjects into memory...')
  const sectorIdByName = new Map<string, string | number>()
  for (const d of (await payload.find({ collection: 'sectors', limit: 1000, overrideAccess: true })).docs) {
    sectorIdByName.set(d.name, d.id)
  }
  const productIdByName = new Map<string, string | number>()
  for (const d of (await payload.find({ collection: 'products', limit: 1000, overrideAccess: true })).docs) {
    productIdByName.set(d.name, d.id)
  }
  const subjectIdByLegacyId = new Map<string, string | number>()
  for (const d of (await payload.find({ collection: 'subjects', limit: 2000, overrideAccess: true })).docs) {
    if (d.legacyId) subjectIdByLegacyId.set(d.legacyId, d.id)
  }

  function resolveTags(oldTagIds: string[]) {
    const sectors = new Set<string | number>()
    const products = new Set<string | number>()
    const subjects = new Set<string | number>()
    for (const oldTagId of oldTagIds) {
      const category = taxonomyCategoryById.get(oldTagId)
      const name = taxonomyNameById.get(oldTagId)
      if (category === 'Sector') {
        const id = name ? sectorIdByName.get(name) : undefined
        if (id) sectors.add(id)
      } else if (category === 'Product') {
        const id = name ? productIdByName.get(name) : undefined
        if (id) products.add(id)
      } else if (category === 'Subject') {
        const id = subjectIdByLegacyId.get(oldTagId)
        if (id) subjects.add(id)
      }
    }
    return { sectors: [...sectors], products: [...products], subjects: [...subjects] }
  }

  function toRichText(raw: string | undefined, fallback: string) {
    if (!raw) return lexicalFromText(fallback)
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return lexicalFromText(fallback)
    }
    const paragraphs = editorJsToParagraphs(parsed)
    return paragraphs.length > 0 ? lexicalFromParagraphs(paragraphs) : lexicalFromText(fallback)
  }

  console.log('\nImporting Bills...')
  let created = 0
  let skippedExisting = 0
  let failed = 0
  for (const b of bills) {
    const existing = await payload.find({
      collection: 'bills',
      where: { and: [{ 'ingestion.source': { equals: 'migration' } }, { 'ingestion.externalId': { equals: b.id } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      skippedExisting++
      continue
    }

    const oldTagIds = tagsByBillId.get(b.id) ?? []
    const { sectors, products, subjects } = resolveTags(oldTagIds)
    const primarySubject = clean(b.primarySubjectId) ? subjectIdByLegacyId.get(b.primarySubjectId) : undefined

    const actions = (actionsByBillId.get(b.id) ?? [])
      .map((a) => ({ date: toISO(a.date), action: a.action }))
      .filter((a): a is { date: string; action: string } => a.date !== undefined)

    try {
    await payload.create({
      collection: 'bills',
      data: {
        billType: mapBillType(clean(b.billTypeId)),
        billNumber: clean(b.billNumber) ?? `Unnumbered #${b.id}`,
        title: clean(b.title) ?? `Untitled (legacy #${b.id})`,
        locations: [],
        session: clean(b.session),
        governmentLevel: mapGovernmentLevel(clean(b.governmentLevel)),
        billDate:
          toISO(clean(b.billDate)) ?? toISO(clean(b.publicationDate)) ?? toISO(clean(b.createdAt)) ??
          new Date().toISOString(),
        approvalDate: toISO(clean(b.approvalDate)),
        effectiveDate: toISO(clean(b.effectiveDate)),
        lawNumber: clean(b.lawNumber),
        carriedBy: clean(b.carriedBy),
        actionUrl: clean(b.actionUrl),
        billUrl: { title: clean(b.urlTitle), url: clean(b.link) },
        abstract: toRichText(clean(b.abstract), clean(b.title) ?? 'No abstract available.'),
        fullText: toRichText(clean(b.content), clean(b.title) ?? 'No full text available.'),
        sectors,
        products,
        subjects,
        primarySubject,
        latestActivity: clean(b.latestActivity),
        latestText: clean(b.latestText),
        statusText: clean(b.statusText),
        statute: { title: clean(b.statueTitle), url: clean(b.statueUrl) },
        committee: clean(b.committee),
        actions,
        ingestion: { source: 'migration', externalId: b.id, importedAt: new Date().toISOString() },
        _status: 'published',
      },
      overrideAccess: true,
    })
    created++
    if (created % 500 === 0) console.log(`  ...${created} created`)
    } catch (err) {
      failed++
      console.error(`  FAILED bill legacy #${b.id}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nDone. ${created} created, ${skippedExisting} already existed, ${failed} failed.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  if (err?.data?.errors) console.error(JSON.stringify(err.data.errors, null, 2))
  process.exit(1)
})
