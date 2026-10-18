import type { Payload } from 'payload'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/publication-issues/[id]/send/route'
import { requireStaff } from '@/lib/requireStaff'
import { getSesClient } from './index'
import { queueNewsletter } from './sendIssue'
import { newsletterLiveConfig } from './live'
import { getPublicationRecipients } from '@/lib/publicationRecipients'

vi.mock('@/lib/requireStaff', () => ({ requireStaff: vi.fn() }))
vi.mock('@/lib/issueEmail', () => ({ renderIssueEmailHtml: () => '<body>Snapshot</body>' }))
vi.mock('@/lib/publicationAds', () => ({
  adSlotCount: () => 0,
  getActiveAdsForPublication: () => [],
}))
vi.mock('@/lib/ses', () => ({ getSesClient: vi.fn() }))
vi.mock('./live', () => ({ newsletterLiveConfig: vi.fn() }))
vi.mock('./sendIssue', () => ({
  queueNewsletter: vi.fn(),
  NewsletterError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message)
    }
  },
}))
vi.mock('@/lib/publicationRecipients', () => ({ getPublicationRecipients: vi.fn() }))
const findByID = vi.fn(),
  update = vi.fn(),
  sendBulk = vi.fn()
const payload = { findByID, update } as unknown as Payload
const issue = {
  id: 13,
  title: 'Edition',
  _status: 'published',
  format: 'excerpt-list',
  publication: { id: 7, title: 'Publication' },
  email: { status: 'not sent' },
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SES_MODE', 'live')
  vi.stubEnv('EMAIL_PROVIDER', '')
  vi.stubEnv('EMAIL_SAFE_MODE', 'on')
  vi.stubEnv('EMAIL_SAFE_MODE_REDIRECT_TO', 'safe@example.invalid')
  vi.mocked(requireStaff).mockResolvedValue({
    payload,
    user: { id: 2, collection: 'staff' },
  } as Awaited<ReturnType<typeof requireStaff>>)
  findByID.mockResolvedValue(issue)
  vi.mocked(getSesClient).mockReturnValue({ sendBulk })
  sendBulk.mockResolvedValue({ messageCount: 1 })
  vi.mocked(queueNewsletter).mockResolvedValue({ queued: true, jobId: 3 })
  vi.mocked(getPublicationRecipients).mockResolvedValue([
    { email: 'user@example.invalid', userId: 8 },
  ])
})
afterEach(() => vi.unstubAllEnvs())
const call = (body: unknown) =>
  POST(
    new Request('https://beta.example.invalid/api/publication-issues/13/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: '13' }) },
  )
it('requires publication before audience delivery, while allowing a test of a draft', async () => {
  findByID.mockResolvedValue({ ...issue, _status: 'draft' })
  expect((await call({})).status).toBe(409)
  expect(queueNewsletter).not.toHaveBeenCalled()
  expect((await call({ test: true, testEmail: 'user@example.invalid' })).status).toBe(200)
  expect(sendBulk).toHaveBeenCalledWith(
    expect.objectContaining({ test: true, recipients: [{ email: 'user@example.invalid' }] }),
  )
  expect(update).not.toHaveBeenCalled()
})
it('defaults to SES and queues the snapshot instead of sending in the HTTP request', async () => {
  const response = await call({})
  expect(response.status).toBe(202)
  expect(queueNewsletter).toHaveBeenCalledWith(
    payload,
    13,
    '<body>Snapshot</body>',
    2,
    [],
    false,
  )
  expect(sendBulk).not.toHaveBeenCalled()
})
it.each(['excerpt-list', 'pdf-report', 'custom-html'])('uses the issue title for %s test emails despite a historical override', async format => {
  findByID.mockResolvedValue({ ...issue, format, email: { ...issue.email, subject: 'Ignored historical subject' } })
  expect((await call({ test: true, testEmail: 'user@example.invalid' })).status).toBe(200)
  expect(sendBulk).toHaveBeenCalledWith(expect.objectContaining({ subject: `[TEST] ${issue.title}` }))
})
it('keeps simulation visibly separate from actual delivery and leaves the issue unsent', async () => {
  vi.stubEnv('SES_MODE', 'simulated')
  const response = await call({})
  expect(await response.json()).toMatchObject({ mode: 'simulated', sent: 'simulated' })
  expect(update).not.toHaveBeenCalled()
  expect(queueNewsletter).not.toHaveBeenCalled()
})
it('reports the actual safe destination, validates one test address, and leaves campaign state untouched', async () => {
  expect(
    (await call({ test: true, testEmail: 'two@example.invalid,three@example.invalid' })).status,
  ).toBe(400)
  const response = await call({ test: true, testEmail: 'user@example.invalid' })
  expect(await response.json()).toMatchObject({ testEmail: 'safe@example.invalid', mode: 'live' })
  expect(update).not.toHaveBeenCalled()
})
it('fails with an actionable configuration error before contacting SES', async () => {
  vi.mocked(newsletterLiveConfig).mockImplementation(() => {
    throw new Error('SES_CONFIGURATION_SET missing')
  })
  const response = await call({ test: true, testEmail: 'user@example.invalid' })
  expect(response.status).toBe(503)
  expect((await response.json()).error).toContain('SES_CONFIGURATION_SET')
  expect(sendBulk).not.toHaveBeenCalled()
})
