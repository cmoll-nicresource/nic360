import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./frontendContext', () => ({ frontendContext: vi.fn() }))
import { frontendContext } from './frontendContext'
import { currentEditions } from './currentEditions'
const find = vi.fn()
beforeEach(() => vi.resetAllMocks())
describe('current publication editions', () => {
  it('does not query a subscriber library for an ineligible reader', async () => {
    vi.mocked(frontendContext).mockResolvedValue({ canRead: false, payload: { find } } as never)
    expect(await currentEditions()).toEqual({ publications: [], issues: [] })
    expect(find).not.toHaveBeenCalled()
  })
  it('keeps the monthly edition alongside a busier daily, with published-only access checked queries', async () => {
    const user = { id: 3, collection: 'users' }
    vi.mocked(frontendContext).mockResolvedValue({
      canRead: true,
      user,
      payload: { find },
    } as never)
    find.mockImplementation(async (args) =>
      args.collection === 'publications'
        ? {
            docs: [
              { id: 1, title: 'Daily' },
              { id: 2, title: 'Monthly' },
            ],
          }
        : {
            docs: [
              {
                id: args.where.and[0].publication.equals,
                issueDate: args.where.and[0].publication.equals === 1 ? '2026-10-15' : '2026-09-01',
              },
            ],
          },
    )
    const result = await currentEditions()
    expect(result.issues.map((issue) => issue.id)).toEqual([1, 2])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'publication-issues',
        limit: 1,
        user,
        overrideAccess: false,
        where: { and: [{ publication: { equals: 2 } }, { _status: { equals: 'published' } }] },
      }),
    )
  })
})
