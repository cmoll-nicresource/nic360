import type { Payload } from 'payload'
import { expect, it, vi } from 'vitest'
import { getPublicationRecipients } from './publicationRecipients'
it('reads every audience page, filters suppression and plans, and deduplicates addresses', async () => {
  const provider = { plan: 'base', status: 'live' }
  const find = vi
    .fn()
    .mockResolvedValueOnce({
      docs: [{ recipientEmail: 'suppressed@example.invalid' }],
      hasNextPage: false,
    })
    .mockResolvedValueOnce({
      docs: [
        { id: 1, email: 'Suppressed@Example.invalid', accessProvider: provider },
        { id: 2, email: 'none@example.invalid', accessProvider: null },
        { id: 3, email: 'reader@example.invalid', accessProvider: provider },
      ],
      hasNextPage: true,
    })
    .mockResolvedValueOnce({
      docs: [
        { id: 4, email: 'Reader@Example.invalid', accessProvider: provider },
        { id: 5, email: 'last@example.invalid', accessProvider: provider },
      ],
      hasNextPage: false,
    })
  expect(await getPublicationRecipients({ find } as unknown as Payload, 7)).toEqual([
    { email: 'reader@example.invalid', userId: 3 },
    { email: 'last@example.invalid', userId: 5 },
  ])
  expect(find.mock.calls[1][0].where.and).toContainEqual({ status: { equals: 'active' } })
  expect(find.mock.calls[1][0].where.and).toContainEqual({ _verified: { equals: true } })
  expect(find.mock.calls[2][0].page).toBe(2)
})
