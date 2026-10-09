import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'

type CompleteBody = {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  salutation?: string
  department?: string
  phone?: string
  businessSector?: string
  timezone?: string
  newCompanyName?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompleteBody
    const email = body.email?.trim().toLowerCase()
    if (!email || !body.password || body.password.length < 8) {
      return NextResponse.json({ error: 'Email and an 8+ character password are required.' }, { status: 400 })
    }
    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })
    }

    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const user = docs[0]
    if (!user || !user._verified) {
      return NextResponse.json({ error: 'Verify your email first.' }, { status: 400 })
    }

    let accessProviderId = user.accessProvider ? (typeof user.accessProvider === 'object' ? user.accessProvider.id : user.accessProvider) : undefined

    if (!accessProviderId && body.newCompanyName?.trim()) {
      const domain = email.split('@')[1]
      const provider = await payload.create({
        collection: 'access-providers',
        data: {
          name: body.newCompanyName.trim(),
          status: 'pending',
          plan: 'none',
          allowedDomains: domain ? [{ domain }] : [],
        },
        overrideAccess: true,
      })
      accessProviderId = provider.id
    }

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        password: body.password,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        salutation: body.salutation || undefined,
        department: body.department || undefined,
        phone: body.phone || undefined,
        businessSector: body.businessSector || undefined,
        timezone: body.timezone || undefined,
        accessProvider: accessProviderId,
        signup: { completedAt: new Date().toISOString() },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not complete sign-up.' }, { status: 500 })
  }
}
