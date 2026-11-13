import type { Event, Session } from '@/payload-types'
import { sessionInstant } from '@/lib/sessionTime'

/**
 * Add-to-calendar for an event. A forum that runs over several days goes in
 * as an all-day block; a one-day event with timed sessions (a webinar) goes
 * in at its real start and end, worked out from the venue clock and timezone.
 */

export type CalendarWindow =
  | { allDay: true; start: string; endExclusive: string }
  | { allDay: false; start: Date; end: Date }

const DAY_MS = 24 * 60 * 60 * 1000

const utcDay = (value: string | Date) => {
  const date = new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** "20270914" */
const compactDate = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '')

/** "20270914T130000Z" */
const compactInstant = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')

export function eventCalendarWindow(
  event: Pick<Event, 'startsAt' | 'endDate'> & { timezone?: string | null },
  sessions: Pick<Session, 'day' | 'startTime' | 'endTime'>[] = [],
): CalendarWindow {
  const first = utcDay(event.startsAt)
  const last = Math.max(first, utcDay(event.endDate))
  if (first === last && event.timezone) {
    let start: Date | null = null
    let end: Date | null = null
    for (const session of sessions) {
      const from = sessionInstant(session.day, session.startTime, event.timezone)
      if (!from) continue
      const to =
        sessionInstant(session.day, session.endTime, event.timezone) ??
        new Date(from.getTime() + 60 * 60 * 1000)
      if (!start || from < start) start = from
      if (!end || to > end) end = to
    }
    if (start && end && end > start) return { allDay: false, start, end }
  }
  return { allDay: true, start: compactDate(first), endExclusive: compactDate(last + DAY_MS) }
}

/** ISO dates for search engines: date-only for all-day events, full instants otherwise. */
export function calendarIsoDates(window: CalendarWindow): { start: string; end: string } {
  if (!window.allDay) return { start: window.start.toISOString(), end: window.end.toISOString() }
  const iso = (compact: string) =>
    `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  const lastDay = new Date(Date.parse(iso(window.endExclusive)) - DAY_MS)
  return { start: iso(window.start), end: lastDay.toISOString().slice(0, 10) }
}

const escapeText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;])/g, '\\$1')

/** Calendar lines may be at most 75 bytes; longer ones continue on a line that starts with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // Continuation lines spend one byte on their leading space.
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export type CalendarEntry = {
  uid: string
  title: string
  window: CalendarWindow
  location?: string | null
  description?: string | null
  url: string
  /** When the file was produced. */
  stamp: Date
}

/** A one-event .ics file that Outlook, Apple Calendar and Google Calendar can all import. */
export function eventIcs(entry: CalendarEntry): string {
  const { window } = entry
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nicotine360//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(entry.uid)}`,
    `DTSTAMP:${compactInstant(entry.stamp)}`,
    window.allDay
      ? `DTSTART;VALUE=DATE:${window.start}`
      : `DTSTART:${compactInstant(window.start)}`,
    window.allDay
      ? `DTEND;VALUE=DATE:${window.endExclusive}`
      : `DTEND:${compactInstant(window.end)}`,
    `SUMMARY:${escapeText(entry.title)}`,
    ...(entry.location ? [`LOCATION:${escapeText(entry.location)}`] : []),
    `DESCRIPTION:${escapeText([entry.description, entry.url].filter(Boolean).join('\n\n'))}`,
    `URL:${entry.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** A link that opens Google Calendar's "new event" screen filled in. */
export function googleCalendarUrl(entry: Omit<CalendarEntry, 'uid' | 'stamp'>): string {
  const { window } = entry
  const dates = window.allDay
    ? `${window.start}/${window.endExclusive}`
    : `${compactInstant(window.start)}/${compactInstant(window.end)}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: entry.title,
    dates,
    details: [entry.description, entry.url].filter(Boolean).join('\n\n'),
  })
  if (entry.location) params.set('location', entry.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
