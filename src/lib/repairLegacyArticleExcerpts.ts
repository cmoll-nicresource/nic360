import type { Client } from 'pg'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import {
  canRepairLegacyArticleExcerpt,
  decodePgCopyText,
  legacyArticleExcerpt,
  type LegacyArticleText,
} from './legacyArticleExcerpt'
import { lexicalFromParagraphs, lexicalToPlainText } from './lexical'

export type LegacyArticleRepairSource = LegacyArticleText & {
  legacyId: string
  sourceUrl?: string
  updatedAt?: string
}

/** Caller owns the transaction. Lock/recheck, snapshot first, and change text fields only. */
export async function repairLegacyArticleExcerpts(
  client: Client,
  sources: LegacyArticleRepairSource[],
  apply = false,
  expectedBeforeHash?: string,
) {
  const legacy = new Map(sources.map((source) => [source.legacyId, source]))
  if (legacy.size !== sources.length) throw new Error('Duplicate original article IDs.')
  if (apply && !expectedBeforeHash)
    throw new Error('A saved before-state hash is required before applying.')
  const { rows: articles } = await client.query(
    "SELECT * FROM articles WHERE ingestion_source='migration' ORDER BY id FOR UPDATE",
  )
  const { rows: versions } = await client.query(
    "SELECT v.* FROM _articles_v v JOIN articles a ON a.id=v.parent_id WHERE a.ingestion_source='migration' AND v.latest=true ORDER BY v.id FOR UPDATE OF v",
  )
  const before = { articles, versions }
  const beforeJson = JSON.stringify(before),
    beforeHash = createHash('sha256').update(beforeJson).digest('hex')
  if (apply && expectedBeforeHash && expectedBeforeHash !== beforeHash)
    throw new Error('Article state changed since the saved backup. Preview again before applying.')
  const articleUpdates: { id: number; excerpt: unknown; search_text: string }[] = [],
    versionUpdates: typeof articleUpdates = []
  const stats = {
    migratedArticles: articles.length,
    repairedArticles: 0,
    repairedLatestVersions: 0,
    preservedArticleEdits: 0,
    alreadyCorrect: 0,
    preservedVersionEdits: 0,
    missingLegacy: 0,
    noRecoverableText: 0,
    sources: {} as Record<string, number>,
    unresolved: [] as { id: number; legacyId: string; title: string }[],
  }
  for (const article of articles) {
    const source = legacy.get(article.ingestion_external_id)
    if (!source) {
      stats.missingLegacy++
      continue
    }
    const identityMatches = (title: string) =>
      title === source.title || title === decodePgCopyText(source.title)
    const recovered = legacyArticleExcerpt(source)
    const eligible =
      identityMatches(article.title) &&
      canRepairLegacyArticleExcerpt(article.excerpt, article.title, source)
    if (!recovered) {
      if (eligible) {
        stats.noRecoverableText++
        stats.unresolved.push({ id: article.id, legacyId: source.legacyId, title: article.title })
      }
      continue
    }
    const excerpt = lexicalFromParagraphs(recovered.paragraphs),
      search_text = lexicalToPlainText(excerpt).slice(0, 40000)
    const alreadyCorrect =
      JSON.stringify(article.excerpt) === JSON.stringify(excerpt) ||
      lexicalToPlainText(article.excerpt) === lexicalToPlainText(excerpt)
    if (alreadyCorrect) stats.alreadyCorrect++
    else if (eligible) {
      articleUpdates.push({ id: article.id, excerpt, search_text })
      stats.sources[recovered.source] = (stats.sources[recovered.source] || 0) + 1
    } else stats.preservedArticleEdits++
    for (const version of versions.filter((v) => v.parent_id === article.id)) {
      if (lexicalToPlainText(version.version_excerpt) === lexicalToPlainText(excerpt)) continue
      if (
        identityMatches(version.version_title) &&
        canRepairLegacyArticleExcerpt(version.version_excerpt, version.version_title, source)
      )
        versionUpdates.push({ id: version.id, excerpt, search_text })
      else stats.preservedVersionEdits++
    }
  }
  stats.repairedArticles = articleUpdates.length
  stats.repairedLatestVersions = versionUpdates.length
  // The backup is returned even on preview, so remote callers save it privately
  // before invoking apply with its exact beforeHash. Historical snapshots stay intact.
  const snapshotGzip = gzipSync(beforeJson).toString('base64')
  if (apply) {
    for (let offset = 0; offset < articleUpdates.length; offset += 500) {
      const result = await client.query(
        'UPDATE articles a SET excerpt=x.excerpt,search_text=x.search_text FROM jsonb_to_recordset($1::jsonb) AS x(id integer,excerpt jsonb,search_text text) WHERE a.id=x.id',
        [JSON.stringify(articleUpdates.slice(offset, offset + 500))],
      )
      if (result.rowCount !== Math.min(500, articleUpdates.length - offset))
        throw new Error('Article repair count mismatch.')
    }
    for (let offset = 0; offset < versionUpdates.length; offset += 500) {
      const result = await client.query(
        'UPDATE _articles_v v SET version_excerpt=x.excerpt,version_search_text=x.search_text FROM jsonb_to_recordset($1::jsonb) AS x(id integer,excerpt jsonb,search_text text) WHERE v.id=x.id',
        [JSON.stringify(versionUpdates.slice(offset, offset + 500))],
      )
      if (result.rowCount !== Math.min(500, versionUpdates.length - offset))
        throw new Error('Draft repair count mismatch.')
    }
  }
  return { stats, beforeHash, snapshotGzip }
}
