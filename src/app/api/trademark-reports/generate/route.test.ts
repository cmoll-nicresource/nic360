import { beforeEach, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { requireStaff } from '@/lib/requireStaff'
import { buildTrademarkReportIssues } from '@/lib/trademarkReportIssues'
import { POST } from './route'
import { IncompleteTrademarkMonthError } from '@/lib/tmog/monthlyCoverage'

vi.mock('@/lib/requireStaff', () => ({ requireStaff: vi.fn() }))
vi.mock('@/lib/trademarkReportIssues', () => ({ buildTrademarkReportIssues: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('returns a visible 409 error listing the missing weekly imports for a monthly report', async () => {
  vi.mocked(requireStaff).mockResolvedValueOnce({ payload: {} as Payload, user: null })
  vi.mocked(buildTrademarkReportIssues).mockRejectedValueOnce(
    new IncompleteTrademarkMonthError(['2026-09-08'], new Date('2026-09-01')),
  )
  const result = await POST(
    new Request('http://localhost/api/trademark-reports/generate', {
      method: 'POST',
      body: JSON.stringify({ kind: 'monthly', period: '2026-09' }),
    }),
  )
  expect(result.status).toBe(409)
  expect(await result.json()).toMatchObject({
    code: 'INCOMPLETE_TRADEMARK_MONTH',
    missingIssueDates: ['2026-09-08'],
    error: expect.stringContaining('20260908'),
  })
})
it('requires a gatekeeper before reading input or writing a report', async () => {
  vi.mocked(requireStaff).mockRejectedValueOnce(new Response('Forbidden', { status: 403 }))
  const result = await POST(
    new Request('http://localhost/api/trademark-reports/generate', { method: 'POST' }),
  )
  expect(result.status).toBe(403)
  expect(requireStaff).toHaveBeenCalledWith('gatekeeper')
  expect(buildTrademarkReportIssues).not.toHaveBeenCalled()
})
it('returns 400 for invalid dates without generating a report', async () => {
  vi.mocked(requireStaff).mockResolvedValueOnce({ payload: {} as Payload, user: null })
  const result = await POST(
    new Request('http://localhost/api/trademark-reports/generate', {
      method: 'POST',
      body: JSON.stringify({ kind: 'weekly', period: '2026-02-30' }),
    }),
  )
  expect(result.status).toBe(400)
  expect(buildTrademarkReportIssues).not.toHaveBeenCalled()
})
it('generates only the requested month and returns links to the new draft IDs', async () => {
  const payload = {} as Payload
  vi.mocked(requireStaff).mockResolvedValueOnce({ payload, user: null })
  vi.mocked(buildTrademarkReportIssues).mockResolvedValueOnce([123])
  const result = await POST(
    new Request('http://localhost/api/trademark-reports/generate', {
      method: 'POST',
      body: JSON.stringify({ kind: 'monthly', period: '2026-09' }),
    }),
  )
  expect(buildTrademarkReportIssues).toHaveBeenCalledWith(payload, {
    asOf: new Date('2026-10-01'),
    weekly: false,
    monthly: true,
  })
  expect(await result.json()).toEqual({ issuesCreated: [123] })
})
