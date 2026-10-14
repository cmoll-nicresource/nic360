import { describe, expect, it } from 'vitest'

import { formatDate } from './formatDate'

describe('formatDate', () => {
  it('formats an ISO string as "Oct 12, 2026"', () => {
    expect(formatDate('2026-10-12T00:00:00.000Z')).toBe('Oct 12, 2026')
  })

  it('formats a Date object', () => {
    expect(formatDate(new Date('2026-01-05T00:00:00.000Z'))).toBe('Jan 5, 2026')
  })

  it('returns an empty string for null/undefined', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatDate('not a date')).toBe('')
  })
})
