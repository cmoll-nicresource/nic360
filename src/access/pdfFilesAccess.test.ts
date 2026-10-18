import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { canReadPdfFile } from './pdfFilesAccess'
import { getSubscriptionPlan } from './subscriptionPlan'
vi.mock('./subscriptionPlan', () => ({ getSubscriptionPlan: vi.fn() }))
const invoke = (req: PayloadRequest) =>
  canReadPdfFile({ req } as Parameters<typeof canReadPdfFile>[0])
describe('PDF parent permissions', () => {
  it('allows staff to review drafts and rejects anonymous users', async () => {
    expect(await invoke({ user: { collection: 'staff', role: 'editor' } } as PayloadRequest)).toBe(
      true,
    )
    expect(await invoke({ user: null } as PayloadRequest)).toBe(false)
  })
  it.each(['base', 'premium'] as const)(
    'scopes %s files to permitted published guide/publication parents, across pages',
    async (plan) => {
      vi.mocked(getSubscriptionPlan).mockResolvedValue(plan)
      const find = vi.fn(async (args: { collection: string; page: number; where: unknown }) => ({
        docs: [{ file: args.collection === 'guides' ? (args.page === 1 ? 11 : 12) : 21 }],
        hasNextPage: args.collection === 'guides' && args.page === 1,
      }))
      const req = { user: { collection: 'users' }, payload: { find } } as unknown as PayloadRequest
      expect(await invoke(req)).toEqual({ id: { in: expect.arrayContaining([11, 12, 21]) } })
      const guideQuery = find.mock.calls.find(([args]) => args.collection === 'guides')![0]
      expect(JSON.stringify(guideQuery.where)).toContain('published')
      expect(JSON.stringify(guideQuery.where).includes('requiresPremium')).toBe(plan === 'base')
      expect(find).toHaveBeenCalledTimes(3)
    },
  )
  it('denies expired/unsubscribed users and orphan files', async () => {
    vi.mocked(getSubscriptionPlan).mockResolvedValue('none')
    expect(await invoke({ user: { collection: 'users' } } as PayloadRequest)).toBe(false)
    vi.mocked(getSubscriptionPlan).mockResolvedValue('premium')
    expect(
      await invoke({
        user: { collection: 'users' },
        payload: { find: vi.fn(async () => ({ docs: [], hasNextPage: false })) },
      } as unknown as PayloadRequest),
    ).toBe(false)
  })
})
