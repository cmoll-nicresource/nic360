import type { Payload } from 'payload'

import { sessionInstant } from '@/lib/sessionTime'

// Matches LivestreamPresence's client-side ping interval — pingCount *
// PING_INTERVAL_MINUTES is the estimate of minutes an attendee had the
// livestream page open, assuming roughly continuous pinging. We don't try
// to track actual video playback (no SDK, no duration) since the stream is
// entirely Vimeo-hosted; this is presence-over-time, correlated against the
// session schedule after the fact.
export const PING_INTERVAL_MINUTES = 2

export type SessionTimeInfo = {
  id: number
  title: string
  day: string
  startTime?: string | null
  endTime?: string | null
}

/**
 * Combines a Session's `day` (date part) with `startTime`/`endTime` (the
 * event's clock time, see src/lib/sessionTime.ts) into the real moment it
 * happens in the event's timezone. Null if either half is missing/invalid.
 */
export function combineDayAndTime(
  day: string | Date,
  time: string | Date | null | undefined,
  timeZone = 'UTC',
): Date | null {
  return sessionInstant(day, time, timeZone)
}

export function sessionTimeWindow(
  session: SessionTimeInfo,
  timeZone = 'UTC',
): { start: Date; end: Date } | null {
  const start = combineDayAndTime(session.day, session.startTime, timeZone)
  const end = combineDayAndTime(session.day, session.endTime, timeZone)
  if (!start || !end) return null
  return { start, end }
}

export type SessionAttendance = {
  sessionId: number
  sessionTitle: string
  pingCount: number
  estimatedMinutes: number
}

/**
 * The core "which panels were they likely watching" correlation: for each
 * session with a usable start/end time, counts how many of this attendee's
 * livestream pings fall inside that window. Sessions with no start/end time
 * set can't be matched and are silently skipped (not every session needs
 * one — e.g. breaks). A ping can match more than one session if their
 * windows overlap.
 */
export function matchPingsToSessions(
  pingTimestamps: Date[],
  sessions: SessionTimeInfo[],
  timeZone = 'UTC',
): SessionAttendance[] {
  const bySession = new Map<number, { title: string; count: number }>()

  for (const session of sessions) {
    const window = sessionTimeWindow(session, timeZone)
    if (!window) continue

    const count = pingTimestamps.filter((t) => t >= window.start && t <= window.end).length
    if (count > 0) bySession.set(session.id, { title: session.title, count })
  }

  return [...bySession.entries()].map(([sessionId, { title, count }]) => ({
    sessionId,
    sessionTitle: title,
    pingCount: count,
    estimatedMinutes: count * PING_INTERVAL_MINUTES,
  }))
}

export type AttendeeReportRow = {
  registrationId: number
  attendeeName: string
  attendeeEmail: string
  ticketType: string
  attendance: 'in-person' | 'virtual'
  status: 'pending' | 'active' | 'cancelled'
  amountPaid: number
  discountCode: string | null
  sessionsAttended: SessionAttendance[]
  totalPings: number
  estimatedTotalMinutes: number
}

/**
 * Every registration for an event, enriched with each virtual attendee's
 * livestream presence: total time on the livestream page, and which
 * sessions that presence overlapped with. Rows for attendees without an
 * account yet (no `attendee` relationship set) simply get no pings — they
 * can't have any, since the livestream page requires sign-in.
 */
