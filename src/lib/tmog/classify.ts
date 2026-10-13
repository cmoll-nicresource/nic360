export type TrademarkStatus = 'published' | 'registered' | 'cancelled' | 'renewed'

/**
 * Classifies a TMOG record by which Official Gazette section it was published
 * under — never by `MarkCurrentStatusCode`. That code is a snapshot taken
 * before the issue was assembled, so a record appearing in "Registrations
 * publishing" this week can still carry an old code like 681 or 686 instead
 * of 700. The section is the only reliable signal.
 *
 * Returns null for sections we don't track (e.g. "New Certificate",
 * "Correction of errors on registrations", or a Section 16A/16B removal
 * filed under "Registrations no longer in effect" with a status code outside
 * 709-713).
 */
export function classifyRecord(section: string, statusCode: string): TrademarkStatus | null {
  if (section.includes('Applications publishing for opposition')) return 'published'
  if (section.includes('Registrations publishing')) return 'registered'
  if (section.includes('Registrations no longer in effect')) {
    const code = Number(statusCode)
    if (code >= 709 && code <= 713) return 'cancelled'
    return null
  }
  if (section.includes('Registrations renewed')) return 'renewed'
  return null
}
