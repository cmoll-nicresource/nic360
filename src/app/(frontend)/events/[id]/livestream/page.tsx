import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'

import config from '@/payload.config'
import { hasActiveRegistration } from '@/access/eventAccess'
import { detectVideoSource } from '@/lib/replayVideo'
import { LivestreamPresence } from '@/components/LivestreamPresence'

export const dynamic = 'force-dynamic'

export default async function LivestreamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const event = await payload.findByID({ collection: 'events', id, depth: 0, user, overrideAccess: false }).catch(() => null)
  if (!event) notFound()

  const isUser = !!user && 'collection' in user && user.collection === 'users'
  const canWatch = Boolean(event.hasLivestream) && isUser && (await hasActiveRegistration(payload, user, event.id))

  return (
    <>
      <SiteNav />
      <div className="page-wide">
        <p>
          <Link href={`/events/${event.id}`}>&larr; {event.name}</Link>
        </p>
        <h1>Livestream</h1>

        {!event.hasLivestream && <p className="muted">This event doesn&rsquo;t have a livestream.</p>}

        {event.hasLivestream && !canWatch && (
          <div className="locked-content">
            Sign in with a registered ticket for this event to watch.{' '}
            {!isUser && <Link href="/account">Sign in</Link>}
          </div>
        )}

        {canWatch &&
          (() => {
            const source = event.livestreamUrl ? detectVideoSource(event.livestreamUrl) : null
            if (!source) return <p className="muted">The livestream link hasn&rsquo;t been set up yet — check back soon.</p>

            return (
              <>
                <LivestreamPresence eventId={event.id} />
                {source.kind === 'vimeo' ? (
                  <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                    <iframe
                      src={`https://player.vimeo.com/video/${source.id}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 8 }}
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title="Event livestream"
                    />
                  </div>
                ) : (
                  <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                    <iframe
                      src={source.url}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 8 }}
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title="Event livestream"
                    />
                  </div>
                )}
              </>
            )
          })()}
      </div>
    </>
  )
}
