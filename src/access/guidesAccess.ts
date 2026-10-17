import type { Access, Where } from 'payload'

import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

/**
 * Most guides require Premium; a Guide can opt into Base access via its own
 * `requiresPremium: false` — a real business exception (a handful of guides
 * are open to Base subscribers), not a blanket Base-or-Premium rule.
 * Returns a Where clause for Base subscribers so both the list and the
 * document read are scoped the same way, same pattern as
 * EventRegistrations' readOwnOrManaged.
 */
export const canReadGuide: Access = async ({ req }) => {
  if (staffHasRole(req.user, 'editor')) return true
  if (req.user?.collection !== 'users') return false

  const plan = await getReaderPlan(req.user, req.payload)
  if (planSatisfies(plan, 'premium')) return { _status: { equals: 'published' } } as Where
  if (planSatisfies(plan, 'base'))
    return {
      and: [{ _status: { equals: 'published' } }, { requiresPremium: { equals: false } }],
    } as Where
  return false
}
