import type { Payload } from 'payload'
import fs from 'node:fs/promises'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTrademarkReportIssues, trademarkReportPeriods } from './trademarkReportIssues'
import { parseReportRequest } from './tmog/reportRequest'
import { renderTrademarkPdf } from './tmog/reportPdf'

vi.mock('./tmog/reportPdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tmog/reportPdf')>()),
  renderTrademarkPdf: vi.fn(async () => Buffer.from('%PDF-test')),
}))

const mark = { id: 1, title: 'Example mark', serialNumber: '12345678' }
function cms() {
  const find = vi.fn(
    async (args: { collection: string; where?: Record<string, unknown>; page?: number }) => {
      if (args.collection === 'publications')
        return { docs: [{ id: 8, title: 'US Trademark Report' }] }
      return { docs: [mark], hasNextPage: false }
    },
  )
  const create = vi.fn(async (args: { collection: string }) => ({
    id: args.collection === 'guide-files' ? 30 : 40,
  }))
  const remove = vi.fn(async () => ({}))
  return {
    payload: { find, create, delete: remove, logger: { warn: vi.fn() } } as unknown as Payload,
    find,
    create,
    remove,
  }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})
describe('trademark report periods and requests', () => {
  it.each(['2026-01-03', '2026-03-31', '2024-03-02'])(
    'uses complete prior calendar months for %s',
    (input) => {
      const { monthStart, monthEnd, start, end } = trademarkReportPeriods(new Date(input))
      expect(monthStart.getUTCDate()).toBe(1)
      expect(monthEnd.getUTCDate()).toBe(1)
      expect(monthEnd.getUTCMonth()).toBe(new Date(input).getUTCMonth())
      expect(end.getTime() - start.getTime()).toBe(7 * 86400000)
    },
  )
  it('handles leap years and December rollover', () => {
    expect(trademarkReportPeriods(new Date('2024-03-02')).monthStart.toISOString()).toBe(
      '2024-02-01T00:00:00.000Z',
    )
    expect(parseReportRequest({ kind: 'monthly', period: '2026-12' })).toEqual({
      asOf: new Date('2027-01-01'),
      weekly: false,
      monthly: true,
    })
  })
  it.each([
    null,
    {},
    { kind: 'weekly', period: '2026-02-30' },
    { kind: 'monthly', period: '2026-13' },
    { kind: 'weekly', period: '20261013' },
    { kind: 'other', period: '2026-10-13' },
  ])('rejects malformed dates or report kinds: %j', (input) => {
    expect(() => parseReportRequest(input)).toThrow()
  })
})

