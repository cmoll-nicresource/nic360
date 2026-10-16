import type { Publication } from '@/payload-types'

export function publicationGeography(publication: Pick<Publication, 'slug'>) {
  if (publication.slug === 'global-news-clippings') return 'non-us'
  return [
    'us-news-clippings',
    'daily-us-legislative-snapshot',
    'weekly-us-legislative-report',
  ].includes(publication.slug)
    ? 'us'
    : 'any'
}

/** Named publications have editorial boundaries; saved filters can narrow them further. */
export function publicationSelectionRules(
  publication: Pick<Publication, 'title' | 'slug' | 'selectionRules'>,
  usId?: number,
) {
  const rules = structuredClone(publication.selectionRules ?? {})
  if (/\bclippings\s*$/i.test(publication.title) || /(?:^|-)clippings$/.test(publication.slug))
    rules.excerptTypes = ['articles']
  const geography = publicationGeography(publication)
  if (geography !== 'any' && !usId)
    throw new Error(
      'A unique United States country location is required to build this publication.',
    )
  if (geography === 'us') rules.locations = { ...rules.locations, include: [usId!] }
  if (geography === 'non-us')
    rules.locations = {
      ...rules.locations,
      exclude: [
        ...new Set([
          ...(rules.locations?.exclude ?? []).map((ref) =>
            typeof ref === 'object' ? ref.id : ref,
          ),
          usId!,
        ]),
      ],
    }
  // US news covers all products, including stories also selected by Vapor Clippings.
  if (publication.slug === 'us-news-clippings') rules.products = { include: [], exclude: [] }
  return rules
}
