import type { PayloadRequest } from 'payload'
import { expect, it, vi } from 'vitest'
import { publicationFileUrl, usePublicationFileUrl } from './publicationFileUrl'

it('gives an already-attached publication PDF its publication URL without modifying file metadata', async () => {
  const find = vi.fn(async () => ({ docs: [{ id: 9 }] }))
  const req = { payload: { find } } as unknown as PayloadRequest
  const doc = {
    id: 3,
    filename: 'Monthly report.pdf',
    url: '/api/guide-files/file/Monthly%20report.pdf',
    filesize: 100,
  }
  const args = { doc, req } as Parameters<typeof usePublicationFileUrl>[0]
  expect(await usePublicationFileUrl(args)).toEqual({
    ...doc,
    url: '/api/publication-files/file/Monthly%20report.pdf',
  })
  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'publication-issues',
      where: { file: { equals: 3 } },
      depth: 0,
      limit: 1,
      req,
    }),
  )
  expect(doc.url).toContain('/guide-files/')
})

it('leaves a guide-only attachment on its existing guide URL', async () => {
  const find = vi.fn(async () => ({ docs: [] }))
  const req = { payload: { find } } as unknown as PayloadRequest
  const doc = { id: 3, filename: 'guide.pdf', url: '/api/guide-files/file/guide.pdf' }
  expect(
    await usePublicationFileUrl({ doc, req } as Parameters<
      typeof usePublicationFileUrl
    >[0]),
  ).toBe(doc)
})

it('escapes filenames as one URL segment', () => {
  expect(publicationFileUrl('report #1.pdf')).toBe('/api/publication-files/file/report%20%231.pdf')
})
