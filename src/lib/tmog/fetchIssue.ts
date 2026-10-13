export const MAX_WEEKS_BACK = 4

function formatYYYYMMDD(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** The next Tuesday on or after `date` (UTC), at midnight UTC. */
function nextTuesdayOnOrAfter(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const TUESDAY = 2
  const diff = (TUESDAY - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function issueUrl(issueDate: string): string {
  return `https://cdn.uspto.gov/doc/TMOGIssue_${issueDate}_entire?extension=xml`
}

/** The coming Tuesday relative to `referenceDate`, then up to `MAX_WEEKS_BACK` weeks before it, as YYYYMMDD strings. */
export function candidateIssueDates(referenceDate: Date = new Date()): string[] {
  const candidate = nextTuesdayOnOrAfter(referenceDate)
  const dates: string[] = []
  for (let attempt = 0; attempt <= MAX_WEEKS_BACK; attempt++) {
    const d = new Date(candidate)
    d.setUTCDate(d.getUTCDate() - 7 * attempt)
    dates.push(formatYYYYMMDD(d))
  }
  return dates
}

export type IssueFetchResult = { issueDate: string; url: string; response: Response }

/** Fetches one specific issue date (YYYYMMDD), for a manual re-run. Returns null on 404. */
export async function fetchSpecificIssue(issueDate: string): Promise<IssueFetchResult | null> {
  const url = issueUrl(issueDate)
  const response = await fetch(url, { redirect: 'follow' })
  if (response.status === 404) return null
  if (!response.ok || !response.body) {
    throw new Error(`USPTO feed returned ${response.status} for ${url}`)
  }
  return { issueDate, url, response }
}
