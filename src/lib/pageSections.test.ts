import { describe, expect, it } from 'vitest'

import { sectionForPath, sectionLabel } from './pageSections'

describe('sectionForPath', () => {
  it('maps the homepage to home', () => {
    expect(sectionForPath('/')).toBe('home')
  })

  it('maps articles, bills and trademarks to tracking', () => {
    expect(sectionForPath('/articles')).toBe('tracking')
    expect(sectionForPath('/articles/42')).toBe('tracking')
    expect(sectionForPath('/bills/7')).toBe('tracking')
    expect(sectionForPath('/trademarks/3')).toBe('tracking')
  })

  it('maps nested dataset and publication pages to their section', () => {
    expect(sectionForPath('/datasets/cigarette-market-share')).toBe('data')
    expect(sectionForPath('/publications/us-news-clippings/issues/5')).toBe('publications')
  })

  it('does not confuse a prefix match with an unrelated path sharing a substring', () => {
    // /eventsomething should not match the /events section
    expect(sectionForPath('/eventsomething')).toBe('other')
  })

  it('maps staff tools and access-check to staff-tools', () => {
    expect(sectionForPath('/staff/analytics')).toBe('staff-tools')
    expect(sectionForPath('/access-check')).toBe('staff-tools')
  })

  it('falls back to other for an unrecognized path', () => {
    expect(sectionForPath('/reset-password/abc123')).toBe('other')
  })
})

describe('sectionLabel', () => {
  it('returns a human-readable label for a known key', () => {
    expect(sectionLabel('tracking')).toBe('Tracking (News/Legislation/Trademarks)')
  })
})
