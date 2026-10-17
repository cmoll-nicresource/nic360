import { expect, it } from 'vitest'
import { defaultIssueDate, publicationIssueTitle } from './publicationIssueTitle'
it('defaults to the Eastern calendar day after UTC midnight, including year rollover', () => {
  expect(defaultIssueDate(new Date('2026-10-17T00:15:00Z'))).toBe('2026-10-16T12:00:00.000Z')
  expect(defaultIssueDate(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31T12:00:00.000Z')
})
it('formats daily and weekly dates with full month, unpadded day and year', () => {
  for (const frequency of ['daily', 'weekly'])
    expect(publicationIssueTitle('US News Clippings', frequency, '2026-10-09T00:00:00Z')).toBe(
      'US News Clippings - October 9, 2026',
    )
})
it('uses the previous calendar month and handles year rollover', () => {
  expect(publicationIssueTitle('Monthly Report', 'monthly', '2026-10-16')).toBe(
    'Monthly Report - September 2026',
  )
  expect(publicationIssueTitle('Monthly Report', 'monthly', '2027-01-01')).toBe(
    'Monthly Report - December 2026',
  )
  expect(publicationIssueTitle('Monthly Report', 'monthly', '2024-03-31')).toBe(
    'Monthly Report - February 2024',
  )
})
it('keeps the actual reporting month when generating a historical trade report', () => {
  expect(
    publicationIssueTitle('Trade Barometer', 'monthly', '2026-10-16', new Date('2026-08-01')),
  ).toBe('Trade Barometer - August 2026')
})
