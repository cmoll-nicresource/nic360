import type { Payload } from 'payload'

/** All Gazette issue dates belonging to the reporting calendar month (UTC). */
export function monthlyGazetteDates(monthStart: Date): string[] {
  const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1))
  const month = date.getUTCMonth()
  date.setUTCDate(1 + ((2 - date.getUTCDay() + 7) % 7))
  const dates: string[] = []
  while (date.getUTCMonth() === month) {
    dates.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 7)
  }
  return dates
}

export class IncompleteTrademarkMonthError extends Error {
  readonly code = 'INCOMPLETE_TRADEMARK_MONTH'
  constructor(
    readonly missingIssueDates: string[],
    monthStart: Date,
  ) {
    const month = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(monthStart)
    super(
      `Cannot generate the ${month} trademark report. Missing successful Gazette imports: ${missingIssueDates.map((date) => date.replaceAll('-', '')).join(', ')}. Run these issue dates under Live USPTO import, then generate the monthly report again.`,
    )
    this.name = 'IncompleteTrademarkMonthError'
  }
}

export async function requireCompleteTrademarkMonth(
  payload: Payload,
  monthStart: Date,
): Promise<void> {
  const dates = monthlyGazetteDates(monthStart)
  const complete = await Promise.all(
    dates.map(async (date) => {
      const issue = date.replaceAll('-', '')
      const result = await payload.find({
        collection: 'trademark-import-runs',
        where: {
          and: [
            { issueDate: { equals: `${date}T00:00:00.000Z` } },
            { status: { equals: 'succeeded' } },
            {
              feedSource: {
                equals: `https://cdn.uspto.gov/doc/TMOGIssue_${issue}_entire?extension=xml`,
              },
            },
          ],
        },
        limit: 1,
        depth: 0,
      select: { issueDate: true },
        overrideAccess: true,
      })
      return result.docs.length > 0
    }),
  )
  const missing = dates.filter((_, index) => !complete[index])
  if (missing.length) throw new IncompleteTrademarkMonthError(missing, monthStart)
}
