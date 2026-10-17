/** Use the saved calendar date consistently on the server and in the issue editor. */
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
          day: '2-digit',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(date)
  return `${name} - ${period}`
}
