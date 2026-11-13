import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { SiteNav } from '@/components/SiteNav'
import { EventVisual, SectionHeading } from '@/components/frontend/Editorial'
import { EventAgenda } from '@/components/frontend/EventAgenda'
import { SponsorMarquee } from '@/components/frontend/SponsorMarquee'
import {
  AddToCalendar,
  EventAudience,
  EventFaq,
  EventHighlights,
  EventKeyDates,
} from '@/components/frontend/EventExtras'
import { SITE_URL } from '@/lib/env'
import { eventCalendarWindow, googleCalendarUrl } from '@/lib/eventCalendar'
import { eventPath, eventWhere, isEventId } from '@/lib/eventLinks'
import {
  eventStructuredData,
  faqEntries,
  hasAudience,
  hasHighlights,
  jsonLdScript,
  keyDates,
} from '@/lib/eventMarketing'
import { frontendContext } from '@/lib/frontendContext'
import { CHANNELS } from '@/config/channels'
import { hasActiveRegistration } from '@/access/eventAccess'
import { EventCheckoutForm } from '@/components/EventCheckoutForm'
import { EventTicketPrices } from '@/components/EventTicketPrices'
import { formatDate } from '@/lib/formatDate'
import { hasArtwork } from '@/lib/editorial'
import {
  agendaView,
  eventSpeakers,
  groupSessionsByDay,
  hasRichText,
  mapSearchUrl,
  safeExternalUrl,
  uniqueSponsors,
} from '@/lib/eventAgenda'

export const dynamic = 'force-dynamic'

