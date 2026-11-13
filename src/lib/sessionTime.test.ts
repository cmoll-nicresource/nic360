import { describe, expect, it } from 'vitest'

import {
  clockFromInput,
  clockInputValue,
  clockMinutes,
  formatClock,
  formatClockRange,
  sessionClockAt,
  sessionInstant,
  zoneAbbreviation,
} from './sessionTime'

describe('clock times typed by staff', () => {
  it('stores the typed time unchanged, wherever the editor is', () => {
    expect(clockFromInput('09:30')).toBe('1970-01-01T09:30:00.000Z')
    expect(clockFromInput('9:05')).toBe('1970-01-01T09:05:00.000Z')
    expect(clockFromInput('23:59')).toBe('1970-01-01T23:59:00.000Z')
  })

  it('rejects empty and impossible times', () => {
    expect(clockFromInput('')).toBeNull()
    expect(clockFromInput('24:00')).toBeNull()
    expect(clockFromInput('10:75')).toBeNull()
    expect(clockFromInput('half nine')).toBeNull()
  })

  it('round-trips through the time input', () => {
    expect(clockInputValue(clockFromInput('14:05'))).toBe('14:05')
    expect(clockInputValue(null)).toBe('')
    expect(clockInputValue('not a date')).toBe('')
  })

  it('reads migrated agenda times, which sit on the session day rather than 1970', () => {
    expect(clockInputValue('2025-10-06T08:15:00.000Z')).toBe('08:15')
    expect(formatClock('2025-10-06T08:15:00.000Z')).toBe('8:15 AM')
  })
})

describe('formatClockRange', () => {
  it('shows a start and end', () => {
    expect(formatClockRange('1970-01-01T09:00:00.000Z', '1970-01-01T10:15:00.000Z')).toBe(
      '9:00 AM – 10:15 AM',
    )
    expect(formatClockRange('1970-01-01T12:00:00.000Z', '1970-01-01T13:00:00.000Z')).toBe(
      '12:00 PM – 1:00 PM',
    )
  })

  it('shows only the start when there is no end, and nothing without a start', () => {
    expect(formatClockRange('1970-01-01T09:00:00.000Z', null)).toBe('9:00 AM')
    expect(formatClockRange(null, '1970-01-01T10:15:00.000Z')).toBe('')
  })
})

describe('clockMinutes', () => {
  it('counts minutes after midnight for sorting', () => {
    expect(clockMinutes('1970-01-01T00:00:00.000Z')).toBe(0)
    expect(clockMinutes('2025-10-06T13:45:00.000Z')).toBe(825)
    expect(clockMinutes(undefined)).toBeNull()
  })
})

describe('sessionInstant', () => {
  const nine = '1970-01-01T09:00:00.000Z'

  it('reads the clock time in the event timezone', () => {
    // Prague in September is UTC+2; Leesburg in April is UTC-4.
    expect(sessionInstant('2027-09-08T00:00:00.000Z', nine, 'Europe/Paris')?.toISOString()).toBe(
      '2027-09-08T07:00:00.000Z',
    )
    expect(
      sessionInstant('2027-04-19T00:00:00.000Z', nine, 'America/New_York')?.toISOString(),
    ).toBe('2027-04-19T13:00:00.000Z')
  })

  it('follows daylight saving in the same zone', () => {
    expect(
      sessionInstant('2027-01-19T00:00:00.000Z', nine, 'America/New_York')?.toISOString(),
    ).toBe('2027-01-19T14:00:00.000Z')
  })

  it('keeps the calendar day of the session even when the instant is on another UTC day', () => {
    expect(
      sessionInstant('2027-06-01T00:00:00.000Z', '1970-01-01T08:00:00.000Z', 'Asia/Tokyo')?.toISOString(),
    ).toBe('2027-05-31T23:00:00.000Z')
    expect(
      sessionInstant('2027-06-01T00:00:00.000Z', '1970-01-01T22:00:00.000Z', 'America/Los_Angeles')?.toISOString(),
    ).toBe('2027-06-02T05:00:00.000Z')
  })

  it('is unchanged for UTC, and null for missing or unusable input', () => {
    expect(sessionInstant('2026-06-15T00:00:00.000Z', '1970-01-01T14:30:00.000Z', 'UTC')?.toISOString()).toBe(
      '2026-06-15T14:30:00.000Z',
    )
    expect(sessionInstant('2026-06-15T00:00:00.000Z', null, 'UTC')).toBeNull()
    expect(sessionInstant('nope', nine, 'UTC')).toBeNull()
    expect(sessionInstant('2026-06-15T00:00:00.000Z', nine, 'Not/AZone')).toBeNull()
  })
})

describe('sessionClockAt', () => {
  it('is the reverse of sessionInstant', () => {
    const instant = new Date('2027-04-19T13:30:00.000Z')
    const clock = sessionClockAt(instant, 'America/New_York')
    expect(clock).toEqual({ day: '2027-04-19T00:00:00.000Z', time: '1970-01-01T09:30:00.000Z' })
    expect(sessionInstant(clock.day, clock.time, 'America/New_York')?.getTime()).toBe(
      instant.getTime(),
    )
  })

  it('uses the venue calendar day late in the evening', () => {
    expect(sessionClockAt(new Date('2027-04-20T02:00:00.000Z'), 'America/New_York').day).toBe(
      '2027-04-19T00:00:00.000Z',
    )
  })
})

describe('zoneAbbreviation', () => {
  it('names the zone in force on that day', () => {
    expect(zoneAbbreviation('2027-04-19T00:00:00.000Z', 'America/New_York')).toBe('EDT')
    expect(zoneAbbreviation('2027-01-19T00:00:00.000Z', 'America/New_York')).toBe('EST')
  })

  it('is empty when the event has no timezone', () => {
    expect(zoneAbbreviation('2027-04-19T00:00:00.000Z', null)).toBe('')
    expect(zoneAbbreviation('2027-04-19T00:00:00.000Z', 'Not/AZone')).toBe('')
  })
})
