import { describe, expect, it } from 'vitest'

import {
  combineDayAndTime,
  getSessionPopularity,
  matchPingsToSessions,
  PING_INTERVAL_MINUTES,
  summarizeAttendeeReport,
  type AttendeeReportRow,
  type SessionTimeInfo,
} from './eventAnalytics'

function row(overrides: Partial<AttendeeReportRow>): AttendeeReportRow {
  return {
    registrationId: 1,
    attendeeName: 'Test Attendee',
    attendeeEmail: 'test@example.com',
    ticketType: 'General Admission',
    attendance: 'in-person',
    status: 'active',
    amountPaid: 100,
    discountCode: null,
    sessionsAttended: [],
    totalPings: 0,
    estimatedTotalMinutes: 0,
    ...overrides,
  }
}

describe('combineDayAndTime', () => {
  it('applies the time-of-day from `time` onto the date of `day`', () => {
    const combined = combineDayAndTime('2026-06-15T00:00:00.000Z', '1970-01-01T14:30:00.000Z')
    expect(combined?.toISOString()).toBe('2026-06-15T14:30:00.000Z')
  })

  it('returns null when time is missing', () => {
    expect(combineDayAndTime('2026-06-15T00:00:00.000Z', null)).toBeNull()
    expect(combineDayAndTime('2026-06-15T00:00:00.000Z', undefined)).toBeNull()
  })

  it('returns null for invalid dates', () => {
    expect(combineDayAndTime('not-a-date', '1970-01-01T14:30:00.000Z')).toBeNull()
  })
})

describe('matchPingsToSessions', () => {
  const sessions: SessionTimeInfo[] = [
    { id: 1, title: 'Morning Keynote', day: '2026-06-15T00:00:00.000Z', startTime: '1970-01-01T09:00:00.000Z', endTime: '1970-01-01T10:00:00.000Z' },
    { id: 2, title: 'Afternoon Panel', day: '2026-06-15T00:00:00.000Z', startTime: '1970-01-01T14:00:00.000Z', endTime: '1970-01-01T15:00:00.000Z' },
    { id: 3, title: 'Undated Break', day: '2026-06-15T00:00:00.000Z', startTime: null, endTime: null },
  ]

  it('counts pings that fall within each session’s time window', () => {
    const pings = [
      new Date('2026-06-15T09:10:00.000Z'),
      new Date('2026-06-15T09:30:00.000Z'),
      new Date('2026-06-15T14:05:00.000Z'),
      new Date('2026-06-15T20:00:00.000Z'), // outside any session
    ]
    const result = matchPingsToSessions(pings, sessions)

    expect(result).toHaveLength(2)
    expect(result.find((r) => r.sessionId === 1)).toMatchObject({ pingCount: 2, estimatedMinutes: 2 * PING_INTERVAL_MINUTES })
    expect(result.find((r) => r.sessionId === 2)).toMatchObject({ pingCount: 1, estimatedMinutes: PING_INTERVAL_MINUTES })
  })

  it('skips sessions with no start/end time, and returns nothing for no overlapping pings', () => {
    expect(matchPingsToSessions([new Date('2026-06-15T12:00:00.000Z')], sessions)).toEqual([])
  })

  it('a ping can match more than one session when their windows overlap', () => {
    const overlapping: SessionTimeInfo[] = [
      { id: 1, title: 'Track A', day: '2026-06-15T00:00:00.000Z', startTime: '1970-01-01T09:00:00.000Z', endTime: '1970-01-01T10:00:00.000Z' },
      { id: 2, title: 'Track B', day: '2026-06-15T00:00:00.000Z', startTime: '1970-01-01T09:30:00.000Z', endTime: '1970-01-01T10:30:00.000Z' },
    ]
    const result = matchPingsToSessions([new Date('2026-06-15T09:45:00.000Z')], overlapping)
    expect(result).toHaveLength(2)
  })
})

describe('summarizeAttendeeReport', () => {
  it('splits in-person vs virtual and sums revenue, among active registrations only', () => {
    const rows = [
      row({ attendance: 'in-person', amountPaid: 100 }),
      row({ attendance: 'virtual', amountPaid: 50, totalPings: 5 }),
      row({ attendance: 'virtual', amountPaid: 50 }),
      row({ attendance: 'in-person', amountPaid: 100, status: 'cancelled' }),
    ]
    const totals = summarizeAttendeeReport(rows)

    expect(totals.totalRegistrations).toBe(4)
    expect(totals.activeCount).toBe(3)
    expect(totals.cancelledCount).toBe(1)
    expect(totals.inPersonCount).toBe(1)
    expect(totals.virtualCount).toBe(2)
    expect(totals.totalRevenue).toBe(200)
  })

  it('computes virtual engagement rate as the share of virtual attendees with at least one ping', () => {
    const rows = [
      row({ attendance: 'virtual', totalPings: 10 }),
      row({ attendance: 'virtual', totalPings: 0 }),
      row({ attendance: 'virtual', totalPings: 0 }),
      row({ attendance: 'virtual', totalPings: 0 }),
    ]
    const totals = summarizeAttendeeReport(rows)
    expect(totals.virtualWithAnyPingCount).toBe(1)
    expect(totals.virtualEngagementRate).toBeCloseTo(0.25)
  })

  it('returns a null engagement rate when there are no virtual attendees, rather than dividing by zero', () => {
    const totals = summarizeAttendeeReport([row({ attendance: 'in-person' })])
    expect(totals.virtualEngagementRate).toBeNull()
  })
})

describe('getSessionPopularity', () => {
  it('aggregates attendees and estimated minutes per session, ranked by total minutes', () => {
    const rows = [
      row({
        sessionsAttended: [
          { sessionId: 1, sessionTitle: 'Keynote', pingCount: 20, estimatedMinutes: 40 },
          { sessionId: 2, sessionTitle: 'Panel', pingCount: 5, estimatedMinutes: 10 },
        ],
      }),
      row({
        sessionsAttended: [{ sessionId: 1, sessionTitle: 'Keynote', pingCount: 10, estimatedMinutes: 20 }],
      }),
    ]

    const popularity = getSessionPopularity(rows)
    expect(popularity).toHaveLength(2)
    expect(popularity[0]).toMatchObject({ sessionId: 1, uniqueAttendees: 2, totalEstimatedMinutes: 60 })
    expect(popularity[0].avgEstimatedMinutes).toBeCloseTo(30)
    expect(popularity[1]).toMatchObject({ sessionId: 2, uniqueAttendees: 1, totalEstimatedMinutes: 10 })
  })

  it('omits sessions nobody attended and returns an empty list for no data', () => {
    expect(getSessionPopularity([row({ sessionsAttended: [] })])).toEqual([])
  })
})
