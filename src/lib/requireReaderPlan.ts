import { headers as getHeaders } from 'next/headers.js'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies, type ReaderPlan } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

/** For API routes gated by a reader's plan (e.g. Premium-only Data downloads). */
export async function requireReaderPlan(
  required: 'base' | 'premium',
): Promise<{ payload: Payload; plan: ReaderPlan; isStaff: boolean }> {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = staffHasRole(user, 'editor')
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'

  if (!isStaff && !planSatisfies(plan, required)) {
    throw new Response(JSON.stringify({ error: `A ${required} subscription is required.` }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  return { payload, plan, isStaff }
}
