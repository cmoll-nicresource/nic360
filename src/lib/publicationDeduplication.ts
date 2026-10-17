import { createHash } from 'node:crypto'
import type { Article } from '@/payload-types'
import { lexicalToPlainText } from './lexical'

type Excerpt = { id: number; collection: 'articles' | 'bills' | 'trademarks' }

function stableContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableContent)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stableContent(child)]))
  return value
}

/** Conservative identity: never collapse stories just because their titles match.
 * Full rich text (including links/formatting), title and source URL must agree.
 * Records stay intact; only repeated selections within an edition are removed. */
export function publicationExcerptIdentity(item: Excerpt): string {
  const recordKey = `${item.collection}:${item.id}`
  if (item.collection !== 'articles') return recordKey
  const article = item as Excerpt & Partial<Article>
  const title = article.title?.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!title || !lexicalToPlainText(article.excerpt) || !article.sourceUrl) return recordKey
  let url: URL
  try { url = new URL(article.sourceUrl.trim()) } catch { return recordKey }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return recordKey
  url.hash = ''
  const fingerprint = createHash('sha256').update(JSON.stringify([
    title, url.href, stableContent(article.excerpt),
  ])).digest('hex')
  return `articles:story:${fingerprint}`
}

export function uniquePublicationExcerpts<T extends Excerpt>(items: T[]): T[] {
  const records = new Set<string>(), stories = new Set<string>()
  return items.filter((item) => {
    const record = `${item.collection}:${item.id}`, story = publicationExcerptIdentity(item)
    if (records.has(record) || stories.has(story)) return false
    records.add(record)
    stories.add(story)
    return true
  })
}
