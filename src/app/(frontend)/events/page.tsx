import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'

import config from '@/payload.config'
import { CHANNELS } from '@/config/channels'

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
        <h1>Events</h1>
        <div className="card">
          {events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="excerpt-list-item">
              <h3>{e.name}</h3>
              <div className="excerpt-meta">
                {CHANNELS[e.channel].name} · {new Date(e.startsAt).toLocaleDateString()}
                {e.tagline ? ` · ${e.tagline}` : ''}
              </div>
            </Link>
          ))}
          {events.length === 0 && <p className="muted">No events yet.</p>}
        </div>
      </div>
    </>
  )
}
