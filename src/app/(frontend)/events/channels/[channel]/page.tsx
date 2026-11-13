import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { EventCard, EventVisual, SectionHeading } from '@/components/frontend/Editorial'
import { SponsorMarquee } from '@/components/frontend/SponsorMarquee'
import { frontendContext } from '@/lib/frontendContext'
import { CHANNELS, isChannelKey } from '@/config/channels'
import { formatDate } from '@/lib/formatDate'
import { hasRichText, safeExternalUrl } from '@/lib/eventAgenda'
import { loadEventSponsors } from '@/lib/eventSponsors'
import { EventAudience, EventHighlights } from '@/components/frontend/EventExtras'
import { eventPath } from '@/lib/eventLinks'
import { hasAudience, hasHighlights } from '@/lib/eventMarketing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channel: string }>
}): Promise<Metadata> {
  const { channel: key } = await params
  if (!isChannelKey(key)) return { title: 'Events' }
  const channel = CHANNELS[key]
  return {
    title: channel.name,
    description: channel.summary,
    openGraph: { title: channel.fullName, description: channel.summary },
  }
}

/** The public home page for a forum: its next event, sponsors, background, and past events. */
export default async function ChannelHomePage({
  params,
}: {
  params: Promise<{ channel: string }>
}) {
  const { channel: key } = await params
  if (!isChannelKey(key)) notFound()
  const channel = CHANNELS[key]
  const { payload, now: requestTime } = await frontendContext()
  const { docs } = await payload.find({
    collection: 'events',
    where: { and: [{ channel: { equals: key } }, { _status: { equals: 'published' } }] },
    sort: 'startsAt',
    limit: 100,
    depth: 1,
    overrideAccess: false,
  })
  const now = Date.parse(requestTime)
  const upcoming = docs.filter((event) => new Date(event.endDate).getTime() >= now)
  const past = docs.filter((event) => new Date(event.endDate).getTime() < now).reverse()
  const next = upcoming[0]
  // Between events, keep thanking the sponsors of the one just held.
  const sponsors = await loadEventSponsors(payload, [(next ?? past[0])?.sponsors])
  const updatesUrl = safeExternalUrl(next?.updatesUrl)
  const partnerEvent = upcoming.find((event) => hasRichText(event.sponsorship))
  // The newest event that says who attends, and the latest past one with highlights.
  const audienceEvent = [...upcoming, ...past].find(hasAudience)
  const highlightsEvent = past.find(hasHighlights)

  return (
    <>
      <SiteNav />
      <div
        className="page-wide edition-channel"
        style={{ '--event-color': channel.brandColor } as CSSProperties}
      >
        <div className="breadcrumbs">
          <Link href="/events">Events</Link>
          <span>/</span>
          <span>{channel.name}</span>
        </div>
        <header className="edition-event-hero">
          <div>
            <p className="edition-eyebrow">
              {channel.name} / {channel.format === 'online' ? 'ONLINE SERIES' : 'INDUSTRY FORUM'}
            </p>
            <h1>{channel.fullName}</h1>
            <p className="edition-deck">{channel.summary}</p>
            {next ? (
              <>
                <p className="edition-event-date">
                  {next.name} · {formatDate(next.startsAt)} – {formatDate(next.endDate)}
                </p>
                {next.venue?.address && <p>{next.venue.address}</p>}
                <div className="edition-actions">
                  <Link href={eventPath(next)} className="btn btn-accent">
                    {next.ticketTypes?.length ? 'Agenda & registration' : 'Learn more'}
                  </Link>
                  {updatesUrl && (
                    <a
                      href={updatesUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                    >
                      Receive updates ↗
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="edition-event-date">
                Dates for the next {channel.name} will be announced here.
              </p>
            )}
          </div>
          {next && <EventVisual event={next} eager />}
        </header>
        <SponsorMarquee sponsors={sponsors} />
        {!!channel.about.length && (
          <section id="about" className="edition-section edition-channel-about">
            <SectionHeading eyebrow="ABOUT" title={`What is ${channel.name}?`} />
            <div className="edition-prose">
              {channel.about.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {!!channel.hostHistory?.length && (
              <details className="edition-channel-history">
                <summary>Where {channel.name} has been held</summary>
                <ul>
                  {channel.hostHistory.map((place) => (
                    <li key={place}>{place}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
        {audienceEvent && (
          <section id="audience" className="edition-section edition-channel-about">
            <SectionHeading eyebrow="IN THE ROOM" title={`Who attends ${channel.name}`} />
            <EventAudience event={audienceEvent} />
          </section>
        )}
        <section className="edition-section">
          <SectionHeading eyebrow="ON THE CALENDAR" title="Upcoming" />
          {upcoming.length ? (
            <div className="edition-event-grid">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="edition-empty">The next {channel.name} will be announced here.</div>
          )}
        </section>
        {highlightsEvent && (
          <section id="highlights" className="edition-section">
            <SectionHeading eyebrow="LAST TIME" title={`Highlights from ${highlightsEvent.name}`} />
            <EventHighlights event={highlightsEvent} />
          </section>
        )}
        {!!past.length && (
          <section className="edition-section">
            <SectionHeading eyebrow="THE ARCHIVE" title={`Past ${channel.name} events`} />
            <div className="edition-past-events">
              {past.map((event) => (
                <Link href={eventPath(event)} key={event.id}>
                  <span className="edition-meta">{formatDate(event.startsAt)}</span>
                  <h3>{event.name}</h3>
                  <span>
                    {event.venue?.address || 'Online'}
                    {event.hasReplay ? ' · Attendee replays' : ''} ↗
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <section className="edition-section edition-channel-contact">
          <div>
            <p className="edition-eyebrow">PARTNER WITH US</p>
            <h2>Put your organisation in the room.</h2>
            <p>
              Sponsors help bring {channel.name} to its delegates and are recognised across the
              programme, the website and the event itself.
            </p>
            {partnerEvent ? (
              <Link href={`${eventPath(partnerEvent)}#partners`} className="btn btn-secondary">
                {partnerEvent.name} sponsorship
              </Link>
            ) : (
              <a
                href={`mailto:${channel.contactEmail}?subject=${encodeURIComponent(`${channel.name} sponsorship enquiry`)}`}
                className="btn btn-secondary"
              >
                Ask about sponsorship
              </a>
            )}
          </div>
          <div>
            <p className="edition-eyebrow">CONTACT</p>
            <h2>Talk to the team.</h2>
            <p>
              General enquiries:{' '}
              <a href={`mailto:${channel.contactEmail}`}>{channel.contactEmail}</a>
            </p>
            {channel.mediaEmail && (
              <p>
                Media enquiries: <a href={`mailto:${channel.mediaEmail}`}>{channel.mediaEmail}</a>
              </p>
            )}
            {!!channel.social?.length && (
              <p className="edition-channel-social">
                {channel.social.map((link) => (
                  <a href={link.url} target="_blank" rel="noreferrer" key={link.url}>
                    {link.label} ↗
                  </a>
                ))}
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
