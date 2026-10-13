import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'

/** Creates a Discount code scoped to this event. Gatekeeper+ only, matching the collection's own access rule. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('gatekeeper')

    const event = await payload.findByID({ collection: 'events', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    const body = await request.json()
    const code = String(body.code || '').trim()
    const percentOff = Number(body.percentOff)
    const maxUses = Number(body.maxUses)

    if (!code) return NextResponse.json({ error: 'Code is required.' }, { status: 400 })
    if (!(percentOff >= 1 && percentOff <= 100)) {
      return NextResponse.json({ error: 'Percent off must be between 1 and 100.' }, { status: 400 })
    }
    if (!(maxUses >= 1)) return NextResponse.json({ error: 'Max uses must be at least 1.' }, { status: 400 })

    const discountCode = await payload.create({
      collection: 'discount-codes',
      data: {
        code,
        event: event.id,
        accessProvider: body.accessProviderId || undefined,
        percentOff,
        maxUses,
        ticketTypes: Array.isArray(body.ticketTypeNames)
          ? body.ticketTypeNames.map((name: string) => ({ name }))
          : undefined,
        expiresAt: body.expiresAt || undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, discountCodeId: discountCode.id })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to create discount code.' }, { status: 500 })
  }
}
