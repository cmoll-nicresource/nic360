import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import {
  IncompleteTrademarkMonthError,
  monthlyGazetteDates,
  requireCompleteTrademarkMonth,
} from './monthlyCoverage'

describe('monthly Gazette coverage', () => {
  it.each([
    ['2026-09-01', ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']],
    ['2026-02-01', ['2026-02-03', '2026-02-10', '2026-02-17', '2026-02-24']],
    ['2024-02-01', ['2024-02-06', '2024-02-13', '2024-02-20', '2024-02-27']],
    ['2026-12-01', ['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22', '2026-12-29']],
  ])('requires exactly the Tuesday issues in %s', (month, dates) => {
    expect(monthlyGazetteDates(new Date(month))).toEqual(dates)
  })

  it('accepts a successfully imported zero-match week and checks official source/status for each date', async () => {
    const find = vi.fn(async () => ({ docs: [{ id: 1 }] }))
    await requireCompleteTrademarkMonth({ find } as unknown as Payload, new Date('2026-09-01'))
    expect(find).toHaveBeenCalledTimes(5)
    expect(find.mock.calls[0]).toBeDefined()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [
            { issueDate: { equals: '2026-09-01T00:00:00.000Z' } },
            { status: { equals: 'succeeded' } },
            {
              feedSource: {
                equals: 'https://cdn.uspto.gov/doc/TMOGIssue_20260901_entire?extension=xml',
              },
            },
          ],
        },
        limit: 1,
        depth: 0,
      }),
    )
    // No count threshold: a full Gazette can legitimately contain zero marks.
  })

  it('lists the exact missing weeks even if other weeks were imported repeatedly', async () => {
    const find = vi.fn(async (args: { where: { and: { issueDate?: { equals: string } }[] } }) => {
      const date = args.where.and[0].issueDate!.equals
      return { docs: date.includes('09-08') || date.includes('09-29') ? [] : [{ id: 1 }] }
    })
    const error = await requireCompleteTrademarkMonth(
      { find } as unknown as Payload,
      new Date('2026-09-01'),
    ).catch((error) => error)
    expect(error).toBeInstanceOf(IncompleteTrademarkMonthError)
    expect(error.missingIssueDates).toEqual(['2026-09-08', '2026-09-29'])
    expect(error.message).toContain('20260908, 20260929')
  })
})
