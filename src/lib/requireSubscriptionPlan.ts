import { headers as getHeaders } from 'next/headers.js'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { getSubscriptionPlan, planSatisfies, type SubscriptionPlan } from '@/access/subscriptionPlan'
import { staffHasRole } from '@/access/staffRoles'

/** For API routes gated by a user's plan (e.g. Premium-only Data downloads). */
export async function requireSubscriptionPlan(
  required: 'base' | 'premium',
): Promise<{ payload: Payload; plan: SubscriptionPlan; isStaff: boolean }> {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = staffHasRole(user, 'editor')
  const plan = user && 'collection' in user && user.collection === 'users' ? await getSubscriptionPlan(user, payload) : 'none'

  if (!isStaff && !planSatisfies(plan, required)) {
    throw new Response(JSON.stringify({ error: `A ${required} subscription is required.` }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  return { payload, plan, isStaff }
}
