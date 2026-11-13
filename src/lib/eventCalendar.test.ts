import { describe, expect, it } from 'vitest'

import {
  calendarIsoDates,
  eventCalendarWindow,
  eventIcs,
  googleCalendarUrl,
} from './eventCalendar'
import { clockFromInput } from './sessionTime'

const forum = {
  startsAt: '2027-09-14T08:00:00.000Z',
  endDate: '2027-09-16T00:00:00.000Z',
  timezone: 'Europe/London',
}

describe('eventCalendarWindow', () => {
  it('blocks out every day of a multi-day forum, with the exclusive end calendars expect', () => {
    const window = eventCalendarWindow(forum, [
      { day: '2027-09-14T00:00:00.000Z', startTime: clockFromInput('09:00'), endTime: null },
    ])
    expect(window).toEqual({ allDay: true, start: '20270914', endExclusive: '20270917' })
    expect(calendarIsoDates(window)).toEqual({ start: '2027-09-14', end: '2027-09-16' })
  })

  it('uses real start and end times for a one-day event with timed sessions', () => {
    const webinar = {
      startsAt: '2027-03-10T00:00:00.000Z',
      endDate: '2027-03-10T00:00:00.000Z',
      timezone: 'America/New_York',
    }
    const day = '2027-03-10T00:00:00.000Z'
    const window = eventCalendarWindow(webinar, [
      { day, startTime: clockFromInput('11:00'), endTime: clockFromInput('12:00') },
      { day, startTime: clockFromInput('10:00'), endTime: clockFromInput('10:45') },
      { day, startTime: null, endTime: null },
    ])
    // 10:00–12:00 Eastern, before the clocks change on 14 March.
    expect(window).toEqual({
      allDay: false,
      start: new Date('2027-03-10T15:00:00.000Z'),
      end: new Date('2027-03-10T17:00:00.000Z'),
    })
  })

  it('assumes an hour when the last session has no end time', () => {
    const day = '2027-07-01T00:00:00.000Z'
    const window = eventCalendarWindow(
      { startsAt: day, endDate: day, timezone: 'Europe/London' },
      [{ day, startTime: clockFromInput('14:00'), endTime: null }],
    )
    expect(window).toMatchObject({
      start: new Date('2027-07-01T13:00:00.000Z'),
      end: new Date('2027-07-01T14:00:00.000Z'),
    })
  })

  it('falls back to all day without times or without a timezone', () => {
    const day = '2027-07-01T00:00:00.000Z'
    const allDay = { allDay: true, start: '20270701', endExclusive: '20270702' }
    expect(eventCalendarWindow({ startsAt: day, endDate: day, timezone: 'Europe/London' })).toEqual(
      allDay,
    )
    expect(
      eventCalendarWindow({ startsAt: day, endDate: day, timezone: null }, [
        { day, startTime: clockFromInput('14:00'), endTime: null },
      ]),
    ).toEqual(allDay)
  })

  it('survives an end date before the start', () => {
    expect(
      eventCalendarWindow({ ...forum, endDate: '2027-09-01T00:00:00.000Z' }),
    ).toEqual({ allDay: true, start: '20270914', endExclusive: '20270915' })
  })
})

describe('eventIcs', () => {
  const entry = {
    uid: 'event-12@nicotine360.org',
    title: 'GTNF 2027; Brussels, Belgium',
    window: eventCalendarWindow(forum),
    location: 'Hilton Brussels Grand Place, Brussels',
    description: 'Three days of research,\nregulation and innovation',
    url: 'https://nicotine360.org/events/gtnf-2027',
    stamp: new Date('2027-01-05T10:30:00.000Z'),
  }

  it('writes a valid all-day event with escaped text and CRLF line endings', () => {
    const ics = eventIcs(entry)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.split('\r\n')).toEqual(
      expect.arrayContaining([
        'UID:event-12@nicotine360.org',
        'DTSTAMP:20270105T103000Z',
        'DTSTART;VALUE=DATE:20270914',
        'DTEND;VALUE=DATE:20270917',
        'SUMMARY:GTNF 2027\\; Brussels\\, Belgium',
        'LOCATION:Hilton Brussels Grand Place\\, Brussels',
      ]),
    )
    expect(ics.replace(/\r\n /g, '')).toContain(
      'DESCRIPTION:Three days of research\\,\\nregulation and innovation\\n\\nhttps://nicotine360.org/events/gtnf-2027',
    )
    expect(ics).not.toMatch(/[^\r]\n/)
  })

  it('folds long lines at 75 bytes, counting accented characters properly', () => {
    const ics = eventIcs({ ...entry, description: 'é'.repeat(200) })
    const encoder = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    expect(ics.replace(/\r\n /g, '')).toContain('é'.repeat(200))
  })

  it('writes timed events in UTC', () => {
    const ics = eventIcs({
      ...entry,
      window: {
        allDay: false,
        start: new Date('2027-03-10T15:00:00.000Z'),
        end: new Date('2027-03-10T17:00:00.000Z'),
      },
    })
    expect(ics).toContain('DTSTART:20270310T150000Z\r\nDTEND:20270310T170000Z')
  })
})

describe('googleCalendarUrl', () => {
  it('fills in the title, dates, place and a link back', () => {
    const url = new URL(
      googleCalendarUrl({
        title: 'GTNF 2027',
        window: eventCalendarWindow(forum),
        location: 'Brussels',
        description: null,
        url: 'https://nicotine360.org/events/gtnf-2027',
      }),
    )
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'GTNF 2027',
      dates: '20270914/20270917',
      details: 'https://nicotine360.org/events/gtnf-2027',
      location: 'Brussels',
    })
  })
})
