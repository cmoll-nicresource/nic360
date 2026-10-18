import { describe, expect, it } from 'vitest'
import { lexicalFromText } from './lexical'
import {
  excerptSummary,
  groupByDate,
  hasArtwork,
  hasDistinctExcerpt,
  sourceLabel,
} from './editorial'
describe('user presentation', () => {
  it('uses a branded fallback instead of a one-pixel migration placeholder', () => {
    expect(hasArtwork({ url: '/blank.png', width: 1, height: 1 })).toBe(false)
    expect(hasArtwork({ url: '/cover.png', width: 400, height: 600 })).toBe(true)
    expect(hasArtwork(null)).toBe(false)
  })
  it('does not treat a repeated headline as a useful summary', () => {
    expect(hasDistinctExcerpt(lexicalFromText('A new tax law!'), 'A new tax law')).toBe(false)
    expect(
      hasDistinctExcerpt(
        lexicalFromText('The legislation takes effect in January.'),
        'A new tax law',
      ),
    ).toBe(true)
    expect(hasDistinctExcerpt(null, 'A new tax law')).toBe(false)
  })
  it('bounds excerpts without inventing text', () =>
    expect(excerptSummary(lexicalFromText('One two three four five six'), 14)).toBe(
      'One two three…',
    ))
  it('groups date-only news consistently in UTC and handles missing dates', () => {
    expect([
      ...groupByDate(
        [{ date: '2026-10-15T00:00:00Z' }, { date: null }],
        (item) => item.date,
      ).keys(),
    ]).toEqual(['Thursday, October 15, 2026', 'More news'])
  })
  it('uses recognized publisher names and preserves unknown source identities', () => {
    expect(sourceLabel('https://www.bbc.com/')).toBe('BBC')
    expect(sourceLabel('example.org')).toBe('example.org')
  })
})
