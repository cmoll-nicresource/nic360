import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { ScheduleIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { CHANNELS } from '@/config/channels'
import { formatDate } from '@/lib/formatDate'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const { docs: events } = await payload.find({
    collection: 'events',
    sort: 'startsAt',
    limit: 100,
    overrideAccess: true,
  })

  const now = Date.now()
  const upcoming = events.filter((e) => new Date(e.endDate).getTime() >= now)
  const past = events.filter((e) => new Date(e.endDate).getTime() < now).reverse()

  return (
    <>
      <SiteNav />
      <div className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="header-band-eyebrow">Organization</p>
            <h1 className="page-heading">
              <span className="icon-badge">
                <ScheduleIcon />
              </span>
              Events
            </h1>
            <p>Conferences and webinars across our channels.</p>
          </div>
        </div>
      </div>
      <div className="page">
        <h2>Upcoming</h2>
        {upcoming.length === 0 && <p className="muted">No upcoming events scheduled.</p>}
        <div className="teaser-grid" style={{ marginBottom: 40 }}>
          {upcoming.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="teaser-card event-teaser-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://placehold.co/480x240/${CHANNELS[e.channel].brandColor.replace('#', '')}/ffffff?text=${encodeURIComponent(CHANNELS[e.channel].name)}`}
                alt=""
                role="presentation"
                className="event-teaser-image"
              />
              <div style={{ padding: 16 }}>
                <span className="badge" style={{ background: `${CHANNELS[e.channel].brandColor}1a`, color: CHANNELS[e.channel].brandColor }}>
                  {CHANNELS[e.channel].name}
                </span>
                <h3>{e.name}</h3>
                <p className="muted">
                  {formatDate(e.startsAt)}
                  {e.venue?.address ? ` · ${e.venue.address}` : ''}
                </p>
                <span className="btn" style={{ marginTop: 8 }}>
                  Get tickets
                </span>
              </div>
            </Link>
          ))}
        </div>

        {past.length > 0 && (
          <>
            <h2>Past events</h2>
            <div className="card">
              {past.map((e) => (
                <Link key={e.id} href={`/events/${e.id}`} className="excerpt-list-item">
                  <h3>{e.name}</h3>
                  <div className="excerpt-meta">
                    {CHANNELS[e.channel].name}
                    <span className="dot">·</span>
                    {formatDate(e.startsAt)}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
