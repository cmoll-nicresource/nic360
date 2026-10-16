import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireStaff: vi.fn(), report: vi.fn() }))
vi.mock('@/lib/requireStaff', () => ({ requireStaff: mocks.requireStaff }))
vi.mock('@/lib/companyUsage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/companyUsage')>()),
  getCompanyUsage: mocks.report,
}))
import { GET } from './route'
beforeEach(() => {
  vi.resetAllMocks()
})
it('returns the authorization failure without querying usage', async () => {
  mocks.requireStaff.mockRejectedValue(new Response('Staff access required.', { status: 403 }))
  expect(
    (await GET(new Request('https://example.invalid/api/admin/company-reports/export'))).status,
  ).toBe(403)
  expect(mocks.report).not.toHaveBeenCalled()
})
it('rejects malformed date ranges without querying usage', async () => {
  mocks.requireStaff.mockResolvedValue({ payload: {}, user: {} })
  const result = await GET(
    new Request(
      'https://example.invalid/api/admin/company-reports/export?providerId=1&from=2026-10-16&to=2026-10-01',
    ),
  )
  expect(result.status).toBe(400)
  expect(mocks.report).not.toHaveBeenCalled()
})
it('downloads a private CSV with safe filename and no cached personal data', async () => {
  mocks.requireStaff.mockResolvedValue({ payload: {}, user: {} })
  mocks.report.mockResolvedValue({
    provider: { id: 1, name: 'Example' },
    from: '2026-10-01',
    to: '2026-10-16',
    rows: [],
    totals: { users: 0, active: 0, views: 0 },
  })
  const result = await GET(
    new Request(
      'https://example.invalid/api/admin/company-reports/export?providerId=1&from=2026-10-01&to=2026-10-16',
    ),
  )
  expect(result.status).toBe(200)
  expect(result.headers.get('cache-control')).toBe('private, no-store')
  expect(result.headers.get('content-disposition')).toContain(
    'company-1-usage-2026-10-01-2026-10-16.csv',
  )
  expect(await result.text()).toContain('Active days (ET)')
})
