/**
 * Migrates the old site's `taxonomies` table (parent_id/category/name) into
 * the three taxonomy collections that actually get used for tagging:
 * Sector -> sectors, Product -> products, Subject -> subjects (tree, via
 * parent_id). Confirmed by checking excerpt_indices: of 59,877 real tag
 * assignments across Articles/Bills/Laws, every single one points at a
 * Sector, Product or Subject term — the old data has a handful of other
 * categories (TTG, TUSA, Section, Bill Type, ...) sitting in the same
 * table, but none of them are ever actually used to tag anything, so
 * they're left out entirely.
 *
 * Sectors and Products are idempotent by exact name match, so this can run
 * on top of the seed script's placeholder terms without duplicating the
 * ones that happen to coincide (e.g. "Manufacturers", "All Products").
 * Subjects are NOT name-deduplicated: 97 of the 855 old subject names
 * repeat under a different parent (e.g. "Convenience Stores" as a child of
 * more than one top-level subject) — real distinct tree nodes, confirmed
 * by checking that no (name, parent) pair repeats. Matching by name alone
 * would have wrongly collapsed those into one node, so every old Subject
 * row always becomes its own new node; the seed script's 16 placeholder
 * subjects are left alongside rather than risk that.
 *
 * Locations and Sources aren't touched here: the old site never actually
 * populated `sources` (0 rows) or any location/jurisdiction field on
 * bills or articles (bills.location is null on all but 31 of 9,498 rows,
 * and empty on those) — there's nothing real to migrate for either.
 *
 * Usage: npx tsx migration/importTaxonomies.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import zlib from 'zlib'
import { getPayload } from 'payload'

import config from '../src/payload.config'

const DUMP_PATH = path.join(process.cwd(), 'old-db', 'truecms.sql.gz')

type TaxonomyRow = { id: string; parentId: string; category: string; name: string }

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

async function upsertFlat(payload: Awaited<ReturnType<typeof getPayload>>, collection: 'sectors' | 'products', names: string[]) {
  let created = 0
  for (const name of names) {
    const existing = await payload.find({ collection, where: { name: { equals: name } }, limit: 1, overrideAccess: true })
    if (existing.docs.length > 0) continue
    await payload.create({ collection, data: { name }, overrideAccess: true })
    created++
  }
  console.log(`  ${collection}: ${created} created, ${names.length - created} already existed`)
}

async function main() {
  console.log('Reading old taxonomies table...')
  const rows: TaxonomyRow[] = []
  await streamTable('taxonomies', (f) => {
    const [id, parentId, category, name] = f
    if (category === 'Sector' || category === 'Product' || category === 'Subject') {
      rows.push({ id, parentId, category, name })
    }
  })
  console.log(
    `  ${rows.filter((r) => r.category === 'Sector').length} sectors, ${rows.filter((r) => r.category === 'Product').length} products, ${rows.filter((r) => r.category === 'Subject').length} subjects`,
  )

  const payload = await getPayload({ config })

  console.log('\nImporting Sectors...')
  await upsertFlat(payload, 'sectors', rows.filter((r) => r.category === 'Sector').map((r) => r.name))

  console.log('Importing Products...')
  await upsertFlat(payload, 'products', rows.filter((r) => r.category === 'Product').map((r) => r.name))

  console.log('Importing Subjects (tree)...')
  const subjectRows = rows.filter((r) => r.category === 'Subject')
  const newIdByOldId = new Map<string, string | number>()

  // Pass 1: create every subject with no parent yet (parent_id values are
  // old-table ids, meaningless until every node exists). Always create —
  // see the file header on why name-based dedup would be wrong here.
  for (const r of subjectRows) {
    const doc = await payload.create({
      collection: 'subjects',
      data: { name: r.name, legacyId: r.id },
      overrideAccess: true,
    })
    newIdByOldId.set(r.id, doc.id)
  }
  console.log(`  ${subjectRows.length} created`)

  // Pass 2: wire up parent relationships now that every id is known.
  let linked = 0
  for (const r of subjectRows) {
    if (r.parentId === '\\N' || !r.parentId) continue
    const childId = newIdByOldId.get(r.id)
    const parentId = newIdByOldId.get(r.parentId)
    if (!childId || !parentId) continue
    await payload.update({ collection: 'subjects', id: childId, data: { parent: parentId }, overrideAccess: true })
    linked++
  }
  console.log(`  ${linked} parent relationships linked`)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
