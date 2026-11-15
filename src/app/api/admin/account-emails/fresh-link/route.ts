import { NextResponse } from 'next/server'

import { accountSiteUrl } from '@/lib/accountEmail'
import { linkLifetimeMs } from '@/lib/accountEmailLog'
import { requireStaff } from '@/lib/requireStaff'

/**
 * For a user who is not receiving email: creates a password link without
 * emailing it, so a gatekeeper can pass it on another way (phone call, a
 * different mailbox, chat). Generating one replaces any earlier link for that
 * user, and the request is recorded in the account email log.
 */
export async function POST(request: Request) {
  try {
    const { payload, user: staff } = await requireStaff('gatekeeper')
    if (request.headers.get('origin') !== new URL(payload.config.serverURL || 'http://localhost:3000').origin)
      return NextResponse.json({ error: 'A same-origin request is required.' }, { status: 403 })

    let body: { userId?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    const userId = Number(body.userId)
    if (!Number.isSafeInteger(userId) || userId <= 0)
      return NextResponse.json({ error: 'Choose a user.' }, { status: 400 })

    const target = await payload
      .findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: target.email },
      disableEmail: true,
    })
    const expiresAt = new Date(Date.now() + (linkLifetimeMs('staff-link') ?? 3_600_000)).toISOString()
    const staffName = (staff as { name?: string; email?: string } | null)?.name || staff?.email || 'staff'

    await payload.create({
      collection: 'account-emails',
      data: {
        recipient: target.email.toLowerCase(),
        kind: 'staff-link',
        subject: `Password link issued by ${staffName}`,
        status: 'sent',
        linkExpiresAt: expiresAt,
        note: 'Created without sending an email; passed on by staff.',
        issuedBy: staff?.id,
      },
      overrideAccess: true,
    })
    payload.logger.info({ event: 'staff-password-link', staffId: staff?.id, userId }, 'Staff issued a password link')

    return NextResponse.json(
      { url: `${accountSiteUrl()}/reset-password/${encodeURIComponent(token)}`, expiresAt },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('Fresh password link failed', err)
    return NextResponse.json({ error: 'Could not create a link.' }, { status: 500 })
  }
}