/** One lookup shared by the page and its metadata. Takes the slug or the record id. */
const publishedEvent = cache(async (id: string) => {
  const { payload, user } = await frontendContext()
  const { docs } = await payload.find({
    collection: 'events',
    where: { and: [eventWhere(id), { _status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
    user,
    overrideAccess: false,
  })
  return docs[0]
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const event = await publishedEvent(id).catch(() => null)
  if (!event) return { title: 'Event' }
  const channel = CHANNELS[event.channel]
  const where = event.venue?.address ? `, ${event.venue.address}` : ''
  const description = `${event.tagline || channel.summary} ${formatDate(event.startsAt)} – ${formatDate(event.endDate)}${where}.`
  const image = typeof event.image === 'object' ? event.image : null
  return {
    title: event.name,
    description,
    alternates: { canonical: eventPath(event) },
    openGraph: {
      title: event.name,
      description,
      ...(hasArtwork(image) ? { images: [{ url: image.url }] } : {}),
    },
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user, plan, now } = await frontendContext()
  const event = await publishedEvent(id)
  if (!event) notFound()
  // Links that still use the record id are sent on to the readable address.
  if (isEventId(id) && event.slug) redirect(eventPath(event))
  const isUser = user?.collection === 'users'
  const registered = isUser && (await hasActiveRegistration(payload, user, event.id))
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
  const registrationAvailable = !past && !!event.ticketTypes?.length

  const view = agendaView(event, sessions.length)
  const agendaDays = view === 'sessions' ? groupSessionsByDay(sessions, event.days) : []
  const speakers = eventSpeakers(event.speakers, view === 'sessions' ? sessions : [])
  const sponsors = uniqueSponsors([event.sponsors])
  const updatesUrl = past ? null : safeExternalUrl(event.updatesUrl)
  const bookingUrl = safeExternalUrl(event.accommodation?.bookingUrl)
  const hasVenue =
    !!event.venue?.address ||
    hasRichText(event.venue?.description) ||
    hasRichText(event.venue?.transportation)
  const hasStay =
    hasRichText(event.accommodation?.description) ||
    !!bookingUrl ||
    !!event.accommodation?.phone ||
    !!event.accommodation?.email
  const hasPartner = !past && hasRichText(event.sponsorship)
  const ownHighlights = past && hasHighlights(event)
  // Before an event, look back at the last one in the same forum that has highlights.
  const previous = past
    ? undefined
    : (
        await payload.find({
          collection: 'events',
          where: {
            and: [
              { channel: { equals: event.channel } },
              { _status: { equals: 'published' } },
              { endDate: { less_than: event.startsAt } },
            ],
          },
          sort: '-startsAt',
          limit: 5,
          depth: 1,
          user,
          overrideAccess: false,
        })
      ).docs.find(hasHighlights)
  const highlightsEvent = ownHighlights ? event : previous
  const questions = faqEntries(event)
  const dates = past ? [] : keyDates(event, now)
  const pageUrl = new URL(eventPath(event), SITE_URL).toString()
  const calendarWindow = eventCalendarWindow(event, sessions)
  const heroImage = typeof event.image === 'object' ? event.image : null
  const structuredData = eventStructuredData({
    event,
    channel,
    url: pageUrl,
    siteUrl: SITE_URL,
    window: calendarWindow,
    imageUrl: hasArtwork(heroImage) ? heroImage.url : null,
    speakers,
    includeOffers: registrationAvailable,
  })
  const agendaLabel = past
    ? 'Explore the sessions'
    : view === 'draft'
      ? 'View the draft agenda'
      : 'View the agenda'

  return (
    <>
      <SiteNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }}
      />
      <div className="page-wide">
        <div className="breadcrumbs">
          <Link href="/events">Events</Link>
          <span>/</span>
          <Link href={channel.homepagePath}>{channel.name}</Link>
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
              {registrationAvailable && (
                <a href="#tickets" className="btn btn-accent">
                  {registered ? 'View registration options' : 'Registration & tickets'}
                </a>
              )}
              <a href="#agenda" className="btn btn-secondary">
                {agendaLabel} ↓
              </a>
              {updatesUrl && (
                <a href={updatesUrl} target="_blank" rel="noreferrer" className="edition-text-link">
                  Receive updates ↗
                </a>
              )}
            </div>
          </div>
          <EventVisual event={event} eager />
        </header>
        <SponsorMarquee sponsors={sponsors} />
        <nav className="edition-shortcuts" aria-label="Event sections">
          {hasRichText(event.description) && <a href="#about">About ↓</a>}
          {hasAudience(event) && <a href="#audience">Who attends ↓</a>}
          <a href="#agenda">Agenda ↓</a>
          {!!speakers.length && <a href="#speakers">Speakers ↓</a>}
          {(hasVenue || hasStay) && <a href="#venue">Venue &amp; travel ↓</a>}
          {!!questions.length && <a href="#faq">Practical information ↓</a>}
          {highlightsEvent && <a href="#highlights">Highlights ↓</a>}
          {hasPartner && <a href="#partners">Partner with us ↓</a>}
          <a href="#tickets">{past ? 'Attendee access' : 'Registration'} ↓</a>
        </nav>
        <div className="edition-event-layout">
          <div>
            {hasRichText(event.description) && (
              <section id="about" className="edition-event-section">
                <SectionHeading eyebrow="THE CONVERSATION" title="About the event" />
                <div className="edition-prose">
                  <RichText data={event.description!} />
                </div>
              </section>
            )}
            {hasAudience(event) && (
              <section id="audience" className="edition-event-section">
                <SectionHeading eyebrow="IN THE ROOM" title="Who attends" />
                <EventAudience event={event} />
              </section>
            )}
            <section id="agenda" className="edition-event-section">
              <SectionHeading
                eyebrow="THE PROGRAMME"
                title={view === 'draft' ? 'Draft agenda' : 'Agenda'}
              />
              {view === 'empty' && (
                <p className="muted">
                  The programme is being developed. Check back for the latest sessions and speakers.
                </p>
              )}
              {view === 'draft' && (
                <>
                  <p className="edition-draft-note">
                    <strong>Draft programme, subject to change.</strong> Sessions, speakers and
                    timings will be confirmed here as they are finalised. Last updated{' '}
                    {formatDate(event.updatedAt)}.
                  </p>
                  <div className="edition-prose edition-draft-agenda">
                    <RichText data={event.draftAgenda!} />
                  </div>
                </>
              )}
              {view === 'sessions' && (
                <EventAgenda
                  days={agendaDays}
                  event={event}
                  registered={!!registered}
                  speakerIds={new Set(speakers.map((speaker) => speaker.id))}
                />
              )}
            </section>
            {!!speakers.length && (
              <section id="speakers" className="edition-event-section">
                <SectionHeading
                  eyebrow="THE PEOPLE"
                  title={past ? 'Speakers' : 'Confirmed speakers'}
                />
                <div className="edition-speaker-grid">
                  {speakers.map((speaker) => {
                    const image = typeof speaker.headshot === 'object' ? speaker.headshot : null
                    return (
                      <article key={speaker.id} id={`speaker-${speaker.id}`}>
                        {hasArtwork(image) ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image.url} alt="" loading="lazy" />
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
                        {speaker.bio && (
                          <details>
                            <summary>Biography</summary>
                            <p>{speaker.bio}</p>
                          </details>
                        )}
                      </article>
                    )
                  })}
                </div>
                {!past && (
                  <p className="edition-meta edition-speaker-more">
                    More speakers will be announced as they are confirmed.
                  </p>
                )}
              </section>
            )}
            {(hasVenue || hasStay) && (
              <section id="venue" className="edition-event-section">
                <SectionHeading
                  eyebrow="VENUE & TRAVEL"
                  title={event.venue?.address || 'Venue and travel'}
                />
                {hasRichText(event.venue?.description) && (
                  <div className="edition-prose">
                    <RichText data={event.venue!.description!} />
                  </div>
                )}
                {event.venue?.address && (
                  <p>
                    <a
                      href={mapSearchUrl(event.venue.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="edition-text-link"
                    >
                      Open in maps ↗
                    </a>
                  </p>
                )}
                {hasRichText(event.venue?.transportation) && (
                  <div className="edition-travel-block">
                    <h3>Getting there</h3>
                    <div className="edition-prose">
                      <RichText data={event.venue!.transportation!} />
                    </div>
                  </div>
                )}
                {hasStay && (
                  <div className="edition-travel-block">
                    <h3>Where to stay</h3>
                    {hasRichText(event.accommodation?.description) && (
                      <div className="edition-prose">
                        <RichText data={event.accommodation!.description!} />
                      </div>
                    )}
                    {(event.accommodation?.phone || event.accommodation?.email) && (
                      <p className="edition-meta">
                        Hotel reservations:{' '}
                        {event.accommodation?.phone && (
                          <a href={`tel:${event.accommodation.phone.replace(/[^\d+]/g, '')}`}>
                            {event.accommodation.phone}
                          </a>
                        )}
                        {event.accommodation?.phone && event.accommodation?.email && ' · '}
                        {event.accommodation?.email && (
                          <a href={`mailto:${event.accommodation.email}`}>
                            {event.accommodation.email}
                          </a>
                        )}
                      </p>
                    )}
                    {bookingUrl && (
                      <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                      >
                        Book accommodation ↗
                      </a>
                    )}
                  </div>
                )}
              </section>
            )}
            {!!questions.length && (
              <section id="faq" className="edition-event-section">
                <SectionHeading eyebrow="GOOD TO KNOW" title="Practical information" />
                <EventFaq event={event} />
              </section>
            )}
            {highlightsEvent && (
              <section id="highlights" className="edition-event-section">
                <SectionHeading
                  eyebrow={ownHighlights ? 'LOOKING BACK' : 'LAST TIME'}
                  title={ownHighlights ? 'Highlights' : `Highlights from ${highlightsEvent.name}`}
                />
                <EventHighlights event={highlightsEvent} />
                {!ownHighlights && (
                  <p className="edition-speaker-more">
                    <Link href={eventPath(highlightsEvent)} className="edition-text-link">
                      More about {highlightsEvent.name} ↗
                    </Link>
                  </p>
                )}
              </section>
            )}
            {!!sponsors.length && (
              <section id="sponsors" className="edition-event-section">
                <SectionHeading eyebrow="WITH THANKS" title="Our sponsors" />
                <div className="edition-sponsor-grid">
                  {sponsors.map((sponsor) => {
                    const logo = typeof sponsor.logo === 'object' ? sponsor.logo : null
                    return (
                      <div key={sponsor.id}>
                        {hasArtwork(logo) ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logo.url} alt={sponsor.name} loading="lazy" />
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
            {hasPartner && (
              <section id="partners" className="edition-event-section">
                <SectionHeading eyebrow="SPONSORSHIP" title="Partner with us" />
                <div className="edition-prose">
                  <RichText data={event.sponsorship!} />
                </div>
                <a
                  href={`mailto:${channel.contactEmail}?subject=${encodeURIComponent(`${event.name} sponsorship enquiry`)}`}
                  className="btn btn-secondary"
                >
                  Ask about sponsorship
                </a>
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
            {!past && (
              <AddToCalendar
                icsPath={eventPath(event, 'calendar.ics')}
                googleUrl={googleCalendarUrl({
                  title: event.name,
                  window: calendarWindow,
                  location: event.venue?.address,
                  description: event.tagline,
                  url: pageUrl,
                })}
              />
            )}
            <EventKeyDates dates={dates} />
            {!past && <EventTicketPrices ticketTypes={event.ticketTypes ?? []} />}
            {event.hasLivestream &&
              (registered ? (
                <Link href={eventPath(event, 'livestream')} className="btn">
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
            ) : registrationAvailable && isUser ? (
              <EventCheckoutForm
                eventId={String(event.id)}
                ticketTypes={event.ticketTypes ?? []}
                isSubscriber={plan === 'base' || plan === 'premium'}
                buyerName={`${user.firstName || ''} ${user.lastName || ''}`.trim()}
                buyerEmail={user.email || ''}
              />
            ) : registrationAvailable ? (
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
