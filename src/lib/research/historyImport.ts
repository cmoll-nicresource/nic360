import { createHash } from 'node:crypto'
import type { Client } from 'pg'
import { lexicalFromParagraphs, lexicalToPlainText } from '../lexical'
import { formatAbstractHeadings } from './abstractHeadings'
import { normalizeDoi } from './doi'

type ExportRow = {
  article_id: string
  issue: string
  journal: string
  title: string
  authors: string
  source_date: string
  url: string
  title_url: string
  abstract: string
}
export type HistoryCorrections = Record<string, {
  authors?: string
  source_date?: string
  url?: string
  omitInFavorOf?: string
  evidence: string
}>

const journalAliases: Record<string, string> = {
  'bmc primary care (formerly bmc family practice)': 'BMC Primary Care',
  'substance, abuse treatment, prevention, and policy': 'Substance Abuse Treatment, Prevention, and Policy (BMC)',
  'psycopharmacology': 'Psychopharmacology',
}
export const journalKey = (name: string) => name.normalize('NFKC').trim()
  .replace(/\s*\(BMC\)$/i, '').replace(/\s+/g, ' ').toLowerCase()
const titleKey = (title: string) => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
type HistoryRecord = {
  externalId: string; articleId: string; issue: string; title: string; authors: string
  journal: string; publishedDate: string; doiLink: string | null; doiKey: string | null
  sourceUrl: string; body: ReturnType<typeof lexicalFromParagraphs>; searchText: string
}

