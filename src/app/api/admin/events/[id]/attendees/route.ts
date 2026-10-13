import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { compRegisterExistingUser, compRegisterNewUser } from '@/lib/staffAddAttendee'

/** Add-existing, register-new, or cancel an attendee for this event. Gatekeeper+ only, matching registrations' own access rule. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('gatekeeper')

    const event = await payload.findByID({ collection: 'events', id, overrideAccess: true }).catch(() => null)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    const body = await request.json()

    if (body.action === 'add-existing') {
      const result = await compRegisterExistingUser(payload, event, {
        userId: Number(body.userId),
        ticketTypeName: String(body.ticketTypeName || ''),
        attendance: body.attendance === 'virtual' ? 'virtual' : 'in-person',
      })
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ ok: true, ...result })
    }

    if (body.action === 'add-new') {
      const name = String(body.name || '').trim()
      const email = String(body.email || '').trim()
      if (!name || !email) return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })

      const result = await compRegisterNewUser(payload, event, {
        name,
        email,
        ticketTypeName: String(body.ticketTypeName || ''),
        attendance: body.attendance === 'virtual' ? 'virtual' : 'in-person',
      })
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ ok: true, ...result })
    }

    if (body.action === 'cancel') {
      const registrationId = Number(body.registrationId)
      if (!registrationId) return NextResponse.json({ error: 'registrationId is required.' }, { status: 400 })

      const registration = await payload
        .findByID({ collection: 'event-registrations', id: registrationId, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!registration || (typeof registration.event === 'object' ? registration.event.id : registration.event) !== event.id) {
        return NextResponse.json({ error: 'Registration not found for this event.' }, { status: 404 })
      }

      await payload.update({
        collection: 'event-registrations',
        id: registrationId,
        data: { status: 'cancelled' },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to update attendees.' }, { status: 500 })
  }
}
