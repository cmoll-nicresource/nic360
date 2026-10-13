import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'

/** Replaces the event's whole `ticketTypes` array — the dashboard edits the list client-side and saves it in one shot. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')

    const body = await request.json()
    if (!Array.isArray(body.ticketTypes)) {
      return NextResponse.json({ error: 'ticketTypes must be an array.' }, { status: 400 })
    }

    await payload.update({
      collection: 'events',
      id,
      data: { ticketTypes: body.ticketTypes },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to save ticket types.' }, { status: 500 })
  }
}