export async function getAttendeeReport(
  payload: Payload,
  eventId: number,
): Promise<AttendeeReportRow[]> {
  const [event, { docs: registrations }, { docs: sessions }, { docs: pings }] = await Promise.all([
    payload.findByID({ collection: 'events', id: eventId, depth: 0, overrideAccess: true }),
    payload.find({
      collection: 'event-registrations',
      where: { event: { equals: eventId } },
      depth: 1,
      limit: 2000,
      sort: 'attendeeName',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'sessions',
      where: { event: { equals: eventId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'livestream-pings',
      where: { event: { equals: eventId } },
      limit: 20000,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  // Same fallback as eventTiming(): events without a timezone are treated as US Eastern.
  const timeZone = event.timezone || 'America/New_York'
  const sessionInfos: SessionTimeInfo[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    day: s.day,
    startTime: s.startTime,
    endTime: s.endTime,
  }))

  const pingsByUser = new Map<number, Date[]>()
  for (const p of pings) {
    const userId = typeof p.user === 'object' ? p.user.id : p.user
    if (!pingsByUser.has(userId)) pingsByUser.set(userId, [])
    pingsByUser.get(userId)!.push(new Date(p.createdAt))
  }

  return registrations.map((r) => {
    const attendeeId = typeof r.attendee === 'object' ? r.attendee?.id : r.attendee
    const userPings = attendeeId ? (pingsByUser.get(attendeeId) ?? []) : []
    const sessionsAttended = matchPingsToSessions(userPings, sessionInfos, timeZone)

    return {
      registrationId: r.id,
      attendeeName: r.attendeeName,
      attendeeEmail: r.attendeeEmail,
      ticketType: r.ticketType,
      attendance: r.attendance,
      status: r.status,
      amountPaid: r.amountPaid,
      discountCode:
        typeof r.discountCode === 'object' && r.discountCode ? r.discountCode.code : null,
      sessionsAttended,
      totalPings: userPings.length,
      estimatedTotalMinutes: userPings.length * PING_INTERVAL_MINUTES,
    }
  })
}

export type AttendeeReportTotals = {
  totalRegistrations: number
  activeCount: number
  cancelledCount: number
  inPersonCount: number
  virtualCount: number
  totalRevenue: number
  virtualWithAnyPingCount: number
  virtualEngagementRate: number | null
}

/** Totals across an attendee report — cancelled registrations are excluded from revenue/engagement, kept only in the raw counts. */
export function summarizeAttendeeReport(rows: AttendeeReportRow[]): AttendeeReportTotals {
  const active = rows.filter((r) => r.status === 'active')
  const virtual = active.filter((r) => r.attendance === 'virtual')
  const virtualWithPings = virtual.filter((r) => r.totalPings > 0)

  return {
    totalRegistrations: rows.length,
    activeCount: active.length,
    cancelledCount: rows.length - active.length,
    inPersonCount: active.filter((r) => r.attendance === 'in-person').length,
    virtualCount: virtual.length,
    totalRevenue: active.reduce((n, r) => n + r.amountPaid, 0),
    virtualWithAnyPingCount: virtualWithPings.length,
    virtualEngagementRate: virtual.length > 0 ? virtualWithPings.length / virtual.length : null,
  }
}

export type SessionPopularityRow = {
  sessionId: number
  sessionTitle: string
  uniqueAttendees: number
  totalEstimatedMinutes: number
  avgEstimatedMinutes: number
}

/** Per-session estimated attendance derived from an attendee report, ranked by total estimated minutes. Sessions nobody's pings overlapped with are omitted. */
export function getSessionPopularity(rows: AttendeeReportRow[]): SessionPopularityRow[] {
  const bySession = new Map<number, { title: string; attendees: number; minutes: number }>()

  for (const row of rows) {
    for (const s of row.sessionsAttended) {
      const entry = bySession.get(s.sessionId) ?? {
        title: s.sessionTitle,
        attendees: 0,
        minutes: 0,
      }
      entry.attendees += 1
      entry.minutes += s.estimatedMinutes
      bySession.set(s.sessionId, entry)
    }
  }

  return [...bySession.entries()]
    .map(([sessionId, entry]) => ({
      sessionId,
      sessionTitle: entry.title,
      uniqueAttendees: entry.attendees,
      totalEstimatedMinutes: entry.minutes,
      avgEstimatedMinutes: entry.minutes / entry.attendees,
    }))
    .sort((a, b) => b.totalEstimatedMinutes - a.totalEstimatedMinutes)
}
