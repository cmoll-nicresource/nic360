import { describe, expect, it } from 'vitest'

import { candidateIssueDates, MAX_WEEKS_BACK } from './fetchIssue'

describe('candidateIssueDates', () => {
  it('targets the coming Tuesday when run on a Friday, then steps back a week at a time', () => {
    // Oct 9 2026 is a Friday; the coming Tuesday is Oct 13 2026.
    const dates = candidateIssueDates(new Date('2026-10-09T12:00:00Z'))
    expect(dates).toEqual(['20261013', '20261006', '20260929', '20260922', '20260915'])
  })

  it('returns MAX_WEEKS_BACK + 1 candidates', () => {
    const dates = candidateIssueDates(new Date('2026-10-09T12:00:00Z'))
    expect(dates).toHaveLength(MAX_WEEKS_BACK + 1)
  })

  it('treats a Tuesday reference date as the coming Tuesday itself', () => {
    const dates = candidateIssueDates(new Date('2026-10-13T00:00:00Z'))
    expect(dates[0]).toBe('20261013')
  })

  it('rolls forward correctly across a month boundary', () => {
    // Oct 30 2026 is a Friday; the coming Tuesday is Nov 3 2026.
    const dates = candidateIssueDates(new Date('2026-10-30T12:00:00Z'))
    expect(dates[0]).toBe('20261103')
  })
})
