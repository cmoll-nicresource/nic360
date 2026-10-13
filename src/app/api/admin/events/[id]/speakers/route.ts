import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'

/** Attach, detach or create+attach a Speaker for this event's `speakers` field. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')

    const event = await payload.findByID({ collection: 'events', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    const form = await request.formData()
    const action = form.get('action')
    const currentIds = (event.speakers ?? []).map((s) => (typeof s === 'object' ? s.id : s))

    if (action === 'attach' || action === 'detach') {
      const speakerId = Number(form.get('speakerId'))
      if (!speakerId) return NextResponse.json({ error: 'speakerId is required.' }, { status: 400 })

      const nextIds =
        action === 'attach' ? Array.from(new Set([...currentIds, speakerId])) : currentIds.filter((s) => s !== speakerId)

      await payload.update({ collection: 'events', id, data: { speakers: nextIds }, overrideAccess: true })
      return NextResponse.json({ ok: true })
    }

    if (action === 'create') {
      const name = String(form.get('name') || '').trim()
      const role = String(form.get('role') || '').trim()
      const company = String(form.get('company') || '').trim()
      const bio = String(form.get('bio') || '').trim()
      const file = form.get('headshot')
      if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

      let headshotId: number | undefined
      if (file instanceof File && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const headshot = await payload.create({
          collection: 'media',
          data: { alt: `${name} headshot` },
          file: { data: buffer, mimetype: file.type || 'image/jpeg', name: file.name, size: buffer.length },
          overrideAccess: true,
        })
        headshotId = headshot.id
      }

      const speaker = await payload.create({
        collection: 'speakers',
        data: {
          name,
          role: role || undefined,
          company: company || undefined,
          bio: bio || undefined,
          headshot: headshotId,
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'events',
        id,
        data: { speakers: Array.from(new Set([...currentIds, speaker.id])) },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, speakerId: speaker.id })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to update speakers.' }, { status: 500 })
  }
}
