import { headers as getHeaders } from 'next/headers.js'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@/payload.config'
import { staffHasRole, type StaffRole } from '@/access/staffRoles'

/** For API routes: resolves the payload instance + current user, or throws a Response to return as-is. */
export async function requireStaff(
  minRole: StaffRole = 'editor',
): Promise<{ payload: Payload; user: PayloadRequest['user'] }> {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!staffHasRole(user, minRole)) {
    throw new Response(JSON.stringify({ error: 'Staff access required.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  return { payload, user }
}
