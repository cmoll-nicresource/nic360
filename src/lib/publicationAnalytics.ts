import type { Payload, Where } from 'payload'

export type PublicationIssueStatsRow = {
  id: number
  title: string
  publicationId: number | null
  publicationTitle: string
  issueDate: string
  recipientCount: number
  delivered: number
  opens: number
  clicks: number
  bounces: number
  complaints: number
  openRate: number | null
  clickRate: number | null
}

export type PublicationStatsFilters = {
  publicationId?: number
  dateFrom?: string
  dateTo?: string
  keyword?: string
}

function rate(count: number, of: number): number | null {
  return of > 0 ? count / of : null
}

/** Issues matching the filters, newest first, each with its delivery stats and computed open/click rates. */
export async function searchPublicationIssueStats(
  payload: Payload,
  filters: PublicationStatsFilters,
): Promise<PublicationIssueStatsRow[]> {
  const and: Where[] = [{ 'email.status': { equals: 'sent' } }]
  if (filters.publicationId) and.push({ publication: { equals: filters.publicationId } })
  if (filters.dateFrom) and.push({ issueDate: { greater_than_equal: filters.dateFrom } })
  if (filters.dateTo) and.push({ issueDate: { less_than_equal: filters.dateTo } })
  if (filters.keyword) and.push({ title: { contains: filters.keyword } })

  const { docs } = await payload.find({
    collection: 'publication-issues',
    where: { and },
    depth: 1,
    sort: '-issueDate',
    limit: 1000,
    overrideAccess: true,
  })

  return docs.map((issue) => {
    const recipientCount = issue.stats?.recipientCount ?? 0
    const opens = issue.stats?.opens ?? 0
    const clicks = issue.stats?.clicks ?? 0
    return {
      id: issue.id,
      title: issue.title,
      publicationId: typeof issue.publication === 'object' ? issue.publication.id : issue.publication,
      publicationTitle: typeof issue.publication === 'object' ? issue.publication.title : '',
      issueDate: issue.issueDate,
      recipientCount,
      delivered: issue.stats?.delivered ?? 0,
      opens,
      clicks,
      bounces: issue.stats?.bounces ?? 0,
      complaints: issue.stats?.complaints ?? 0,
      openRate: rate(opens, recipientCount),
      clickRate: rate(clicks, recipientCount),
    }
  })
}

export type PublicationStatsTotals = {
  count: number
  totalRecipients: number
  totalDelivered: number
  totalOpens: number
  totalClicks: number
  totalBounces: number
  totalComplaints: number
  avgOpenRate: number | null
  avgClickRate: number | null
}

/**
 * Totals and averages across a set of issues — e.g. "the last 10 Daily
 * Executive Summaries". Average rates are the mean of each issue's own
 * open/click rate (issues with no recipients are excluded from that
 * average, not treated as 0%), not opens-over-recipients across the whole
 * set, so one huge issue can't dominate the average.
 */
export function summarizePublicationStats(rows: PublicationIssueStatsRow[]): PublicationStatsTotals {
  const withRecipients = rows.filter((r) => r.recipientCount > 0)

  const sum = (f: (r: PublicationIssueStatsRow) => number) => rows.reduce((total, r) => total + f(r), 0)
  const avg = (f: (r: PublicationIssueStatsRow) => number | null) => {
    const values = withRecipients.map(f).filter((v): v is number => v !== null)
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
  }

  return {
    count: rows.length,
    totalRecipients: sum((r) => r.recipientCount),
    totalDelivered: sum((r) => r.delivered),
    totalOpens: sum((r) => r.opens),
    totalClicks: sum((r) => r.clicks),
    totalBounces: sum((r) => r.bounces),
    totalComplaints: sum((r) => r.complaints),
    avgOpenRate: avg((r) => r.openRate),
    avgClickRate: avg((r) => r.clickRate),
  }
}
