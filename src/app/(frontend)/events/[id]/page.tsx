import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { CHANNELS } from '@/config/channels'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { hasActiveRegistration } from '@/access/eventAccess'
import { EventCheckoutForm } from '@/components/EventCheckoutForm'

export const dynamic = 'force-dynamic'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const event = await payload.findByID({ collection: 'events', id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!event) notFound()

  const isReader = !!user && 'collection' in user && user.collection === 'users'
  const plan = isReader ? await getReaderPlan(user, payload) : 'none'
  const isSubscriber = planSatisfies(plan, 'base')
  const canSeeReplay = Boolean(event.hasReplay) && isReader && (await hasActiveRegistration(payload, user, event.id))

  const { docs: sessions } = await payload.find({
    collection: 'sessions',
    where: { event: { equals: event.id } },
    sort: 'day',
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })

  const channel = CHANNELS[event.channel]

  return (
    <>
      <nav className="topnav">
        <Link href="/">Nicotine360</Link>
        <Link href="/articles">Articles</Link>
        <Link href="/datasets">Data</Link>
        <Link href="/guides">Guides</Link>
        <Link href="/publications">Publications</Link>
        <Link href="/events">Events</Link>
      </nav>
      <div className="page">
        <p>
          <Link href="/events">&larr; All events</Link>
        </p>
        <h1>{event.name}</h1>
        <p className="excerpt-meta">
          {channel.name} · {new Date(event.startsAt).toLocaleDateString()} &ndash;{' '}
          {new Date(event.endDate).toLocaleDateString()}
          {event.venue?.address ? ` · ${event.venue.address}` : ''}
        </p>
        {event.tagline && <p className="muted">{event.tagline}</p>}

        {event.description && (
          <div className="card">
            <RichText data={event.description} />
          </div>
        )}

        <div className="card">
          <h2>Tickets</h2>
          {isReader ? (
            <EventCheckoutForm
              eventId={String(event.id)}
              ticketTypes={event.ticketTypes ?? []}
              isSubscriber={isSubscriber}
              buyerName={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()}
              buyerEmail={'email' in user ? (user.email as string) : ''}
            />
          ) : (
            <p className="muted">
              <Link href="/account">Sign in</Link> to buy tickets.
            </p>
          )}
        </div>

        <div className="card">
          <h2>Agenda</h2>
          {sessions.length === 0 && <p className="muted">Agenda not yet published.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="excerpt-list-item">
              <h3>{s.title}</h3>
              <div className="excerpt-meta">
                {new Date(s.day).toLocaleDateString()} · {s.type}
                {s.room ? ` · ${s.room}` : ''}
              </div>
              {s.description && <p>{s.description}</p>}
              {s.speakers && s.speakers.length > 0 && (
                <p className="excerpt-meta">
                  Speakers:{' '}
                  {s.speakers.map((sp) => (typeof sp === 'object' ? sp.name : sp)).join(', ')}
                </p>
              )}
              {event.hasReplay &&
                (canSeeReplay && s.replayEmbed ? (
                  <div
                    className="locked-content"
                    style={{ borderStyle: 'solid' }}
                    dangerouslySetInnerHTML={{ __html: s.replayEmbed }}
                  />
                ) : (
                  <p className="muted">Replay available to registered attendees.</p>
                ))}
            </div>
          ))}
        </div>

        {event.sponsors && event.sponsors.length > 0 && (
          <div className="card">
            <h2>Sponsors</h2>
            {event.sponsors.map((sp) => (typeof sp === 'object' ? <p key={sp.id}>{sp.name}</p> : null))}
          </div>
        )}
      </div>
    </>
  )
}
