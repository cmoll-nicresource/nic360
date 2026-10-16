import { expect, it } from 'vitest'
import { expectedGazette, newsletterCondition } from './conditions'

it('allows the Friday import a four-hour grace period and targets next Tuesday', () => {
  expect(expectedGazette(new Date('2026-10-16T15:59:59Z')).issueDate).toBe('2026-10-13')
  expect(expectedGazette(new Date('2026-10-16T16:00:00Z')).issueDate).toBe('2026-10-20')
  expect(expectedGazette(new Date('2027-01-01T16:00:00Z')).issueDate).toBe('2027-01-05')
})
it('only marks old sending issues or failed issues as needing attention', () => {
  const issue = {
    id: 4,
    title: 'Issue',
    updatedAt: '2026-10-15T12:00:00Z',
    email: { status: 'sending' },
  }
  expect(newsletterCondition(issue, new Date('2026-10-15T12:09:59Z'))).toBeNull()
  expect(newsletterCondition(issue, new Date('2026-10-15T12:11:00Z'))?.title).toContain('Stalled')
  expect(newsletterCondition({ ...issue, email: { status: 'failed' } }, new Date())?.key).toBe(
    'newsletter:4',
  )
  expect(newsletterCondition({ ...issue, email: { status: 'sent' } }, new Date())).toBeNull()
})
