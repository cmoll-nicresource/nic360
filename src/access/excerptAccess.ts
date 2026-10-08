import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

async function readerSatisfiesBasePlan(req: PayloadRequest): Promise<boolean> {
  if (req.user?.collection !== 'users') return false
  const plan = await getReaderPlan(req.user, req.payload)
  return planSatisfies(plan, 'base')
}

/**
 * Collection-level read for Articles/Bills: public (incl. anonymous visitors)
 * can list and open documents so listing pages can show title/teaser fields;
 * the body fields themselves are gated by `canReadFullContent` below.
 */
export const anyoneCanReadTeaser: Access = () => true

/**
 * Field-level access for a body/content field (Article.excerpt,
 * Bill.abstract, Bill.fullText): staff always see it; readers need an
 * effective Base or Premium plan. Returning false omits the field from the
 * response rather than erroring, which is what "full content checks the
 * plan" means in practice.
 */
export const canReadFullContent: FieldAccess = async ({ req }) => {
  if (staffHasRole(req.user, 'editor')) return true
  return readerSatisfiesBasePlan(req)
}

/**
 * Collection-level read for excerpt types with no public teaser
 * (Trademarks): the whole document requires at least a Base plan.
 */
export const requireBasePlanToRead: Access = async ({ req }) => {
  if (staffHasRole(req.user, 'editor')) return true
  return readerSatisfiesBasePlan(req)
}

/** Only staff (editor role or above) can create, edit or publish excerpts. */
export const staffCanWrite: Access = ({ req }) => staffHasRole(req.user, 'editor')
