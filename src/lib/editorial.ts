import { lexicalToPlainText } from './lexical'

export function hasArtwork(
  image: { url?: string | null; width?: number | null; height?: number | null } | null,
): image is { url: string; width?: number | null; height?: number | null } {
  return Boolean(
    image?.url &&
    (image.width == null || image.width > 1) &&
    (image.height == null || image.height > 1),
  )
}

export function excerptSummary(value: unknown, max = 180) {
  const text = lexicalToPlainText(value)
  if (text.length <= max) return text
  const end = text.lastIndexOf(' ', max)
  return `${text.slice(0, end > max / 2 ? end : max)}…`
}

export function hasDistinctExcerpt(value: unknown, title: string) {
  const normalize = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  const text = normalize(lexicalToPlainText(value))
  return Boolean(text && text !== normalize(title))
}

export function sourceLabel(name?: string | null) {
  const label = (name || 'Industry news')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
  const publishers: Record<string, string> = {
    'bbc.com': 'BBC',
    'bbc.co.uk': 'BBC',
    'reuters.com': 'Reuters',
    'apnews.com': 'Associated Press',
    'chinadaily.com.cn': 'China Daily',
    'nytimes.com': 'The New York Times',
    'ft.com': 'Financial Times',
    'who.int': 'World Health Organization',
  }
  return publishers[label.toLowerCase()] || label
}

export function groupByDate<T>(items: T[], getDate: (item: T) => string | null | undefined) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const value = getDate(item)
    const label =
      value && !Number.isNaN(Date.parse(value))
        ? new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(value))
        : 'More news'
    const group = groups.get(label)
    if (group) group.push(item)
    else groups.set(label, [item])
  }
  return groups
}
