'use client'

import { useEffect } from 'react'

// Pings while the tab is open, not just while visible — a livestream keeps
// playing (audio included) in a background tab, so gating on visibility
// would undercount genuine attendance. Granular enough to match against
// session time-blocks (usually 30+ minutes) without spamming the DB over a
// multi-hour stream.
const PING_INTERVAL_MS = 2 * 60 * 1000

/** Pings /api/events/[id]/livestream-ping every 2 minutes while this page is open, for the attendee report's session-matching — see docs/entity-map.md's "Livestream attendance" section. Renders nothing. */
export function LivestreamPresence({ eventId }: { eventId: number }) {
  useEffect(() => {
    const url = `/api/events/${eventId}/livestream-ping`
    const ping = () => {
      fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
    }

    ping()
    const interval = setInterval(ping, PING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [eventId])

  return null
}
