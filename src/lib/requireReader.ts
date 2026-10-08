import { headers as getHeaders } from 'next/headers.js'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import type { User } from '@/payload-types'

/** For API routes that readers (not staff) call, e.g. buying event tickets. */
export async function requireReader(): Promise<{ payload: Payload; user: User }> {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!user || !('collection' in user) || user.collection !== 'users') {
    throw new Response(JSON.stringify({ error: 'Sign in required.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  return { payload, user: user as unknown as User }
}
