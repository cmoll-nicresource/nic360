import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { getSubscriptionPlan, planSatisfies } from '@/access/subscriptionPlan'
import { staffHasRole } from '@/access/staffRoles'

async function userSatisfiesBasePlan(req: PayloadRequest): Promise<boolean> {
  if (req.user?.collection !== 'users') return false
  const plan = await getSubscriptionPlan(req.user, req.payload)
  return planSatisfies(plan, 'base')
}

/**
 * Collection-level read for Articles/Bills: public (incl. anonymous visitors)
 * can list and open documents so listing pages can show title/teaser fields;
 * the body fields themselves are gated by `canReadFullContent` below.
 */
export const anyoneCanReadTeaser: Access = ({ req }) =>
  staffHasRole(req.user, 'editor') || { _status: { equals: 'published' } }

/**
 * Field-level access for a body/content field (Article.excerpt,
 * Bill.abstract, Bill.fullText): staff always see it; users need an
 * effective Base or Premium plan. Returning false omits the field from the
 * response rather than erroring, which is what "full content checks the
 * plan" means in practice.
 */
export const canReadFullContent: FieldAccess = async ({ req }) => {
  if (staffHasRole(req.user, 'editor')) return true
  return userSatisfiesBasePlan(req)
}

/**
 * Collection-level read for excerpt types with no public teaser
 * (Trademarks): the whole document requires at least a Base plan.
 */
export const requireBasePlanToRead: Access = async ({ req }) => {
  if (staffHasRole(req.user, 'editor')) return true
  return userSatisfiesBasePlan(req)
}

/** Versioned subscriber content must not expose drafts through direct API reads. */
export const requireBasePlanForPublished: Access = async ({ req }) => {
  if (staffHasRole(req.user, 'editor')) return true
  return (await userSatisfiesBasePlan(req)) ? { _status: { equals: 'published' } } : false
}

/** Only staff (editor role or above) can create, edit or publish excerpts. */
export const staffCanWrite: Access = ({ req }) => staffHasRole(req.user, 'editor')
