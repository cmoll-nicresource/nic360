/**
 * Migrates published Publication Issues from the old site.
 *
 * The old schema is confusing: `publication_categories` is the recurring
 * newsletter definition (what the new `publications` collection is), and
 * `publications` is the per-issue table (what the new `publication-issues`
 * collection is) — same name as our new top-level collection, different
 * thing. Only the 10 categories that already exist as real Publications
 * here are migrated (confirmed earlier: 26 categories existed, 16 were
 * explicitly dropped — unused trade barometers, dated one-off China Watch
 * issues, etc.).
 *
 * Each issue's real content is `publication_pages` — a polymorphic
 * (printable_type/printable_id) ordered list of Articles/Bills/Trademarks,
 * resolved here against the Article/Bill/Trademark migration's
 * `ingestion.externalId`. Two of the 10 publications (Monthly US Trademark
 * Activity, Weekly US Trademark Report) are configured as `pdf-report` —
 * there's no actual old PDF file to carry over, but the real trademark
 * list for each historical issue still exists in publication_pages, so
 * every migrated issue is built as `excerpt-list` regardless of its
 * parent Publication's configured format (which stays as-is, since that
 * governs how *future* issues get generated, not historical ones). The
 * one exception is Monthly Research Digest (custom-html): its
 * publication_pages data is sparse (10 rows across 62 issues) and clearly
 * incidental, not real content, so those issues import as a bare shell
 * (title/date only, no sections).
 *
 * Usage: npx tsx migration/importPublicationIssues.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import zlib from 'zlib'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { lexicalFromText } from '../src/lib/lexical'

const DUMP_PATH = path.join(process.cwd(), 'old-db', 'truecms.sql.gz')
const NULL = '\\N'
const clean = (v: string | undefined) => (v === undefined || v === NULL || v === '' ? undefined : v)

// The 10 old publication_categories that already exist as real Publications;
// everything else (Trade Barometers, dated one-off China Watch issues, etc.)
// was already confirmed out of scope.
const KEPT_CATEGORY_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '19', '20'])
const NO_SECTIONS_CATEGORY_ID = '6' // Monthly Research Digest (custom-html)

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

const ISSUE_COL = {
  id: 0, title: 1, description: 5, status: 6, createdAt: 7,
  categoryId: 10, publishedDate: 11, mailchimpId: 15, emailSent: 16,
}
const PAGE_COL = { printableType: 1, printableId: 2, issueId: 5, position: 6 }

type Issue = Record<keyof typeof ISSUE_COL, string>
type Page = { printableType: string; printableId: string; position: number }

async function main() {
  console.log('Reading publication_categories (-> new Publications by slug)...')
  const slugByCategoryId = new Map<string, string>()
  await streamTable('publication_categories', (f) => {
    const [id, , , , , , , , , , slug] = f
    if (KEPT_CATEGORY_IDS.has(id)) slugByCategoryId.set(id, slug)
  })

  const payload = await getPayload({ config })

  console.log('Resolving Publication ids by slug...')
  const publicationIdBySlug = new Map<string, string | number>()
  for (const d of (await payload.find({ collection: 'publications', limit: 100, overrideAccess: true })).docs) {
    publicationIdBySlug.set(d.slug, d.id)
  }

  console.log('Loading Articles/Bills/Trademarks legacy-id maps...')
  const legacyIdMaps: Record<'Article' | 'Bill' | 'Trademark', Map<string, string | number>> = {
    Article: new Map(),
    Bill: new Map(),
    Trademark: new Map(),
  }
  const COLLECTION_BY_TYPE = { Article: 'articles', Bill: 'bills', Trademark: 'trademarks' } as const
  for (const [type, collection] of Object.entries(COLLECTION_BY_TYPE) as [keyof typeof COLLECTION_BY_TYPE, string][]) {
    let page = 1
    for (;;) {
      const res = await payload.find({
        collection: collection as 'articles' | 'bills' | 'trademarks',
        where: { 'ingestion.source': { equals: 'migration' } },
        limit: 1000,
        page,
        depth: 0,
        overrideAccess: true,
      })
      for (const d of res.docs) {
        const externalId = (d as { ingestion?: { externalId?: string } }).ingestion?.externalId
        if (externalId) legacyIdMaps[type].set(externalId, d.id)
      }
      if (!res.hasNextPage) break
      page++
    }
    console.log(`  ${legacyIdMaps[type].size} ${type} ids loaded`)
  }

  console.log('Reading publication_pages...')
  const pagesByIssueId = new Map<string, Page[]>()
  await streamTable('publication_pages', (f) => {
    const printableType = f[PAGE_COL.printableType]
    if (printableType !== 'Article' && printableType !== 'Bill' && printableType !== 'Trademark') return
    const issueId = f[PAGE_COL.issueId]
    const list = pagesByIssueId.get(issueId) ?? []
    list.push({ printableType, printableId: f[PAGE_COL.printableId], position: Number(f[PAGE_COL.position]) || 0 })
    pagesByIssueId.set(issueId, list)
  })

  console.log('Reading publications (issues)...')
  const issues: Issue[] = []
  await streamTable('publications', (f) => {
    if (f[ISSUE_COL.status] !== 'Published') return
    if (!KEPT_CATEGORY_IDS.has(f[ISSUE_COL.categoryId])) return
    const row = {} as Issue
    for (const [key, idx] of Object.entries(ISSUE_COL)) row[key as keyof typeof ISSUE_COL] = f[idx]
    issues.push(row)
  })
  console.log(`  ${issues.length} published issues across the 10 kept publications`)

  const SECTION_HEADING: Record<string, string> = { Article: 'Articles', Bill: 'Legislation', Trademark: 'Trademarks' }

  console.log('\nImporting Publication Issues...')
  let created = 0
  let skippedExisting = 0
  let failed = 0
  for (const issue of issues) {
    const existing = await payload.find({
      collection: 'publication-issues',
      where: { legacyId: { equals: issue.id } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      skippedExisting++
      continue
    }

    const slug = slugByCategoryId.get(issue.categoryId)
    const publicationId = slug ? publicationIdBySlug.get(slug) : undefined
    if (!publicationId) {
      failed++
      console.error(`  FAILED issue legacy #${issue.id}: no Publication for category ${issue.categoryId}`)
      continue
    }

    const sections: { heading: string; items: { relationTo: string; value: string | number }[] }[] = []
    if (issue.categoryId !== NO_SECTIONS_CATEGORY_ID) {
      const pages = (pagesByIssueId.get(issue.id) ?? []).sort((a, b) => a.position - b.position)
      for (const type of ['Article', 'Bill', 'Trademark'] as const) {
        const items = pages
          .filter((p) => p.printableType === type)
          .map((p) => legacyIdMaps[type].get(p.printableId))
          .filter((id): id is string | number => id !== undefined)
          .map((id) => ({ relationTo: COLLECTION_BY_TYPE[type], value: id }))
        if (items.length > 0) sections.push({ heading: SECTION_HEADING[type], items })
      }
    }

    try {
      await payload.create({
        collection: 'publication-issues',
        data: {
          publication: publicationId,
          issueDate: toISO(clean(issue.publishedDate)) ?? toISO(clean(issue.createdAt)) ?? new Date().toISOString(),
          title: clean(issue.title) ?? `Issue (legacy #${issue.id})`,
          format: 'excerpt-list',
          intro: clean(issue.description) ? lexicalFromText(clean(issue.description)!) : undefined,
          sections,
          email: {
            status: issue.emailSent === 't' ? 'sent' : 'not sent',
            campaignId: clean(issue.mailchimpId),
            sentAt: issue.emailSent === 't' ? toISO(clean(issue.publishedDate)) : undefined,
          },
          legacyId: issue.id,
          _status: 'published',
        },
        overrideAccess: true,
      })
      created++
      if (created % 500 === 0) console.log(`  ...${created} created`)
    } catch (err) {
      failed++
      console.error(`  FAILED issue legacy #${issue.id}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nDone. ${created} created, ${skippedExisting} already existed, ${failed} failed.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
