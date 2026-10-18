import type { Event } from '@/payload-types'

const calendarDay = (value: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value)

/** endDate is a day-only field: keep an event current through its final local calendar day. */
export function eventTiming(event: Pick<Event, 'startsAt' | 'endDate' | 'timezone'>, now = new Date()) {
  const timeZone = event.timezone || 'America/New_York'
  const today = calendarDay(now, timeZone)
  const starts = new Date(event.startsAt)
  const startDay = calendarDay(starts, timeZone)
  const endDay = event.endDate.slice(0, 10)
  const daysRemaining = Math.round((Date.parse(startDay) - Date.parse(today)) / 86400000)
  return {
    daysRemaining: Math.max(0, daysRemaining),
    status: today > endDay ? 'Ended' : now >= starts ? 'Underway' : 'Upcoming',
    dates: `${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone }).format(starts)} – ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(event.endDate))}`,
    timeZone,
  }
}
