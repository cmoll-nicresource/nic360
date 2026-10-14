/**
 * "Oct 12, 2026" instead of the locale-default "10/12/2026" — reads as
 * edited copy rather than raw database output, and is unambiguous for
 * international members (no day/month ordering confusion).
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  // UTC avoids the date shifting a day depending on the server/browser's
  // local timezone — these are calendar dates (bill date, source date,
  // issue date), not timestamps a reader needs localized.
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
