import { beforeEach, expect, it, vi } from 'vitest'
import { lexicalToPlainText } from '@/lib/lexical'
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), create: vi.fn(), get: vi.fn() }))
vi.mock('payload', () => ({ getPayload: m.get }))
vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('@/lib/clipperAuth', () => ({ authenticateClipper: async () => (await m.auth()).user }))
import { POST } from './route'

const clip = { title: 'A clipped story', sourceUrl: 'https://news.example/story?utm_source=mail#top',
  sourceDate: '2026-10-17T09:30:00-04:00', excerptText: 'Edited draft excerpt',
  socialPreview: { description: 'Original social preview', imageUrl: 'https://news.example/preview.jpg' }, locationIds: [3] }
const request = (body: unknown) => new Request('https://site.example/api/extension/articles', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'chrome-extension://kcefkjklicckafaelknkgnnjmgnnncpm' }, body: JSON.stringify(body),
})
beforeEach(() => {
  vi.resetAllMocks()
  m.get.mockResolvedValue(m)
  m.auth.mockResolvedValue({ user: { id: 1, collection: 'staff', role: 'editor' } })
  m.find.mockImplementation(async ({ collection }) => ({ docs: collection === 'locations' ? [{ id: 3 }] : collection === 'sources' ? [{ id: 2 }] : [] }))
  m.create.mockResolvedValue({ id: 7 })
})
it('saves preview, reviewed excerpt, date and selected existing locations as an unpublished draft', async () => {
  const response = await POST(request({ ...clip, _status: 'published', sourceDomain: 'untrusted.example' }))
  expect(response.status).toBe(200)
  const saved = m.create.mock.calls[0][0]
  expect(saved.draft).toBe(true)
  expect(saved.overrideAccess).toBe(false)
  expect(saved.data.sourceDate).toBe('2026-10-17T13:30:00.000Z')
  expect(saved.data.sourceUrl).toBe('https://news.example/story')
  expect(saved.data.socialPreview).toEqual(clip.socialPreview)
  expect(saved.data.locations).toEqual([3])
  expect(lexicalToPlainText(saved.data.excerpt)).toBe('Edited draft excerpt')
  expect(saved.data._status).not.toBe('published')
  expect(saved.data.products).toBeUndefined()
  expect(m.find.mock.calls.find(([args]) => args.collection === 'sources')![0].where.domain.equals).toBe('news.example')
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://kcefkjklicckafaelknkgnnjmgnnncpm')
})
it.each([{ sourceDate: 'not a date' }, { sourceDate: '2026-02-30' }, { sourceUrl: 'javascript:alert(1)' },
  { socialPreview: { imageUrl: 'http://news.example/image' } }, { locationIds: ['3'] }, { locationIds: Array(21).fill(3) }])
('rejects invalid metadata without creating a record: %j', async extra => {
  expect((await POST(request({ ...clip, ...extra }))).status).toBe(400)
  expect(m.create).not.toHaveBeenCalled()
})
it('rejects an unknown location instead of silently creating taxonomy', async () => {
  m.find.mockResolvedValue({ docs: [] })
  expect((await POST(request(clip))).status).toBe(400)
  expect(m.create).not.toHaveBeenCalled()
})
it('recognizes an existing draft URL and leaves it unchanged', async () => {
  m.find.mockImplementation(async ({ collection }) => ({ docs: collection === 'locations' ? [{ id: 3 }] : [{ id: 99 }] }))
  const response = await POST(request(clip))
  expect(await response.json()).toMatchObject({ duplicate: true, id: 99 })
  expect(m.create).not.toHaveBeenCalled()
  expect(m.find.mock.calls.find(([args]) => args.collection === 'articles')![0].draft).toBe(true)
})
it('does not invent a date or turn an absent excerpt into a duplicate headline', async () => {
  await POST(request({ title: 'Only title available', sourceUrl: 'https://news.example/other' }))
  expect(m.create.mock.calls[0][0].data.sourceDate).toBeUndefined()
  expect(m.create.mock.calls[0][0].data.excerpt).toBeUndefined()
})
it('denies subscriber and anonymous imports before any writes', async () => {
  for (const user of [null, { id: 1, collection: 'users' }]) {
    m.auth.mockResolvedValue({ user })
    expect((await POST(request(clip))).status).toBe(401)
  }
  expect(m.find).not.toHaveBeenCalled()
  expect(m.create).not.toHaveBeenCalled()
})
