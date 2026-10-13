import { describe, expect, it } from 'vitest'

import { summarizeAdStats, type AdStatsRow } from './adAnalytics'

function row(overrides: Partial<AdStatsRow>): AdStatsRow {
  return {
    id: 1,
    advertiser: 'Test Advertiser',
    publicationId: 1,
    publicationTitle: 'Test Publication',
    rank: 1,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    impressions: 0,
    clicks: 0,
    ctr: null,
    ...overrides,
  }
}

describe('summarizeAdStats', () => {
  it('sums impressions and clicks, and computes an overall CTR', () => {
    const totals = summarizeAdStats([
      row({ impressions: 1000, clicks: 20 }),
      row({ impressions: 500, clicks: 5 }),
    ])
    expect(totals.count).toBe(2)
    expect(totals.totalImpressions).toBe(1500)
    expect(totals.totalClicks).toBe(25)
    expect(totals.avgCtr).toBeCloseTo(25 / 1500)
  })

  it('returns a null CTR when there are no impressions, rather than dividing by zero', () => {
    const totals = summarizeAdStats([row({ impressions: 0, clicks: 0 })])
    expect(totals.avgCtr).toBeNull()
  })

  it('handles an empty set', () => {
    const totals = summarizeAdStats([])
    expect(totals).toEqual({ count: 0, totalImpressions: 0, totalClicks: 0, avgCtr: null })
  })
})
