import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { inPayloadTransaction, transactionDb } from '@/lib/payloadTransaction'
import { sql } from '@payloadcms/db-postgres'

/**
 * Staff use this after confirming the reader wants to resume and reviewing
 * delivery problems (including any AWS account-level suppression).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('gatekeeper')

    const flag = await payload
      .findByID({ collection: 'email-flags', id, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!flag) return NextResponse.json({ error: 'Email flag not found.' }, { status: 404 })

    const userId = typeof flag.user === 'object' ? flag.user?.id : flag.user
    if (!userId)
      return NextResponse.json(
        {
          error:
            'This reader was deleted. The flag remains for follow-up; publication choices cannot be restored.',
        },
        { status: 409 },
      )
    if (flag.status === 'resolved')
      return NextResponse.json({ error: 'This flag is already resolved.' }, { status: 409 })
    const publicationIds = (flag.publicationsBefore ?? []).map((p) =>
      typeof p === 'object' ? p.id : p,
    )

    await inPayloadTransaction(payload, async (req) => {
      await transactionDb(payload, await req.transactionID).execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`email-flag:${flag.recipientEmail}`}))`,
      )
      const current = await payload.findByID({
        collection: 'email-flags',
        id,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (current.status === 'resolved')
        throw new Response(JSON.stringify({ error: 'This flag is already resolved.' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        })
      await payload.update({
        collection: 'users',
        id: userId,
        data: { emailPublications: publicationIds },
        overrideAccess: true,
        req,
      })

      await payload.update({
        collection: 'email-flags',
        id,
        data: { status: 'resolved' },
        overrideAccess: true,
        req,
      })
    })

    return NextResponse.json({ restored: publicationIds.length })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to re-add.' }, { status: 500 })
  }
}
