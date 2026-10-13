import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { lexicalFromText } from '@/lib/lexical'

/** Attach, detach or create+attach a Sponsor for this event's `sponsors` field — the single screen's "one-click" sponsor actions. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')

    const event = await payload.findByID({ collection: 'events', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    const form = await request.formData()
    const action = form.get('action')
    const currentIds = (event.sponsors ?? []).map((s) => (typeof s === 'object' ? s.id : s))

    if (action === 'attach' || action === 'detach') {
      const sponsorId = Number(form.get('sponsorId'))
      if (!sponsorId) return NextResponse.json({ error: 'sponsorId is required.' }, { status: 400 })

      const nextIds =
        action === 'attach' ? Array.from(new Set([...currentIds, sponsorId])) : currentIds.filter((s) => s !== sponsorId)

      await payload.update({ collection: 'events', id, data: { sponsors: nextIds }, overrideAccess: true })
      return NextResponse.json({ ok: true })
    }

    if (action === 'create') {
      const name = String(form.get('name') || '').trim()
      const website = String(form.get('website') || '').trim()
      const description = String(form.get('description') || '').trim()
      const file = form.get('logo')
      if (!name) return NextResponse.json({ error: 'Company name is required.' }, { status: 400 })
      if (!description) return NextResponse.json({ error: 'A short description is required.' }, { status: 400 })
      if (!(file instanceof File)) return NextResponse.json({ error: 'A logo image is required.' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const logo = await payload.create({
        collection: 'media',
        data: { alt: `${name} logo` },
        file: { data: buffer, mimetype: file.type || 'image/png', name: file.name, size: buffer.length },
        overrideAccess: true,
      })

      const sponsor = await payload.create({
        collection: 'sponsors',
        data: {
          name,
          website: website || undefined,
          description: lexicalFromText(description),
          logo: logo.id,
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'events',
        id,
        data: { sponsors: Array.from(new Set([...currentIds, sponsor.id])) },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, sponsorId: sponsor.id })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to update sponsors.' }, { status: 500 })
  }
}
