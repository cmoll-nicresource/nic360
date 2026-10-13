import { describe, expect, it } from 'vitest'

import { summarizePublicationStats, type PublicationIssueStatsRow } from './publicationAnalytics'

function row(overrides: Partial<PublicationIssueStatsRow> = {}): PublicationIssueStatsRow {
  return {
    id: 1,
    title: 'Daily Executive Summary - 10/1/2026',
    publicationId: 1,
    publicationTitle: 'Daily Executive Summary',
    issueDate: '2026-10-01T12:00:00.000Z',
    recipientCount: 1000,
    delivered: 990,
    opens: 400,
    clicks: 80,
    bounces: 10,
    complaints: 1,
    openRate: 0.4,
    clickRate: 0.08,
    ...overrides,
  }
}

describe('summarizePublicationStats', () => {
  it('sums counts across every issue', () => {
    const totals = summarizePublicationStats([
      row({ recipientCount: 1000, opens: 400, clicks: 80, bounces: 10, complaints: 1 }),
      row({ recipientCount: 950, opens: 300, clicks: 60, bounces: 5, complaints: 0 }),
    ])
    expect(totals.count).toBe(2)
    expect(totals.totalRecipients).toBe(1950)
    expect(totals.totalOpens).toBe(700)
    expect(totals.totalClicks).toBe(140)
    expect(totals.totalBounces).toBe(15)
    expect(totals.totalComplaints).toBe(1)
  })

  it('averages each issue\'s own rate, not opens-over-total-recipients', () => {
    // A huge issue with a low rate shouldn't drown out a small issue with a high rate.
    const totals = summarizePublicationStats([
      row({ recipientCount: 10, opens: 9, openRate: 0.9 }),
      row({ recipientCount: 10000, opens: 1000, openRate: 0.1 }),
    ])
    expect(totals.avgOpenRate).toBeCloseTo(0.5, 5)
  })

  it('excludes issues with zero recipients from the average, not counting them as 0%', () => {
    const totals = summarizePublicationStats([
      row({ recipientCount: 1000, openRate: 0.4 }),
      row({ recipientCount: 0, openRate: null }),
    ])
    expect(totals.avgOpenRate).toBe(0.4)
  })

  it('returns null averages for an empty result set', () => {
    const totals = summarizePublicationStats([])
    expect(totals.count).toBe(0)
    expect(totals.avgOpenRate).toBeNull()
    expect(totals.avgClickRate).toBeNull()
    expect(totals.totalRecipients).toBe(0)
  })

  it('returns null averages when every issue has zero recipients', () => {
    const totals = summarizePublicationStats([row({ recipientCount: 0, openRate: null, clickRate: null })])
    expect(totals.avgOpenRate).toBeNull()
    expect(totals.avgClickRate).toBeNull()
  })
})
