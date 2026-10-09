import Link from 'next/link'
import type { getPayload } from 'payload'
import React from 'react'

import { CHANNELS } from '@/config/channels'

/** Shown to a reader whose company has no active subscription: contact-us + a promoted upcoming event. */
export async function NoSubscriptionNotice({ payload }: { payload: Awaited<ReturnType<typeof getPayload>> }) {
  const { docs: events } = await payload.find({
    collection: 'events',
    where: { startsAt: { greater_than_equal: new Date().toISOString() } },
    sort: 'startsAt',
    limit: 1,
    overrideAccess: true,
  })
  const nextEvent = events[0]

  return (
    <>
      <div className="notice notice-info">
        <h3 style={{ marginTop: 0 }}>No active subscription yet</h3>
        <p>
          Your account is set up, but your company doesn&apos;t have an active Nicotine360
          subscription. Contact us to set one up — pricing is based on membership dues and scales
          with your company.
        </p>
        <p>
          <a className="btn" href="mailto:membership@nicotine360.org">
            Contact us about a subscription
          </a>
        </p>
      </div>

      {nextEvent && (
        <div className="notice notice-promo">
          <h3 style={{ marginTop: 0 }}>In the meantime: {CHANNELS[nextEvent.channel].name}</h3>
          <p>
            <strong>{nextEvent.name}</strong>
            {nextEvent.tagline ? ` — ${nextEvent.tagline}` : ''}
            <br />
            {new Date(nextEvent.startsAt).toLocaleDateString()}
            {nextEvent.venue?.address ? ` · ${nextEvent.venue.address}` : ''}
          </p>
          <p>
            Event tickets are sold individually and don&apos;t require a company subscription.
          </p>
          <p>
            <Link href={`/events/${nextEvent.id}`} className="btn">
              View {nextEvent.name} →
            </Link>
          </p>
        </div>
      )}
    </>
  )
}
