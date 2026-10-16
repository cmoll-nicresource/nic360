import type { Payload } from 'payload'
import { beforeEach, expect, it, vi } from 'vitest'
import { previewIssue } from './issuePreview'
import { POST } from '@/app/api/publication-issues/preview/route'
import { requireStaff } from '@/lib/requireStaff'

vi.mock('@/lib/requireStaff', () => ({ requireStaff: vi.fn() }))
const findByID = vi.fn(),
  find = vi.fn(),
  create = vi.fn(),
  update = vi.fn(),
  sendEmail = vi.fn()
const payload = { findByID, find, create, update, sendEmail } as unknown as Payload
beforeEach(() => {
  vi.clearAllMocks()
  find.mockResolvedValue({ docs: [] })
  findByID.mockImplementation(async ({ collection, id }) =>
    collection === 'publications'
      ? { id, title: 'Daily briefing', header: '<p>Publication header</p>' }
      : collection === 'guide-files'
        ? {
            id,
            filename: 'protected report.pdf',
            url: '/api/publication-files/file/protected%20report.pdf',
          }
        : { id, title: 'Resolved article title' },
  )
  vi.mocked(requireStaff).mockResolvedValue({ payload } as Awaited<ReturnType<typeof requireStaff>>)
})
it('renders unsaved content and resolves IDs without saving or sending', async () => {
  const result = await previewIssue(payload, {
    publication: 7,
    title: 'Unsaved headline',
    format: 'excerpt-list',
    sections: [{ heading: 'Policy', items: [{ relationTo: 'articles', value: 12 }] }],
  })
  expect(result.subject).toBe('Unsaved headline')
  expect(result.html).toContain('Resolved article title')
  expect(result.html).toContain('Publication header')
  expect(result.html).toContain('Unsubscribe from publication emails')
  expect(result.html).toContain('Content-Security-Policy')
  expect(result.pdfUrl).toBeNull()
  expect(create).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
  expect(sendEmail).not.toHaveBeenCalled()
})
it('uses only the protected file handler for embedded PDFs', async () => {
  const result = await previewIssue(payload, {
    publication: 7,
    title: 'PDF',
    format: 'pdf-report',
    file: 9,
  })
  expect(result.pdfUrl).toBe('/api/publication-files/file/protected%20report.pdf')
  expect(result.html).toContain('Download the full report')
})
it('previews custom HTML and unsaved email metadata', async () => {
  const result = await previewIssue(payload, {
    publication: 7,
    format: 'custom-html',
    body: '<h1>Unsaved body</h1>',
    email: { subject: 'Changed subject', previewText: 'Changed preview' },
  })
  expect(result.subject).toBe('Changed subject')
  expect(result.html).toContain('Unsaved body')
  expect(result.previewText).toBe('Changed preview')
})
it('does not expose live ad tracking links', async () => {
  find.mockResolvedValue({ docs: [{ id: 5, image: { url: '/photo.jpg' } }] })
  const result = await previewIssue(payload, { publication: 7, format: 'pdf-report' })
  expect(result.html).not.toContain('/api/ads/5/click')
})
it('rejects invalid collections and requires staff before resolving content', async () => {
  vi.mocked(requireStaff).mockRejectedValue(new Response('Forbidden', { status: 403 }))
  expect(
    (
      await POST(
        new Request('http://localhost/api/publication-issues/preview', {
          method: 'POST',
          body: '{}',
        }),
      )
    ).status,
  ).toBe(403)
  expect(findByID).not.toHaveBeenCalled()
  await expect(previewIssue(payload, { publication: 7, format: 'bad' as never })).rejects.toThrow(
    'format',
  )
})
it('returns an uncached preview of a new unsaved issue', async () => {
  const response = await POST(
    new Request('http://localhost/api/publication-issues/preview', {
      method: 'POST',
      body: JSON.stringify({ publication: 7, format: 'custom-html', body: '<p>New draft</p>' }),
    }),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect((await response.json()).html).toContain('New draft')
})