export function planResearchHistory(input: string, corrections: HistoryCorrections = {}) {
  const rows = input.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
    try { return JSON.parse(line) as ExportRow } catch { throw new Error(`Invalid JSON on line ${i + 1}`) }
  })
  const seenIds = new Set<string>()
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d+$/.test(row.article_id) || seenIds.has(row.article_id)) throw new Error('Missing or repeated article_id')
    seenIds.add(row.article_id)
  }
  for (const [id, correction] of Object.entries(corrections)) {
    if (!seenIds.has(id) || !correction.evidence) throw new Error(`Unverified correction: ${id}`)
    if (correction.omitInFavorOf && !seenIds.has(correction.omitInFavorOf)) throw new Error(`Missing replacement for ${id}`)
  }
  const occurrences: Record<string, string[]> = {}
  const records: HistoryRecord[] = []
  const doiSeen = new Map<string, HistoryRecord>()
  const sourceSeen = new Map<string, HistoryRecord>()
  const titleSeen = new Map<string, HistoryRecord>()
  const duplicates: { omitted: string; retained: string }[] = []
  for (const original of rows) {
    const correction = corrections[original.article_id]
    if (correction?.omitInFavorOf) {
      duplicates.push({ omitted: original.article_id, retained: correction.omitInFavorOf })
      continue
    }
    const row = { ...original, ...correction }
    for (const field of ['title', 'authors', 'journal', 'abstract'] as const)
      if (typeof row[field] !== 'string' || !row[field].trim()) throw new Error(`${row.article_id}: missing ${field}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.source_date) || !Number.isFinite(Date.parse(row.source_date)) || new Date(row.source_date).toISOString().slice(0, 10) !== row.source_date)
      throw new Error(`${row.article_id}: invalid publication date`)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.issue)) throw new Error(`${row.article_id}: invalid issue`)
    const url = new URL(row.url)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(`${row.article_id}: invalid URL`)
    const doiLink = /^(?:dx\.)?doi\.org$/i.test(url.hostname) ? normalizeDoi(row.url)! : null
    const doiKey = doiLink?.toLowerCase() ?? null
    const source = new URL(row.title_url || row.url)
    if (!['https:', 'http:'].includes(source.protocol) || source.username || source.password) throw new Error(`${row.article_id}: invalid source URL`)
    source.hash = ''
    const abstract = row.abstract.trim().replace(/([.!?])\s+(?=(?:Background|Methods|Results|Findings|Conclusions?|Objectives?):\s)/g, '$1\n')
    const body = formatAbstractHeadings(lexicalFromParagraphs(abstract.split(/\r?\n/).filter(p => p.trim()).map(p => p.trim())))
    const record = {
      externalId: `research-digest:${row.article_id}`,
      articleId: row.article_id, issue: row.issue,
      title: row.title.trim(), authors: row.authors.trim(),
      journal: journalAliases[row.journal.trim().toLowerCase()] ?? row.journal.trim(),
      publishedDate: `${row.source_date}T12:00:00.000Z`,
      doiLink, doiKey, sourceUrl: source.href, body,
      searchText: lexicalToPlainText(body).slice(0, 40000),
    }
    // A shared title with different DOI/content needs review, never silent merging.
    const sameTitle = titleSeen.get(titleKey(record.title))
    if (sameTitle && sameTitle.doiKey !== doiKey) throw new Error(`Conflicting title: ${row.article_id}`)
    const matches = new Set([doiKey ? doiSeen.get(doiKey) : undefined, sourceSeen.get(record.sourceUrl)].filter(Boolean))
    if (matches.size > 1) throw new Error(`Conflicting identities: ${row.article_id}`)
    const duplicate = [...matches][0]
    if (duplicate) {
      if (titleKey(duplicate.title) !== titleKey(record.title)) throw new Error(`Conflicting DOI titles: ${row.article_id}`)
      duplicates.push({ omitted: row.article_id, retained: duplicate.articleId })
      occurrences[duplicate.articleId].push(row.article_id)
      continue
    }
    records.push(record)
    occurrences[record.articleId] = [record.articleId]
    if (doiKey) doiSeen.set(doiKey, record)
    sourceSeen.set(record.sourceUrl, record)
    titleSeen.set(titleKey(record.title), record)
  }
  for (const duplicate of duplicates) {
    if (!occurrences[duplicate.retained]) throw new Error(`Missing canonical entry: ${duplicate.retained}`)
    if (!occurrences[duplicate.retained].includes(duplicate.omitted)) occurrences[duplicate.retained].push(duplicate.omitted)
  }
  return { sourceCount: rows.length, sourceHash: createHash('sha256').update(input).digest('hex'), records, duplicates, occurrences }
}

export type HistoryPlan = ReturnType<typeof planResearchHistory>

/** Caller owns BEGIN/COMMIT. No Payload initialization, jobs, email or destructive updates. */
export async function importResearchHistory(client: Client, plan: HistoryPlan, expectedBeforeHash?: string) {
  await client.query("SET LOCAL lock_timeout='10s'")
  await client.query('LOCK TABLE public.research,public._research_v,public.journals IN SHARE ROW EXCLUSIVE MODE')
  const before = {
    research: (await client.query('SELECT * FROM public.research ORDER BY id')).rows,
    versions: (await client.query('SELECT * FROM public._research_v ORDER BY id')).rows,
    journals: (await client.query('SELECT * FROM public.journals ORDER BY id')).rows,
  }
  const beforeHash = hash(before)
  if (expectedBeforeHash && expectedBeforeHash !== beforeHash) throw new Error('Database changed since preview; preview again')
  const journals = new Map<string, { id: number; name: string }>()
  for (const journal of before.journals) {
    const key = journalKey(journal.name)
    if (journals.has(key)) throw new Error(`Ambiguous existing journal: ${journal.name}`)
    journals.set(key, journal)
  }
  const created: { id: number; externalId: string; articleIds: string[] }[] = []
  const skipped: { id: number; externalId: string }[] = []
  const addedJournals: { id: number; name: string }[] = []
  for (const record of plan.records) {
    const existing = await client.query('SELECT id,title,doi_key,source_url,ingestion_external_id FROM public.research WHERE ingestion_external_id=$1 OR doi_key=$2 OR source_url=$3', [record.externalId, record.doiKey, record.sourceUrl])
    if (existing.rows.length > 1) throw new Error(`Existing identity conflict: ${record.externalId}`)
    if (existing.rows.length) {
      const found = existing.rows[0]
      if (titleKey(found.title ?? '') !== titleKey(record.title) || (found.doi_key && record.doiKey && found.doi_key !== record.doiKey)) throw new Error(`Existing article conflict: ${record.externalId}`)
      skipped.push({ id: found.id, externalId: record.externalId })
      continue
    }
    // Catch same article under another link without merging different works.
    if (before.research.some(r => titleKey(r.title ?? '') === titleKey(record.title))) throw new Error(`Existing title requires review: ${record.externalId}`)
    const key = journalKey(record.journal)
    let journal = journals.get(key)
    if (!journal) {
      journal = (await client.query('INSERT INTO public.journals(name) VALUES($1) RETURNING id,name', [record.journal])).rows[0]
      if (!journal) throw new Error('Journal insert failed')
      journals.set(key, journal)
      addedJournals.push(journal)
    }
    const article = (await client.query(`INSERT INTO public.research
      (title,authors,published_date,journal_id,doi_link,doi_key,source_url,body,search_text,ingestion_source,ingestion_external_id,ingestion_imported_at,_status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'migration',$10,now(),'published') RETURNING *`,
    [record.title, record.authors, record.publishedDate, journal.id, record.doiLink, record.doiKey, record.sourceUrl, JSON.stringify(record.body), record.searchText, record.externalId])).rows[0]
    await client.query(`INSERT INTO public._research_v
      (parent_id,version_title,version_authors,version_published_date,version_journal_id,version_doi_link,version_doi_key,version_source_url,version_body,version_search_text,version_ingestion_source,version_ingestion_external_id,version_ingestion_imported_at,version__status,version_created_at,version_updated_at,latest)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'migration',$11,$12,'published',$13,$14,true)`,
    [article.id, article.title, article.authors, article.published_date, journal.id, article.doi_link, article.doi_key, article.source_url, JSON.stringify(article.body), article.search_text, record.externalId, article.ingestion_imported_at, article.created_at, article.updated_at])
    created.push({ id: article.id, externalId: record.externalId, articleIds: plan.occurrences[record.articleId] })
  }
  return { before, beforeHash, created, skipped, addedJournals }
}
