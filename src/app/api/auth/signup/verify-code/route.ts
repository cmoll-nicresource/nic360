import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { isCodeExpired } from '@/lib/signupCode'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; code?: string }
    const email = body.email?.trim().toLowerCase()
    const code = body.code?.trim()
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 })
    }

    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    const user = docs[0]
    if (!user) {
      return NextResponse.json({ error: 'Start sign-up again.' }, { status: 400 })
    }
    if (isCodeExpired(user.signup?.codeExpiresAt)) {
      return NextResponse.json({ error: 'That code has expired. Request a new one.' }, { status: 400 })
    }
    if (!user.signup?.code || user.signup.code !== code) {
      return NextResponse.json({ error: 'Incorrect code.' }, { status: 400 })
    }

    await payload.update({
      collection: 'users',
      id: user.id,
      // `_verified` is a Payload-managed field, not part of the public update type.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { _verified: true, signup: { code: null, codeExpiresAt: null } } as any,
      overrideAccess: true,
    })

    // Re-fetch (depth 1) to see whether the verify-time hook auto-matched an Access Provider.
    const settled = await payload.findByID({ collection: 'users', id: user.id, depth: 1, overrideAccess: true })
    const matchedProvider = settled.accessProvider && typeof settled.accessProvider === 'object' ? settled.accessProvider.name : null

    return NextResponse.json({ matchedProvider })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not verify code.' }, { status: 500 })
  }
}
