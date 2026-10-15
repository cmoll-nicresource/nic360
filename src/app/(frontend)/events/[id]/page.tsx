import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { SiteNav } from '@/components/SiteNav'
import { EventVisual, SectionHeading } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { CHANNELS } from '@/config/channels'
import { hasActiveRegistration } from '@/access/eventAccess'
import { EventCheckoutForm } from '@/components/EventCheckoutForm'
import { formatDate } from '@/lib/formatDate'
export const dynamic = 'force-dynamic'
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user, canRead, now } = await frontendContext()
  const { docs } = await payload.find({
    collection: 'events',
    where: { and: [{ id: { equals: id } }, { _status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
    user,
    overrideAccess: false,
  })
  const event = docs[0]
  if (!event) notFound()
  const isReader = user?.collection === 'users'
  const registered = isReader && (await hasActiveRegistration(payload, user, event.id))
  const { docs: sessions } = await payload.find({
    collection: 'sessions',
    where: { and: [{ event: { equals: event.id } }, { _status: { equals: 'published' } }] },
    sort: 'day',
    limit: 200,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const channel = CHANNELS[event.channel]
  const past = new Date(event.endDate).getTime() < Date.parse(now)
  const onSale = !past && event.ticketTypes?.some((t) => t.onSale)
  return (
    <>
      <SiteNav />
      <div className="page-wide">
        <div className="breadcrumbs">
          <Link href="/events">Events</Link>
          <span>/</span>
          <span>{event.name}</span>
        </div>
        <header className="edition-event-hero">
          <div>
            <p className="edition-eyebrow">
              {channel.name} / {channel.format === 'online' ? 'ONLINE EVENT' : 'INDUSTRY FORUM'}
            </p>
            <h1>{event.name}</h1>
            {event.tagline && <p className="edition-deck">{event.tagline}</p>}
            <p className="edition-event-date">
              {formatDate(event.startsAt)} – {formatDate(event.endDate)}
            </p>
            {event.venue?.address && <p>{event.venue.address}</p>}
            <div className="edition-actions">
              {onSale && (
                <a href="#tickets" className="btn btn-accent">
                  {registered ? 'View registration options' : 'Registration & tickets'}
                </a>
              )}
              <a href="#agenda" className="btn btn-secondary">
                {past ? 'Explore the sessions' : 'View the agenda'} ↓
              </a>
            </div>
          </div>
          <EventVisual event={event} eager />
        </header>
        <nav className="edition-shortcuts" aria-label="Event sections">
          <a href="#about">About ↓</a>
          <a href="#agenda">Agenda ↓</a>
          {!!event.speakers?.length && <a href="#speakers">Speakers ↓</a>}
          {event.venue?.address && <a href="#venue">Venue ↓</a>}
          <a href="#tickets">{past ? 'Attendee access' : 'Registration'} ↓</a>
        </nav>
        <div className="edition-event-layout">
          <div>
            {event.description && (
              <section id="about" className="edition-event-section">
                <SectionHeading eyebrow="THE CONVERSATION" title="About the event" />
                <div className="edition-prose">
                  <RichText data={event.description} />
                </div>
              </section>
            )}
            <section id="agenda" className="edition-event-section">
              <SectionHeading eyebrow="THE PROGRAMME" title="Agenda" />
              {!sessions.length && (
                <p className="muted">
                  The programme is being developed. Check back for the latest sessions and speakers.
                </p>
              )}
              {sessions.map((session) => (
                <article className="edition-session" key={session.id}>
                  <div className="edition-session-date">
                    {formatDate(session.day)}
                    <span>
                      {session.type}
                      {session.room ? ` · ${session.room}` : ''}
                    </span>
                  </div>
                  <div>
                    <h3>{session.title}</h3>
                    {session.description && <p>{session.description}</p>}
                    {!!session.speakers?.length && (
                      <p className="edition-meta">
                        {session.speakers
                          .map((s) => (typeof s === 'object' ? s.name : ''))
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {event.hasReplay &&
                      (registered && session.replayEmbed ? (
                        <div
                          className="edition-replay"
                          dangerouslySetInnerHTML={{ __html: session.replayEmbed }}
                        />
                      ) : (
                        <p className="edition-meta">
                          Session replays are available to registered attendees.
                        </p>
                      ))}
                  </div>
                </article>
              ))}
            </section>
            {!!event.speakers?.length && (
              <section id="speakers" className="edition-event-section">
                <SectionHeading eyebrow="THE PEOPLE" title="Speakers" />
                <div className="edition-speaker-grid">
                  {event.speakers.map((speaker) => {
                    if (typeof speaker !== 'object') return null
                    const image = typeof speaker.headshot === 'object' ? speaker.headshot : null
                    return (
                      <article key={speaker.id}>
                        {image?.url ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image.url} alt="" />
                          </>
                        ) : (
                          <div className="edition-speaker-initials" aria-hidden="true">
                            {speaker.name
                              .split(' ')
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                        )}
                        <h3>{speaker.name}</h3>
                        <p className="edition-meta">
                          {[speaker.role, speaker.company].filter(Boolean).join(' · ')}
                        </p>
                        {speaker.bio && <p>{speaker.bio}</p>}
                      </article>
                    )
                  })}
                </div>
              </section>
            )}
            {event.venue?.address && (
              <section id="venue" className="edition-event-section">
                <SectionHeading eyebrow="THE LOCATION" title={event.venue.address} />
                {event.venue.description && <RichText data={event.venue.description} />}
                {event.accommodation?.description && (
                  <RichText data={event.accommodation.description} />
                )}
                {event.accommodation?.bookingUrl && (
                  <a
                    href={event.accommodation.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                  >
                    Accommodation & booking ↗
                  </a>
                )}
              </section>
            )}
            {!!event.sponsors?.length && (
              <section className="edition-event-section">
                <SectionHeading eyebrow="WITH THANKS" title="Our sponsors" />
                <div className="edition-sponsor-grid">
                  {event.sponsors.map((sponsor) => {
                    if (typeof sponsor !== 'object') return null
                    const logo = typeof sponsor.logo === 'object' ? sponsor.logo : null
                    return (
                      <div key={sponsor.id}>
                        {logo?.url ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logo.url} alt={sponsor.name} />
                          </>
                        ) : (
                          <strong>{sponsor.name}</strong>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
          <aside className="edition-event-registration" id="tickets">
            <p className="edition-eyebrow">{past ? 'ATTENDEE ACCESS' : 'JOIN THE CONVERSATION'}</p>
            <h2>
              {registered
                ? 'You’re registered.'
                : past
                  ? 'The conversation continues.'
                  : 'Plan your visit.'}
            </h2>
            <p>
              {formatDate(event.startsAt)}
              {event.venue?.address ? ` · ${event.venue.address}` : ''}
            </p>
            {event.hasLivestream &&
              (registered ? (
                <Link href={`/events/${event.id}/livestream`} className="btn">
                  Watch the livestream ↗
                </Link>
              ) : (
                <p className="edition-meta">
                  Livestream access is available to registered attendees.
                </p>
              ))}
            {past ? (
              <p className="muted">
                {event.hasReplay
                  ? 'Sign in with your registered attendee account to access available session replays.'
                  : 'Registration for this event has closed.'}
              </p>
            ) : onSale && isReader ? (
              <EventCheckoutForm
                eventId={String(event.id)}
                ticketTypes={event.ticketTypes ?? []}
                isSubscriber={canRead}
                buyerName={`${user.firstName || ''} ${user.lastName || ''}`.trim()}
                buyerEmail={user.email || ''}
              />
            ) : onSale ? (
              <>
                <p>Sign in or create an account to choose your ticket.</p>
                <Link className="btn" href="/login">
                  Sign in to register
                </Link>
              </>
            ) : (
              <p className="muted">
                Registration details will be announced here.{' '}
                <a href={`mailto:${channel.contactEmail}`}>Contact the event team</a> for updates.
              </p>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}
