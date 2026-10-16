import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { repairPublicationSelectionRules } from './repairPublicationSelectionRules'
it('repairs migrated Vapor terms, preserves other filters and is repeatable', async () => {
  const publication = {
    id: 121,
    slug: 'vapor-news-clippings',
    title: 'Vapor News Clippings',
    selectionRules: {
      excerptTypes: ['articles'],
      products: { include: [75], exclude: [] },
      subjects: { include: [9] },
    },
  }
  const find = vi.fn(async ({ collection }: { collection: string }) => ({
    docs:
      collection === 'locations'
        ? [{ id: 185 }]
        : collection === 'products'
          ? [{ id: 75 }, { id: 80 }, { id: 85 }, { id: 87 }]
          : [publication],
    hasNextPage: false,
  }))
  const update = vi.fn(async ({ data }: { data: { selectionRules: unknown } }) => {
    publication.selectionRules = data.selectionRules as typeof publication.selectionRules
  })
  const payload = { find, update } as unknown as Payload
  const preview = await repairPublicationSelectionRules(payload)
  expect(preview.changes[0].after.products?.include).toEqual([75, 80, 85, 87])
  expect(update).not.toHaveBeenCalled()
  await repairPublicationSelectionRules(payload, true)
  expect(publication.selectionRules.subjects).toEqual({ include: [9] })
  expect((await repairPublicationSelectionRules(payload)).changes).toEqual([])
})
