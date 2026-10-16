export type AlertCondition = { key: string; title: string; message: string; path: string }

/** Friday's 12:00 UTC import has four hours to finish; its Gazette is next Tuesday. */
export function expectedGazette(now: Date): { issueDate: string; due: Date } {
  const due = new Date(now)
  due.setUTCHours(16, 0, 0, 0)
  due.setUTCDate(due.getUTCDate() - ((due.getUTCDay() + 2) % 7))
  if (due > now) due.setUTCDate(due.getUTCDate() - 7)
  const issue = new Date(due)
  issue.setUTCDate(issue.getUTCDate() + 4)
  return { issueDate: issue.toISOString().slice(0, 10), due }
}

export function newsletterCondition(
  issue: {
    id: number
    title: string
    updatedAt: string
    email?: { status?: string | null; lastError?: string | null }
  },
  now: Date,
): AlertCondition | null {
  const stalled =
    issue.email?.status === 'sending' && now.getTime() - Date.parse(issue.updatedAt) > 10 * 60_000
  if (issue.email?.status !== 'failed' && !stalled) return null
  return {
    key: `newsletter:${issue.id}`,
    title: `${stalled ? 'Stalled' : 'Failed'} newsletter: ${issue.title}`,
    message: stalled
      ? 'Delivery has remained in sending for over ten minutes. Check Newsletter deliveries and the active job before recovery. Accepted and uncertain messages must not be resent.'
      : 'Delivery failed. Review Newsletter deliveries and the issue error before retrying unsent recipients.',
    path: `/admin/collections/publication-issues/${issue.id}`,
  }
}
