import type { Access } from 'payload'

import { getSubscriptionPlan, planSatisfies } from '@/access/subscriptionPlan'
import { staffHasRole } from '@/access/staffRoles'

/** Data (datasets, rows, downloads) requires Premium specifically — Base is not enough. */
export const requirePremiumToRead: Access = async ({ req }) => {
  if (staffHasRole(req.user, 'editor')) return true
  if (req.user?.collection !== 'users') return false
  const plan = await getSubscriptionPlan(req.user, req.payload)
  return planSatisfies(plan, 'premium')
}

export const staffCanManageData: Access = ({ req }) => staffHasRole(req.user, 'editor')
