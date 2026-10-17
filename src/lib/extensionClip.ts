import type { Location } from '@/payload-types'

export function clipHttpUrl(value: unknown, httpsOnly = false): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value.trim())
    if (!(httpsOnly ? url.protocol === 'https:' : ['http:', 'https:'].includes(url.protocol)) || url.username || url.password)
      return undefined
    // Signed image URLs may depend on every query parameter.
    if (httpsOnly) return url.href
    url.hash = ''
    for (const key of [...url.searchParams.keys()])
      if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key.toLowerCase())) url.searchParams.delete(key)
    return url.href
  } catch { return undefined }
}

/** Invalid dates stay missing; the clipping date is never substituted. */
export function clipPublishedDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') throw new Error('Publication date must be a date or ISO timestamp.')
  const raw = value.trim()
  if (!raw) return undefined
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw))
    throw new Error('Use YYYY-MM-DD or an ISO timestamp with a timezone for the publication date.')
  const date = new Date(raw)
  const [year, month, day] = raw.slice(0, 10).split('-').map(Number)
  const calendar = new Date(Date.UTC(year, month - 1, day))
  if (!Number.isFinite(date.getTime()) || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day)
    throw new Error('Publication date is invalid.')
  return date.toISOString()
}

export function clipLocationCatalog(locations: Location[]) {
  const byId = new Map(locations.map(location => [location.id, location]))
  return locations.map(location => {
    const names = [location.name], seen = new Set([location.id])
    let parent = typeof location.parent === 'object' ? location.parent?.id : location.parent
    const parentId = parent ?? null
    while (parent && !seen.has(parent)) {
      seen.add(parent)
      const ancestor = byId.get(parent)
      if (!ancestor) break
      names.push(ancestor.name)
      parent = typeof ancestor.parent === 'object' ? ancestor.parent?.id : ancestor.parent
    }
    return { id: location.id, name: location.name, level: location.level, parent: parentId, label: names.join(' › ') }
  })
}
