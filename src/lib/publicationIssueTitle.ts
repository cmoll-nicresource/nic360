/** Use the saved calendar date consistently on the server and in the issue editor. */
export function defaultIssueDate(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  // Noon keeps this date stable in US admin browsers; the field represents a day.
  return `${date}T12:00:00.000Z`
}

export function publicationIssueTitle(
  name: string,
  frequency: string,
  issueDate: string | Date,
  reportMonth?: Date,
) {
  const date = new Date(issueDate)
  if (!Number.isFinite(date.getTime())) return ''
  const period =
    frequency === 'monthly'
      ? new Intl.DateTimeFormat('en-US', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(
          reportMonth ?? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)),
        )
      : new Intl.DateTimeFormat('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(date)
  return `${name} - ${period}`
}
