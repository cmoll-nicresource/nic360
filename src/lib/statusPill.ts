export type StatusVariant = 'blue' | 'amber' | 'green' | 'grey'
export type StatusPill = { label: string; variant: StatusVariant }

const FAILED_KEYWORDS = ['failed', 'died', 'vetoed', 'withdrawn', 'cancell']
const PASSED_KEYWORDS = ['passed']

/**
 * Bills have no structured status enum (statusText is free text migrated
 * from StateNet), so this reads the signal that does exist: effectiveDate/
 * approvalDate mean it's law regardless of what the text says, otherwise a
 * handful of keywords distinguish "dead", "passed one chamber" and
 * "introduced/in committee" (the default).
 */
export function billStatusPill(bill: {
  statusText?: string | null
  approvalDate?: string | null
  effectiveDate?: string | null
}): StatusPill {
  if (bill.effectiveDate || bill.approvalDate) {
    return { label: 'Enacted', variant: 'green' }
  }
  const text = (bill.statusText || '').toLowerCase()
  if (FAILED_KEYWORDS.some((k) => text.includes(k))) {
    return { label: 'Failed', variant: 'grey' }
  }
  if (PASSED_KEYWORDS.some((k) => text.includes(k))) {
    return { label: 'Passed one chamber', variant: 'amber' }
  }
  return { label: 'Introduced', variant: 'blue' }
}

/** Trademark lifecycle is unambiguous from its own dated fields. */
export function trademarkStatusPill(trademark: {
  registeredDate?: string | null
  cancelledDate?: string | null
  publishedDate?: string | null
}): StatusPill {
  if (trademark.cancelledDate) return { label: 'Cancelled', variant: 'grey' }
  if (trademark.registeredDate) return { label: 'Registered', variant: 'green' }
  if (trademark.publishedDate) return { label: 'Published', variant: 'blue' }
  return { label: 'Filed', variant: 'blue' }
}
