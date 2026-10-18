import { cache } from 'react'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getSubscriptionPlan, planSatisfies } from '@/access/subscriptionPlan'
import { staffHasRole } from '@/access/staffRoles'

/** Request-scoped only: never share subscription results across visitors. */
export const frontendContext = cache(async () => {
  // Resolve request context before opening Payload. This also prevents static
  // prerendering of auth pages from trying to reach Railway's private DB at build time.
  const requestHeaders = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: requestHeaders })
  const isStaff = staffHasRole(user, 'editor')
  const plan = user?.collection === 'users' ? await getSubscriptionPlan(user, payload) : 'none'
  return {
    payload,
    user,
    isStaff,
    plan,
    now: new Date().toISOString(),
    canRead: isStaff || planSatisfies(plan, 'base'),
    canReadData: isStaff || planSatisfies(plan, 'premium'),
  }
})
