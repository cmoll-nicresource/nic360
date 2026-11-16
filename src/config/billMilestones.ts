/**
 * How far a bill has progressed, in order. Stored on Bill.milestone and kept
 * in code so the front end and publications can label and sort it the same way.
 * Values are stored in Postgres enums (see migration/billMilestone.sql):
 * changing one here needs a matching SQL change.
 */
export const BILL_MILESTONES = [
  { value: 'introduced', label: 'Introduced' },
  { value: 'passed-one-chamber', label: 'Passed 1 chamber' },
  { value: 'passed-two-chambers', label: 'Passed 2 chambers' },
  { value: 'approved', label: 'Approved' },
  { value: 'enacted', label: 'Enacted' },
] as const

export type BillMilestone = (typeof BILL_MILESTONES)[number]['value']
