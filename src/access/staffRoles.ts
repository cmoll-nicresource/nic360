import type { PayloadRequest } from 'payload'

import type { Staff } from '@/payload-types'

export type StaffRole = Staff['role']
type RequestUser = PayloadRequest['user']

const ROLE_RANK: Record<StaffRole, number> = {
  editor: 0,
  gatekeeper: 1,
  admin: 2,
}

export function isStaffUser(user: RequestUser): user is Staff & { collection: 'staff' } {
  return !!user && 'collection' in user && user.collection === 'staff'
}

export function staffHasRole(user: RequestUser, min: StaffRole): boolean {
  if (!isStaffUser(user)) return false
  return ROLE_RANK[user.role] >= ROLE_RANK[min]
}

/**
 * Access-function factory for both collection- and field-level `access`
 * (e.g. `read: staffHasMinRole('gatekeeper')`). Takes only `{ req }` so it
 * structurally matches either args shape.
 */
export const staffHasMinRole =
  (min: StaffRole) =>
  ({ req }: { req: PayloadRequest }) =>
    staffHasRole(req.user, min)
