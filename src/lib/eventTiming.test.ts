import { expect, it } from 'vitest'
import { eventTiming } from './eventTiming'

it('counts calendar days through DST instead of rounding elapsed hours', () => {
  const event = { startsAt: '2026-11-02T14:00:00Z', endDate: '2026-11-03T00:00:00Z', timezone: 'America/New_York' } as const
  expect(eventTiming(event, new Date('2026-10-31T16:00:00Z'))).toMatchObject({ daysRemaining: 2, status: 'Upcoming' })
})
it('keeps the entire final local day current and labels completed events', () => {
  const event = { startsAt: '2026-10-16T14:00:00Z', endDate: '2026-10-18T00:00:00Z', timezone: 'America/New_York' } as const
  expect(eventTiming(event, new Date('2026-10-19T02:00:00Z'))).toMatchObject({ status: 'Underway', daysRemaining: 0 })
  expect(eventTiming(event, new Date('2026-10-19T04:00:00Z')).status).toBe('Ended')
})
it('uses the event timezone for the start day and preserves a date-only end date', () => {
  const result = eventTiming({ startsAt: '2026-10-19T02:00:00Z', endDate: '2026-10-20T00:00:00Z', timezone: 'America/Los_Angeles' }, new Date('2026-10-18T19:00:00Z'))
  expect(result.daysRemaining).toBe(0)
  expect(result.dates).toBe('Oct 18, 2026 – Oct 20, 2026')
})
