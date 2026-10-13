import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { extensionCorsHeaders, extensionOptionsResponse } from '@/lib/extensionCors'

export async function OPTIONS(request: Request) {
  return extensionOptionsResponse(request)
}

/** Issues a staff JWT for the Nic360 News Clipper browser extension (tma-ext/) to use as `Authorization: JWT <token>`. */
export async function POST(request: Request) {
  const cors = extensionCorsHeaders(request.headers.get('origin'))

  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string }
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400, headers: cors })
    }

    const payload = await getPayload({ config: await config })
    const result = await payload.login({
      collection: 'staff',
      data: { email, password },
    })
    if (!result.user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401, headers: cors })
    }

    return NextResponse.json(
      {
        token: result.token,
        exp: result.exp,
        user: { id: result.user.id, name: result.user.name, role: result.user.role },
      },
      { headers: cors },
    )
  } catch {
    // Payload already distinguishes bad-password from locked-out internally and rate-limits via maxLoginAttempts; no need to leak which here.
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401, headers: cors })
  }
}
