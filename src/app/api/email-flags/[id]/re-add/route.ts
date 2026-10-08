import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'

/**
 * Staff press this after deleting the contact in Mailchimp by hand (Mailchimp
 * won't let an API flip someone straight back to subscribed). Restores the
 * user's prior publication choices, which re-triggers the Mailchimp sync
 * hook, then marks the flag resolved.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('gatekeeper')

    const flag = await payload.findByID({ collection: 'email-flags', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!flag) return NextResponse.json({ error: 'Email flag not found.' }, { status: 404 })

    const userId = typeof flag.user === 'object' ? flag.user.id : flag.user
    const publicationIds = (flag.publicationsBefore ?? []).map((p) => (typeof p === 'object' ? p.id : p))

    await payload.update({
      collection: 'users',
      id: userId,
      data: { emailPublications: publicationIds },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'email-flags',
      id,
      data: { status: 'resolved' },
      overrideAccess: true,
    })

    return NextResponse.json({ restored: publicationIds.length })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to re-add.' }, { status: 500 })
  }
}
