/**
 * Pure helpers for copying Tobacco Reporter (WordPress) posts into
 * Executive Summary stories. No network or database here; the fetching lives
 * in tobaccoReporterClient.ts. See docs/executive-summary-stories.md.
 */
import sanitizeHtml from 'sanitize-html'

import { decodeHtmlEntities } from './entities'

export { decodeHtmlEntities }

/** The subset of a WordPress REST post (`/wp-json/wp/v2/posts`) we read. */
export type WpPost = {
  id: number
  date_gmt?: string
  modified_gmt?: string
  link: string
  title: { rendered: string }
  excerpt?: { rendered: string }
  content?: { rendered: string }
  meta?: Record<string, unknown>
  _embedded?: {
    author?: { name?: string }[]
    'wp:featuredmedia'?: { source_url?: string; alt_text?: string; mime_type?: string }[]
  }
}

export type StorySource = { name: string; url: string | null }

/** The post's editorial content, ready to save on a story. */
export type CopiedPost = {
  postId: number
  url: string
  headline: string
  bodyHtml: string
  sources: StorySource[]
  publishedAt: string | null
  modifiedAt: string | null
  author: string | null
  image: { url: string; alt: string } | null
}

/** Plain text of a rendered title or excerpt: tags removed, entities decoded, whitespace collapsed. */
export function plainText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function httpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

/**
 * Reads the Tobacco Reporter "Nicotine360 sources" box: one source per line,
 * "Source name | https://link". A bare URL uses its host as the name; a line
 * with no URL keeps just the name ("Source: Antara News Agency" had no link).
 */
export function parseSources(text: unknown): StorySource[] {
  if (typeof text !== 'string') return []
  const sources: StorySource[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-•*]\s*)?(?:source:\s*)?/i, '').trim()
    if (!line) continue
    const bar = line.lastIndexOf('|')
    if (bar !== -1) {
      const name = line.slice(0, bar).trim()
      const url = httpUrl(line.slice(bar + 1).trim())
      if (name || url) sources.push({ name: name || (url ? new URL(url).hostname.replace(/^www\./, '') : ''), url })
      continue
    }
    const url = httpUrl(line)
    sources.push(url ? { name: new URL(url).hostname.replace(/^www\./, ''), url } : { name: line, url: null })
  }
  return sources
}

/**
 * Email- and web-safe copy of a post body: structural tags and links only. No
 * classes, styles, scripts, embeds or inline images (the featured image is
 * copied separately), and no empty paragraphs left behind by WordPress blocks.
 */
export function sanitizeStoryHtml(html: string): string {
  const clean = sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'sup', 'sub', 'a', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe', 'figure', 'svg'],
    transformTags: {
      b: 'strong',
      i: 'em',
      h1: 'h2',
    },
    exclusiveFilter: (frame) =>
      (frame.tag === 'p' && !frame.text.replace(/ /g, ' ').trim() && !frame.mediaChildren.length) ||
      (frame.tag === 'p' && /first appeared on/i.test(frame.text) && /tobacco reporter/i.test(frame.text)),
  })
  return clean.replace(/\n{2,}/g, '\n').trim()
}

/** The source box may arrive as `meta.n360_sources` (REST); tolerate an array value too. */
function sourcesFromMeta(meta: WpPost['meta']): StorySource[] {
  const value = meta?.n360_sources
  return parseSources(Array.isArray(value) ? value.join('\n') : value)
}

function isoOrNull(gmt: string | undefined): string | null {
  if (!gmt) return null
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(gmt) ? gmt : `${gmt}Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function copyPost(post: WpPost): CopiedPost {
  const media = post._embedded?.['wp:featuredmedia']?.[0]
  const imageUrl = media?.source_url ? httpUrl(media.source_url) : null
  return {
    postId: post.id,
    url: stripTracking(post.link),
    headline: plainText(post.title.rendered),
    bodyHtml: sanitizeStoryHtml(post.content?.rendered ?? ''),
    sources: sourcesFromMeta(post.meta),
    publishedAt: isoOrNull(post.date_gmt),
    modifiedAt: isoOrNull(post.modified_gmt),
    author: post._embedded?.author?.[0]?.name?.trim() || null,
    image: imageUrl && (!media?.mime_type || media.mime_type.startsWith('image/'))
      ? { url: imageUrl, alt: plainText(media?.alt_text || '') }
      : null,
  }
}

/** Drops the utm_* parameters WordPress adds to feed links. */
export function stripTracking(link: string): string {
  try {
    const url = new URL(link)
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key)
    return url.href
  } catch {
    return link
  }
}

/**
 * What a pasted Tobacco Reporter link points at: a post id (`?p=170519`) or
 * the slug from a permalink (`/2026/11/18/european-parliament-.../`). Null for
 * anything that isn't a link to the configured site.
 */
export function postRefFromUrl(input: string, siteUrl: string): { id: number } | { slug: string } | null {
  let url: URL, site: URL
  try {
    url = new URL(input.trim())
    site = new URL(siteUrl)
  } catch {
    return null
  }
  const host = (h: string) => h.toLowerCase().replace(/^www\./, '')
  if (host(url.hostname) !== host(site.hostname)) return null
  const id = Number(url.searchParams.get('p'))
  if (Number.isSafeInteger(id) && id > 0) return { id }
  const segments = url.pathname.split('/').filter(Boolean)
  const slug = segments.at(-1)
  if (!slug || /^\d+$/.test(slug) || ['feed', 'category', 'tag', 'author', 'page'].includes(segments[0])) return null
  return /^[a-z0-9-%]+$/i.test(slug) ? { slug: decodeURIComponent(slug).toLowerCase() } : null
}

/**
 * On refresh, keep an editor's custom headline but follow Tobacco Reporter's
 * when the editor never changed it.
 */
export function refreshedHeadline(current: { headline?: string | null; trHeadline?: string | null }, next: string): string {
  const headline = current.headline?.trim()
  if (!headline || headline === current.trHeadline?.trim()) return next
  return headline
}
