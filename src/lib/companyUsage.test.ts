import { describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import Papa from 'papaparse'
import { companyReportInput, companyUsageCsv, getCompanyUsage, usageRow } from './companyUsage'

describe('company usage reports', () => {
  it('requires a real provider ID and complete, ordered calendar dates', () => {
    expect(companyReportInput('12', '2026-02-28', '2026-03-01')).toEqual({
      providerId: 12,
      from: '2026-02-28',
      to: '2026-03-01',
    })
    for (const args of [
      ['0', '2026-01-01', '2026-01-02'],
      ['1 OR 1=1', '2026-01-01', '2026-01-02'],
      ['9007199254740992', '2026-01-01', '2026-01-02'],
      ['1', '2026-02-29', '2026-03-01'],
      ['1', '2026-04-31', '2026-05-01'],
      ['1', '', '2026-01-01'],
      ['1', '2026-01-02', '2026-01-01'],
    ])
      expect(() => companyReportInput(args[0], args[1], args[2])).toThrow()
  })
  it('combines page categories without losing repeated views or empty users', () => {
    const row = usageRow({
      id: 1,
      email: 'a@example.invalid',
      first_name: 'A',
      last_name: 'Reader',
      status: 'active',
      views: 4,
      pages: 3,
      days: 2,
      first_view: '2026-10-01T04:00:00Z',
      last_view: '2026-10-02T12:00:00Z',
      paths: [
        { path: '/articles/a', count: 2 },
        { path: '/bills/b', count: 1 },
        { path: '/datasets', count: 1 },
      ],
    })
    expect(row.sections).toEqual([
      ['Tracking (News/Legislation/Trademarks)', 3],
      ['Data', 1],
    ])
    expect(row.firstView).toBe('2026-10-01T04:00:00.000Z')
    expect(
      usageRow({
        id: 2,
        email: 'b@example.invalid',
        first_name: null,
        last_name: null,
        status: 'suspended',
        views: 0,
        pages: 0,
        days: 0,
        first_view: null,
        last_view: null,
        paths: [],
      }).lastView,
    ).toBeNull()
  })
  it('denies readers, editors and anonymous callers before accessing private data', async () => {
    const query = vi.fn(),
      payload = { db: { pool: { query } }, findByID: vi.fn() } as unknown as Payload
    for (const user of [
      null,
      { id: 1, collection: 'users', role: 'admin' },
      { id: 2, collection: 'staff', role: 'editor' },
    ]) {
      await expect(
        getCompanyUsage(
          payload,
          user as PayloadRequest['user'],
          companyReportInput('1', '2026-10-01', '2026-10-16'),
        ),
      ).rejects.toMatchObject({ status: 403 })
    }
    expect(query).not.toHaveBeenCalled()
    expect(payload.findByID).not.toHaveBeenCalled()
  })
  it('keeps inactive accounts in totals and binds parameters instead of interpolating input', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 1,
          email: 'reader@example.invalid',
          status: 'suspended',
          views: 0,
          pages: 0,
          days: 0,
          first_view: null,
          last_view: null,
          paths: [],
        },
      ],
    })
    const payload = {
      db: { pool: { query } },
      findByID: vi.fn().mockResolvedValue({ id: 12, name: 'Example' }),
    } as unknown as Payload
    const report = await getCompanyUsage(
      payload,
      { id: 1, collection: 'staff', role: 'gatekeeper' } as PayloadRequest['user'],
      companyReportInput('12', '2026-10-01', '2026-10-16'),
    )
    expect(report.totals).toEqual({ users: 1, active: 0, views: 0 })
    expect(query.mock.calls[0][1]).toEqual([12, '2026-10-01', '2026-10-16'])
  })
  it('exports readable CSV while neutralizing spreadsheet formulas', () => {
    const csv = companyUsageCsv({
      provider: { id: 1, name: '=HYPERLINK("x")' },
      from: '2026-10-01',
      to: '2026-10-16',
      totals: { users: 1, active: 0, views: 0 },
      rows: [
        {
          id: 1,
          name: '+Formula',
          email: 'reader@example.invalid',
          status: 'active',
          views: 0,
          pages: 0,
          days: 0,
          firstView: null,
          lastView: null,
          sections: [],
          topPages: [],
        },
      ],
    })
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true }).data[0]
    expect(parsed.Company).toBe('\'=HYPERLINK("x")')
    expect(parsed.Name).toBe("'+Formula")
    expect(parsed['Page views']).toBe('0')
  })
})
