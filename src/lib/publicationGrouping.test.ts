import { describe, expect, it } from 'vitest'
import { publicationGroupingRules } from './publicationGrouping'

describe('publication grouping settings', () => {
  it.each(['global-news-clippings', 'vapor-news-clippings', 'daily-us-legislative-snapshot', 'weekly-us-legislative-report', 'new-excerpt-publication'])(
    'uses continent and primary subject for %s, preserving the chosen item sort',
    (slug) => {
      expect(publicationGroupingRules({
        slug, format: 'excerpt-list', groupingRules: { groupBy: 'sector', sortBy: 'title' },
      })).toEqual({ groupBy: 'region', thenGroupBy: 'primarySubject', sortBy: 'title' })
    },
  )
  it('uses subject alone for US news and defaults to newest first', () => {
    expect(publicationGroupingRules({ slug: 'us-news-clippings', format: 'excerpt-list' }))
      .toEqual({ groupBy: 'primarySubject', thenGroupBy: 'none', sortBy: 'sourceDateDesc' })
  })
  it('leaves PDF and custom HTML settings alone', () => {
    for (const format of ['pdf-report', 'custom-html'] as const)
      expect(publicationGroupingRules({ slug: 'example', format, groupingRules: { groupBy: 'country' } }))
        .toEqual({ groupBy: 'country' })
  })
})
