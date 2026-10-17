import type { Publication } from '@/payload-types'

/** One editorial grouping policy for the builder and the CMS settings screen. */
export function publicationGroupingRules(
  publication: Pick<Publication, 'slug' | 'format' | 'groupingRules'>,
): NonNullable<Publication['groupingRules']> {
  const saved = publication.groupingRules ?? {}
  if (publication.format !== 'excerpt-list') return saved
  return {
    ...saved,
    groupBy: publication.slug === 'us-news-clippings' ? 'primarySubject' : 'region',
    thenGroupBy: publication.slug === 'us-news-clippings' ? 'none' : 'primarySubject',
    sortBy: saved.sortBy ?? 'sourceDateDesc',
  }
}
