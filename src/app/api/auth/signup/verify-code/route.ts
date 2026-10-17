import { getPayload } from 'payload'
import { NextResponse } from 'next/server'
import { sql } from '@payloadcms/db-postgres'
import config from '@/payload.config'
import { isCodeExpired, codeExpiresAt } from '@/lib/signupCode'
import { checkSignupCode, signupCompletionProof, SIGNUP_COOKIE } from '@/lib/signupChallenge'
import { inPayloadTransaction, transactionDb } from '@/lib/payloadTransaction'
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; code?: string }
    const email = body.email?.trim().toLowerCase(),
      code = body.code?.trim()
    if (!email || !code)
      return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 })
    const payload = await getPayload({ config })
    const result = await inPayloadTransaction(payload, async (req) => {
      await transactionDb(payload, req.transactionID).execute(
        sql`SELECT id FROM users WHERE email=${email} FOR UPDATE`,
      )
      const user = (
        await payload.find({
          collection: 'users',
          where: { email: { equals: email } },
          depth: 0,
          limit: 1,
          overrideAccess: true,
          req,
        })
      ).docs[0]
      if (!user || isCodeExpired(user.signup?.codeExpiresAt) || user.signup?.completedAt)
        return { error: 'That code has expired. Request a new one.' }
      const checked = checkSignupCode(user.signup?.code, code)
      if (!checked.valid) {
        if (checked.next)
          await payload.update({
            collection: 'users',
            id: user.id,
            data: { signup: { code: checked.next } },
            req,
            overrideAccess: true,
          })
        return { error: 'Incorrect or expired code. Request a new one after five attempts.' }
      }
      const proof = signupCompletionProof()
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          _verified: true,
          signup: { code: proof.stored, codeExpiresAt: codeExpiresAt() },
        } as never,
        overrideAccess: true,
        req,
      })
      const settled = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 1,
        overrideAccess: true,
        req,
      })
      return {
        token: proof.token,
        matchedProvider:
          typeof settled.accessProvider === 'object' ? settled.accessProvider?.name : null,
      }
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    const response = NextResponse.json({ matchedProvider: result.matchedProvider })
    response.cookies.set(SIGNUP_COOKIE, result.token, {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
      sameSite: 'strict',
      path: '/api/auth/signup',
      maxAge: 900,
    })
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Could not verify code.' }, { status: 500 })
  }
}
