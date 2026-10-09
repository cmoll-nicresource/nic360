import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { codeExpiresAt, generateCode, sendSignupCodeEmail } from '@/lib/signupCode'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string }
    const email = body.email?.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    const existing = docs[0]

    if (existing?.signup?.completedAt) {
      return NextResponse.json(
        { error: 'An account already exists for that email. Sign in instead.', status: 'exists' },
        { status: 409 },
      )
    }

    const code = generateCode()
    const expiresAt = codeExpiresAt()

    const userId = existing
      ? existing.id
      : (
          await payload.create({
            collection: 'users',
            data: {
              email,
              password: crypto.randomUUID(),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            overrideAccess: true,
            disableVerificationEmail: true,
          })
        ).id

    await payload.update({
      collection: 'users',
      id: userId,
      data: { signup: { code, codeExpiresAt: expiresAt } },
      overrideAccess: true,
    })

    await sendSignupCodeEmail(payload, email, code)

    return NextResponse.json({ status: 'sent' })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not start sign-up.' }, { status: 500 })
  }
}
