/**
 * Migrates published Articles from the old site. Field mapping, confirmed
 * against the real data rather than guessed:
 *
 * - `full_text` (EditorJS blocks, averaging ~358 chars — a preview, not a
 *   full article body) -> `excerpt`, via editorJsToParagraphs(). Falls back
 *   to `raw_content` (a plain-text teaser) when full_text has no usable
 *   paragraphs — 954 rows have a null full_text, 8 have empty blocks.
 * - `source_title` -> a Source doc (upserted by name) -> `source`. The old
 *   relational `sources` table is empty (0 rows) and `source` itself is a
 *   dead field (always the literal string of an empty Ruby hash), so
 *   `source_title` is the only real source-name data that exists.
 * - `link`, falling back to `source_link` -> `sourceUrl`.
 * - `source_date`, falling back to `publication_date`, then `created_at`
 *   (always present) -> `sourceDate`. Both source-specific dates are sparse
 *   (27% and 13% of rows) but every row has at least created_at.
 * - Sectors/Products/Subjects tags come from `excerpt_indices`
 *   (subjectable_type = 'Article'), not the denormalized text[] columns on
 *   the row itself — resolved against the Sectors/Products (by name, both
 *   unique) and Subjects (by `legacyId`) imported by importTaxonomies.ts.
 * - `primary_subject_id` on the row itself -> `primarySubject`, same
 *   Subject legacyId lookup. Left unset (not all rows have one — see the
 *   2026-10-13 changelog entry on relaxing these fields to optional).
 *
 * Usage: npx tsx migration/importArticles.ts
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
  // Guards against the odd corrupt-year row (one Bill had "0015-12-30",
  // presumably a typo for 2015) slipping through as a "valid" JS Date.
  if (d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100) return undefined
  return d.toISOString()
}

type Article = {
  id: string
  title: string
  status: string
  content: string
  publicationDate: string
  link: string
  source: string
  sourceDate: string
  createdAt: string
  rawContent: string
  sourceTitle: string
  primarySubjectId: string
  sourceLink: string
}

async function main() {
  console.log('Reading old taxonomies (for category lookup)...')
  const taxonomyCategoryById = new Map<string, string>()
  await streamTable('taxonomies', (f) => {
    const [id, , category] = f
    taxonomyCategoryById.set(id, category)
  })

  console.log('Reading excerpt_indices for Articles...')
  const tagsByArticleId = new Map<string, string[]>() // old article id -> old taxonomy ids
  await streamTable('excerpt_indices', (f) => {
    const [, subjectableType, subjectableId, taxonomyId] = f
    if (subjectableType !== 'Article' || taxonomyId === NULL) return
    const list = tagsByArticleId.get(subjectableId) ?? []
    list.push(taxonomyId)
    tagsByArticleId.set(subjectableId, list)
  })

  console.log('Reading articles...')
  // Column order per the dump's own COPY header — indexed explicitly rather
  // than by positional destructuring (36 columns, easy to miscount blanks).
  const ARTICLE_COL = {
    id: 0, title: 3, status: 4, content: 5, publicationDate: 6, link: 7,
    source: 10, sourceDate: 11, createdAt: 12, rawContent: 15, sourceTitle: 16,
    fullText: 24, sourceLink: 27, primarySubjectId: 32,
  }
  const articles: Article[] = []
  await streamTable('articles', (f) => {
    if (f[ARTICLE_COL.status] !== 'Published') return
    articles.push({
      id: f[ARTICLE_COL.id],
      title: f[ARTICLE_COL.title],
      status: f[ARTICLE_COL.status],
      content: f[ARTICLE_COL.fullText],
      publicationDate: f[ARTICLE_COL.publicationDate],
      link: f[ARTICLE_COL.link],
      source: f[ARTICLE_COL.source],
      sourceDate: f[ARTICLE_COL.sourceDate],
      createdAt: f[ARTICLE_COL.createdAt],
      rawContent: f[ARTICLE_COL.rawContent],
      sourceTitle: f[ARTICLE_COL.sourceTitle],
      primarySubjectId: f[ARTICLE_COL.primarySubjectId],
      sourceLink: f[ARTICLE_COL.sourceLink],
    })
  })
  console.log(`  ${articles.length} published articles`)

  const payload = await getPayload({ config })

  console.log('Loading Sectors/Products/Subjects into memory...')
  const sectorIdByName = new Map<string, string | number>()
  for (const { docs } of [await payload.find({ collection: 'sectors', limit: 1000, overrideAccess: true })]) {
    for (const d of docs) sectorIdByName.set(d.name, d.id)
  }
  const productIdByName = new Map<string, string | number>()
  for (const d of (await payload.find({ collection: 'products', limit: 1000, overrideAccess: true })).docs) {
    productIdByName.set(d.name, d.id)
  }
  const subjectIdByLegacyId = new Map<string, string | number>()
  for (const d of (await payload.find({ collection: 'subjects', limit: 2000, overrideAccess: true })).docs) {
    if (d.legacyId) subjectIdByLegacyId.set(d.legacyId, d.id)
  }
  // oldTaxonomyId -> its real name, for resolving Sector/Product tags by name.
  const taxonomyNameById = new Map<string, string>()
  await streamTable('taxonomies', (f) => {
    const [id, , , name] = f
    taxonomyNameById.set(id, name)
  })

  function resolveTags(oldTagIds: string[]) {
    const sectors = new Set<string | number>()
    const products = new Set<string | number>()
    const subjects = new Set<string | number>()
    for (const oldTagId of oldTagIds) {
      const category = taxonomyCategoryById.get(oldTagId)
      if (category === 'Sector') {
        const name = taxonomyNameById.get(oldTagId)
        const id = name ? sectorIdByName.get(name) : undefined
        if (id) sectors.add(id)
      } else if (category === 'Product') {
        const name = taxonomyNameById.get(oldTagId)
        const id = name ? productIdByName.get(name) : undefined
        if (id) products.add(id)
      } else if (category === 'Subject') {
        const id = subjectIdByLegacyId.get(oldTagId)
        if (id) subjects.add(id)
      }
    }
    return { sectors: [...sectors], products: [...products], subjects: [...subjects] }
  }

  console.log('Resolving Sources (upsert by name)...')
  const sourceIdByName = new Map<string, string | number>()
  const usedDomains = new Set<string>()
  for (const d of (await payload.find({ collection: 'sources', limit: 2000, overrideAccess: true })).docs) {
    sourceIdByName.set(d.name, d.id)
    if (d.domain) usedDomains.add(d.domain)
  }

  async function resolveSource(name: string | undefined, link: string | undefined): Promise<string | number | undefined> {
    if (!name) return undefined
    const existing = sourceIdByName.get(name)
    if (existing) return existing
    let domain: string | undefined
    try {
      const host = link ? new URL(link).hostname.replace(/^www\./, '') : undefined
      if (host && !usedDomains.has(host)) domain = host
    } catch {
      // malformed link — leave domain unset
    }
    const doc = await payload.create({ collection: 'sources', data: { name, domain }, overrideAccess: true })
    sourceIdByName.set(name, doc.id)
    if (domain) usedDomains.add(domain)
    return doc.id
  }

  console.log('\nImporting Articles...')
  let created = 0
  let skippedExisting = 0
  for (const a of articles) {
    const existing = await payload.find({
      collection: 'articles',
      where: { and: [{ 'ingestion.source': { equals: 'migration' } }, { 'ingestion.externalId': { equals: a.id } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      skippedExisting++
      continue
    }

    let content: unknown
    try {
      content = JSON.parse(a.content)
    } catch {
      content = null
    }
    const paragraphs = editorJsToParagraphs(content)
    const excerpt =
      paragraphs.length > 0
        ? lexicalFromParagraphs(paragraphs)
        : lexicalFromText(clean(a.rawContent) ?? a.title)

    const oldTagIds = tagsByArticleId.get(a.id) ?? []
    const { sectors, products, subjects } = resolveTags(oldTagIds)
    const primarySubject = clean(a.primarySubjectId) ? subjectIdByLegacyId.get(a.primarySubjectId) : undefined

    const sourceId = await resolveSource(clean(a.sourceTitle), clean(a.link) ?? clean(a.sourceLink))

    await payload.create({
      collection: 'articles',
      data: {
        title: a.title || `Untitled (legacy #${a.id})`,
        source: sourceId,
        sourceDate:
          toISO(clean(a.sourceDate)) ?? toISO(clean(a.publicationDate)) ?? toISO(clean(a.createdAt)) ??
          new Date().toISOString(),
        sourceUrl: clean(a.link) ?? clean(a.sourceLink),
        excerpt,
        sectors,
        products,
        subjects,
        primarySubject,
        locations: [],
        ingestion: { source: 'migration', externalId: a.id, importedAt: new Date().toISOString() },
        _status: 'published',
      },
      overrideAccess: true,
    })
    created++
    if (created % 500 === 0) console.log(`  ...${created} created`)
  }

  console.log(`\nDone. ${created} created, ${skippedExisting} already existed, ${sourceIdByName.size} total Sources.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
