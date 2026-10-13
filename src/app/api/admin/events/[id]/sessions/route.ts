import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'

const SESSION_TYPES = ['Keynote', 'Panel', 'Break', 'Other'] as const

/** Creates a Session for this event. `day` must be one of the event's own days (not a free date picker). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')

    const event = await payload.findByID({ collection: 'events', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    const body = await request.json()
    const title = String(body.title || '').trim()
    const day = String(body.day || '')
    const type = String(body.type || '')

    if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
    if (!SESSION_TYPES.includes(type as (typeof SESSION_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid session type.' }, { status: 400 })
    }
    const validDay = (event.days ?? []).some((d) => d.date === day)
    if (!validDay) return NextResponse.json({ error: "That date isn't one of this event's days." }, { status: 400 })

    const session = await payload.create({
      collection: 'sessions',
      data: {
        event: event.id,
        title,
        description: body.description || undefined,
        day,
        startTime: body.startTime || undefined,
        endTime: body.endTime || undefined,
        type: type as (typeof SESSION_TYPES)[number],
        room: body.room || undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, sessionId: session.id })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to create session.' }, { status: 500 })
  }
}
