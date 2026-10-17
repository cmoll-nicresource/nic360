import { expect, it, vi } from 'vitest'
import { defaultIssueFields } from './defaultIssueFields'
it('fills a missing required title before validation even with an explicit format', async () => {
  const findByID = vi
    .fn()
    .mockResolvedValue({ title: 'US News Clippings', frequency: 'weekly', format: 'excerpt-list' })
  const result = await defaultIssueFields({
    operation: 'create',
    data: { publication: 119, format: 'excerpt-list', issueDate: '2026-10-09' },
    req: { payload: { findByID } },
  } as never)
  expect(result.title).toBe('US News Clippings - October 09, 2026')
})
it('fills monthly titles and publication format together', async () => {
  const findByID = vi
    .fn()
    .mockResolvedValue({ title: 'Monthly Report', frequency: 'monthly', format: 'pdf-report' })
  const result = await defaultIssueFields({
    operation: 'create',
    data: { publication: 1, issueDate: '2027-01-01' },
    req: { payload: { findByID } },
  } as never)
  expect(result).toMatchObject({ title: 'Monthly Report - December 2026', format: 'pdf-report' })
})
it('preserves custom titles and partial updates to existing issues', async () => {
  const findByID = vi.fn()
  expect(
    await defaultIssueFields({
      operation: 'create',
      data: { publication: 1, format: 'excerpt-list', title: 'Special edition' },
      req: { payload: { findByID } },
    } as never),
  ).toMatchObject({ title: 'Special edition' })
  expect(
    await defaultIssueFields({
      operation: 'update',
      data: { issueDate: '2026-10-16' },
      originalDoc: { title: 'Existing title' },
      req: { payload: { findByID } },
    } as never),
  ).not.toHaveProperty('title')
  expect(findByID).not.toHaveBeenCalled()
})
