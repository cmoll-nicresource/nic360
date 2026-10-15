import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { EventCard, SectionHeading } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { CHANNELS } from '@/config/channels'
import { formatDate } from '@/lib/formatDate'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Events',
  description: 'Conversations and connections across the nicotine industry.',
}
export default async function EventsPage() {
  const { payload, now: requestTime } = await frontendContext()
  const { docs } = await payload.find({
    collection: 'events',
    where: { _status: { equals: 'published' } },
    sort: 'startsAt',
    limit: 100,
    depth: 1,
    overrideAccess: false,
  })
  const now = Date.parse(requestTime)
  const upcoming = docs.filter((e) => new Date(e.endDate).getTime() >= now)
  const past = docs.filter((e) => new Date(e.endDate).getTime() < now).reverse()
  return (
    <>
      <SiteNav />
      <header className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="edition-eyebrow">CONVERSATIONS & CONNECTIONS</p>
            <h1>Meet the industry.</h1>
            <p>
              Join the people shaping the future of nicotine and tobacco. Conferences, forums and
              online conversations, open to everyone.
            </p>
          </div>
        </div>
      </header>
      <div className="page-wide">
        <SectionHeading eyebrow="ON THE CALENDAR" title="Upcoming events" />
        <div className="edition-event-grid">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        {!upcoming.length && (
          <div className="edition-empty">Our next events will be announced here.</div>
        )}
        {!!past.length && (
          <section className="edition-section">
            <SectionHeading eyebrow="THE ARCHIVE" title="Past conversations" />
            <div className="edition-past-events">
              {past.map((event) => (
                <Link href={`/events/${event.id}`} key={event.id}>
                  <span className="edition-meta">{formatDate(event.startsAt)}</span>
                  <h3>{event.name}</h3>
                  <span>
                    {CHANNELS[event.channel].name}
                    {event.hasReplay ? ' · Attendee replays' : ''} ↗
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
