/**
 * Session start/end times are the event's own clock time ("9:00 at the
 * venue"), stored in the UTC hour and minute of the field's timestamp. The
 * date part of that timestamp is irrelevant: the session's `day` supplies the
 * date and the event's `timezone` says which clock it was. This is how the
 * migrated agendas were stored, so nothing here depends on where the member
 * of staff or the visitor happens to be.
 */

type DateInput = string | Date | null | undefined

function parse(value: DateInput): Date | null {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? null : date
}

/** "09:30" for a time input, or '' when there is no time. */
export function clockInputValue(value: DateInput): string {
  const date = parse(value)
  if (!date) return ''
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

/** Stores an "HH:MM" clock time. Returns null for an empty or malformed value. */
export function clockFromInput(input: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return new Date(Date.UTC(1970, 0, 1, hours, minutes)).toISOString()
}

/** "9:30 AM" */
export function formatClock(value: DateInput): string {
  const date = parse(value)
  if (!date) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

/** "9:30 AM – 10:15 AM", "9:30 AM" when there is no end, '' when there is no start. */
export function formatClockRange(start: DateInput, end: DateInput): string {
  const from = formatClock(start)
  if (!from) return ''
  const to = formatClock(end)
  return to ? `${from} – ${to}` : from
}

/** Minutes after midnight, for sorting; null when there is no time. */
export function clockMinutes(value: DateInput): number | null {
  const date = parse(value)
  return date ? date.getUTCHours() * 60 + date.getUTCMinutes() : null
}

/** How far the zone's clock is ahead of UTC at that instant, in milliseconds. */
function zoneOffset(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant)
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  )
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * The real moment a session clock time happens: the calendar date of `day`
 * plus the clock time of `time`, read on the event's clock.
 */
export function sessionInstant(day: DateInput, time: DateInput, timeZone: string): Date | null {
  const dayDate = parse(day)
  const timeDate = parse(time)
  if (!dayDate || !timeDate) return null
  const wall = Date.UTC(
    dayDate.getUTCFullYear(),
    dayDate.getUTCMonth(),
    dayDate.getUTCDate(),
    timeDate.getUTCHours(),
    timeDate.getUTCMinutes(),
  )
  try {
    // Two passes settle the offset on days when the clocks change.
    const first = wall - zoneOffset(new Date(wall), timeZone)
    return new Date(wall - zoneOffset(new Date(first), timeZone))
  } catch {
    return null
  }
}

/** The reverse: what a real moment reads on the event's clock, as stored `day` and clock-time values. */
export function sessionClockAt(instant: Date, timeZone: string): { day: string; time: string } {
  const wall = new Date(instant.getTime() + zoneOffset(instant, timeZone))
  return {
    day: new Date(
      Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()),
    ).toISOString(),
    time: new Date(Date.UTC(1970, 0, 1, wall.getUTCHours(), wall.getUTCMinutes())).toISOString(),
  }
}

/** "CEST", "EDT": the short zone name in force on that day, shown beside agenda times. */
export function zoneAbbreviation(day: DateInput, timeZone: string | null | undefined): string {
  const date = parse(day)
  if (!date || !timeZone) return ''
  try {
    const noon = sessionInstant(date, new Date(Date.UTC(1970, 0, 1, 12)), timeZone) ?? date
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(noon)
      .find((p) => p.type === 'timeZoneName')?.value
    return name ?? ''
  } catch {
    return ''
  }
}