describe('trademark report generation', () => {
  it.each([true, false])(
    'includes stored artwork when available (%s) without dropping a record when it is missing',
    async (available) => {
      vi.stubEnv('S3_BUCKET', '')
      const { payload, find } = cms()
      Object.assign(payload, {
        collections: { media: { config: { upload: { staticDir: 'media' } } } },
      })
      const png = await sharp({
        create: { width: 20, height: 20, channels: 4, background: '#285888' },
      })
        .png()
        .toBuffer()
      const read = vi.spyOn(fs, 'readFile')
      if (available) read.mockResolvedValueOnce(png)
      else read.mockRejectedValueOnce(new Error('Missing image'))
      find.mockImplementation(async (args) =>
        args.collection === 'publications'
          ? { docs: [{ id: 8, title: 'Weekly report' }] }
          : {
              docs: [
                {
                  ...mark,
                  image: {
                    id: 7,
                    filename: 'mark.png',
                    mimeType: 'image/png',
                    url: 'https://untrusted.example/unused',
                  },
                },
              ],
              hasNextPage: false,
            },
      )
      await buildTrademarkReportIssues(payload, { monthly: false })
      const marks = vi.mocked(renderTrademarkPdf).mock.calls[0][0].sections[0].marks
      expect(marks).toHaveLength(1)
      expect(Buffer.isBuffer(marks[0].reportImage)).toBe(available)
      if (!available) expect(payload.logger.warn).toHaveBeenCalledOnce()
    },
  )
  it('uses the Gazette reporting date, including an upcoming issue, and reads past 500 rows', async () => {
    const { payload, find, create } = cms()
    find.mockImplementation(async (args) =>
      args.collection === 'publications'
        ? { docs: [{ id: 8, title: 'Weekly report' }] }
        : {
            docs:
              args.page === 1
                ? Array.from({ length: 500 }, (_, i) => ({ ...mark, id: i + 1 }))
                : [{ ...mark, id: 501 }],
            hasNextPage: args.page === 1,
          },
    )
    await buildTrademarkReportIssues(payload, { asOf: new Date('2026-10-20'), monthly: false })
    const queries = find.mock.calls
      .map(([args]) => args)
      .filter((args) => args.collection === 'trademarks')
    expect(queries).toHaveLength(2)
    expect(queries[0].where).toEqual({
      publishedDate: {
        greater_than_equal: '2026-10-14T00:00:00.000Z',
        less_than: '2026-10-21T00:00:00.000Z',
      },
    })
    expect(vi.mocked(renderTrademarkPdf).mock.calls[0][0].sections[0].marks).toHaveLength(501)
    expect(create.mock.calls[1][0]).toMatchObject({
      collection: 'publication-issues',
      data: { _status: 'draft', file: 30, issueDate: '2026-10-20T00:00:00.000Z' },
    })
    expect(create.mock.calls[0][0]).toMatchObject({
      file: { mimetype: 'application/pdf', data: Buffer.from('%PDF-test') },
    })
  })
  it('includes bounded monthly publications, cancellations and renewals with counts from actual records', async () => {
    const { payload, find, create } = cms()
    find.mockImplementation(async (args) => {
      if (args.collection === 'publications') return { docs: [{ id: 8, title: 'Monthly report' }] }
      return {
        docs: args.where && 'renewedDate' in args.where ? [mark, { ...mark, id: 2 }] : [mark],
        hasNextPage: false,
      }
    })
    await buildTrademarkReportIssues(payload, { asOf: new Date('2026-10-06'), weekly: false })
    const queries = find.mock.calls
      .map(([args]) => args)
      .filter((args) => args.collection === 'trademarks')
    expect(queries.map((q) => q.where)).toEqual(
      ['publishedDate', 'cancelledDate', 'renewedDate'].map((field) => ({
        [field]: {
          greater_than_equal: '2026-09-01T00:00:00.000Z',
          less_than: '2026-10-01T00:00:00.000Z',
        },
      })),
    )
    expect(
      vi.mocked(renderTrademarkPdf).mock.calls[0][0].sections.map((s) => s.marks.length),
    ).toEqual([1, 1, 2])
    expect(JSON.stringify(create.mock.calls)).toContain(
      '1 marks published for opposition, 1 cancellations and 2 renewals in September 2026.',
    )
  })
  it('blocks a monthly report before any PDF or draft is created when even one week is missing', async () => {
    const { payload, find, create } = cms()
    find.mockImplementation(async (args) => ({
      docs: JSON.stringify(args.where).includes('2026-09-15') ? [] : [mark],
      hasNextPage: false,
    }))
    await expect(
      buildTrademarkReportIssues(payload, { asOf: new Date('2026-10-01') }),
    ).rejects.toMatchObject({ missingIssueDates: ['2026-09-15'] })
    expect(create).not.toHaveBeenCalled()
    expect(renderTrademarkPdf).not.toHaveBeenCalled()
    expect(find.mock.calls.every(([args]) => args.collection === 'trademark-import-runs')).toBe(
      true,
    )
  })
  it('generates a monthly report when the month only contains newly published marks', async () => {
    const { payload, find } = cms()
    find.mockImplementation(async (args) => {
      if (args.collection === 'publications') return { docs: [{ id: 8, title: 'Monthly report' }] }
      if (args.collection === 'trademark-import-runs') return { docs: [mark] }
      return { docs: args.where && 'publishedDate' in args.where ? [mark] : [], hasNextPage: false }
    })
    expect(
      await buildTrademarkReportIssues(payload, { asOf: new Date('2026-10-01'), weekly: false }),
    ).toEqual([40])
    expect(
      vi
        .mocked(renderTrademarkPdf)
        .mock.calls[0][0].sections.map((section) => section.marks.length),
    ).toEqual([1, 0, 0])
  })
  it('does not create empty reports or run an automatic monthly report after the first week', async () => {
    const { payload, find, create } = cms()
    find.mockResolvedValue({ docs: [], hasNextPage: false })
    expect(await buildTrademarkReportIssues(payload, { asOf: new Date('2026-10-13') })).toEqual([])
    expect(find).toHaveBeenCalledTimes(1)
    expect(create).not.toHaveBeenCalled()
  })
  it('cleans up the uploaded PDF if draft creation fails', async () => {
    const { payload, create, remove } = cms()
    create.mockRejectedValueOnce(new Error('Upload failed'))
    await expect(buildTrademarkReportIssues(payload, { monthly: false })).rejects.toThrow(
      'Upload failed',
    )
    expect(remove).not.toHaveBeenCalled()
    create.mockResolvedValueOnce({ id: 30 }).mockRejectedValueOnce(new Error('Draft failed'))
    await expect(buildTrademarkReportIssues(payload, { monthly: false })).rejects.toThrow(
      'Draft failed',
    )
    expect(remove).toHaveBeenCalledWith({ collection: 'guide-files', id: 30, overrideAccess: true })
  })
})
