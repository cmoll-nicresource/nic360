/**
 * Reads Tobacco Reporter through WordPress's public REST API. The RSS feed
 * only carries the newest 10 posts and no images, so the API is what lets an
 * editor find any post. Read-only, no credentials.
 */
import { postRefFromUrl, type WpPost } from './tobaccoReporter'

export function tobaccoReporterSiteUrl(): string {
  return (process.env.TOBACCO_REPORTER_URL || 'https://tobaccoreporter.com').replace(/\/+$/, '')
}

export class TobaccoReporterError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message)
  }
}

async function wpGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<{ data: T; total: number }> {
  const url = new URL(`${tobaccoReporterSiteUrl()}/wp-json/wp/v2/${path}`)
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  let res: Response
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'Nicotine360 CMS (+https://nicotine360.org)' },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
  } catch {
    throw new TobaccoReporterError('Tobacco Reporter did not respond. Try again in a moment.')
  }
  if (res.status === 404) throw new TobaccoReporterError('That post was not found on Tobacco Reporter.', 404)
  if (res.status === 400) return { data: [] as T, total: 0 } // WordPress answers 400 for a page past the end
  if (!res.ok) throw new TobaccoReporterError(`Tobacco Reporter returned an error (${res.status}).`)
  return { data: (await res.json()) as T, total: Number(res.headers.get('x-wp-total')) || 0 }
}

const LIST_FIELDS = 'id,date_gmt,modified_gmt,link,title,excerpt'
const FULL_FIELDS = 'id,date_gmt,modified_gmt,link,title,content,meta,_links,_embedded'

export async function searchTobaccoReporterPosts(search: string, page = 1, perPage = 20) {
  const { data, total } = await wpGet<WpPost[]>('posts', {
    search: search.trim().slice(0, 200) || undefined,
    page,
    per_page: perPage,
    orderby: 'date',
    order: 'desc',
    _fields: LIST_FIELDS,
  })
  return { posts: data, total }
}

export async function getTobaccoReporterPost(id: number): Promise<WpPost> {
  const { data } = await wpGet<WpPost>(`posts/${id}`, { _embed: 'author,wp:featuredmedia', _fields: FULL_FIELDS })
  return data
}

/** Resolves a pasted permalink or `?p=` link to a post id. */
export async function findTobaccoReporterPostId(link: string): Promise<number> {
  const ref = postRefFromUrl(link, tobaccoReporterSiteUrl())
  if (!ref) throw new TobaccoReporterError('Paste a link to a Tobacco Reporter article.', 400)
  if ('id' in ref) return ref.id
  const { data } = await wpGet<WpPost[]>('posts', { slug: ref.slug, _fields: 'id' })
  if (!data[0]) throw new TobaccoReporterError('That article was not found on Tobacco Reporter.', 404)
  return data[0].id
}

/** Downloads a featured image (capped at 8 MB) for copying into Media, with one retry. */
export async function downloadImage(url: string): Promise<{ data: Buffer; mimetype: string; name: string } | null> {
  return (await downloadOnce(url)) ?? (await downloadOnce(url))
}

async function downloadOnce(url: string): Promise<{ data: Buffer; mimetype: string; name: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'Nicotine360 CMS (+https://nicotine360.org)' } })
    const mimetype = res.headers.get('content-type')?.split(';')[0].trim() || ''
    if (!res.ok || !mimetype.startsWith('image/')) return null
    const length = Number(res.headers.get('content-length'))
    if (length > 8_000_000) return null
    const data = Buffer.from(await res.arrayBuffer())
    if (data.length > 8_000_000) return null
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image').replace(/[^\w.-]+/g, '-')
    return { data, mimetype, name }
  } catch {
    return null
  }
}
