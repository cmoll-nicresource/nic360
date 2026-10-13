import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { hasActiveRegistration } from '@/access/eventAccess'
import { recordLivestreamPing } from '@/lib/livestreamPings'

/**
 * Called periodically by LivestreamPresence while a registered attendee has
 * the event's livestream page open — see docs/entity-map.md's "Livestream
 * attendance" section. No duration/position in the body; each ping is just
 * "this attendee had the tab open at this moment."
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const payload = await getPayload({ config: await config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user || user.collection !== 'users') {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }

    const event = await payload.findByID({ collection: 'events', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!event?.hasLivestream) return NextResponse.json({ error: 'Livestream not available for this event.' }, { status: 403 })

    const registered = await hasActiveRegistration(payload, user, event.id)
    if (!registered) return NextResponse.json({ error: 'Not registered for this event.' }, { status: 403 })

    await recordLivestreamPing(payload, event.id, user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to record ping.' }, { status: 500 })
  }
}
