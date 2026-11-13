import { getPayload } from 'payload'

import config from '@/payload.config'
import { SITE_URL } from '@/lib/env'
import { eventCalendarWindow, eventIcs } from '@/lib/eventCalendar'
import { eventPath, eventWhere } from '@/lib/eventLinks'

export const dynamic = 'force-dynamic'

/** Public calendar file for a published event. Holds nothing a visitor can't see on the event page. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'events',
    where: { and: [eventWhere(id), { _status: { equals: 'published' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: false,
  })
  const event = docs[0]
  if (!event) return new Response('Not found', { status: 404 })
  const { docs: sessions } = await payload.find({
    collection: 'sessions',
    where: { and: [{ event: { equals: event.id } }, { _status: { equals: 'published' } }] },
    limit: 200,
    depth: 0,
    overrideAccess: false,
  })
  const body = eventIcs({
    uid: `event-${event.id}@nicotine360.org`,
    title: event.name,
    window: eventCalendarWindow(event, sessions),
    location: event.venue?.address,
    description: event.tagline,
    url: new URL(eventPath(event), SITE_URL).toString(),
    stamp: new Date(),
  })
  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${event.slug || `event-${event.id}`}.ics"`,
      'cache-control': 'no-store',
    },
  })
}
