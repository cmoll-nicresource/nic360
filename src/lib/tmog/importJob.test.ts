import type { Payload } from 'payload'
import { beforeEach, expect, it, vi } from 'vitest'
import { buildTrademarkReportIssues } from '@/lib/trademarkReportIssues'
import { fetchSpecificIssue } from './fetchIssue'
import { parseTrademarkIssue, type ParsedTrademark } from './parseIssue'
import { runTmogImportJob } from './importJob'
import { IncompleteTrademarkMonthError } from './monthlyCoverage'

vi.mock('@/lib/trademarkReportIssues', () => ({
  buildTrademarkReportIssues: vi.fn(async () => [123]),
}))
vi.mock('./fetchIssue', () => ({
  candidateIssueDates: vi.fn(() => ['20261013']),
  fetchSpecificIssue: vi.fn(),
}))
vi.mock('./parseIssue', () => ({ parseTrademarkIssue: vi.fn() }))
vi.mock('./images', () => ({
  createThrottle: vi.fn(() => vi.fn()),
  fetchAndStoreTrademarkImage: vi.fn(),
}))
beforeEach(() => vi.clearAllMocks())

it('uses the Gazette date for publication even when the status snapshot is weeks old, and passes it to report generation', async () => {
  vi.mocked(fetchSpecificIssue).mockResolvedValue({
    issueDate: '20261013',
    url: 'https://cdn.uspto.gov/fixture',
    response: new Response('<fixture/>'),
  })
  const records: ParsedTrademark[] = [
    {
      serial: '99000001',
      markText: 'Published mark',
      registrationNumber: '',
      owner: 'Example Owner',
      goods: 'Tobacco',
      imageFileName: '',
      status: 'published',
      statusDate: '2026-09-22',
    },
    {
      serial: '99000002',
      markText: 'Renewed mark',
      registrationNumber: '1234567',
      owner: 'Renewal Owner',
      goods: 'Tobacco',
      imageFileName: '',
      status: 'renewed',
      statusDate: '2026-09-28',
    },
  ]
  vi.mocked(parseTrademarkIssue).mockImplementation(async function* () {
    yield* records
  })
  const find = vi.fn(async () => ({ docs: [], totalDocs: 0 }))
  const create = vi.fn(async (args: { collection: string; data?: unknown }) => ({
    id: args.collection === 'trademark-import-runs' ? 1 : 2,
  }))
  const update = vi.fn(async () => ({ id: 1, status: 'succeeded' }))
  const payload = { find, create, update } as unknown as Payload
  await runTmogImportJob(payload, '20261013')
  expect(create.mock.calls[1][0]).toMatchObject({
    collection: 'trademarks',
    data: { class: '34', publishedDate: '2026-10-13T00:00:00.000Z' },
  })
  expect(create.mock.calls[2][0]).toMatchObject({
    collection: 'trademarks',
    data: { renewedDate: '2026-09-28' },
  })
  expect(buildTrademarkReportIssues).toHaveBeenCalledWith(payload, {
    asOf: new Date('2026-10-13'),
    monthly: false,
  })
})

it('keeps a fully imported week successful while recording a visible error for a blocked monthly report', async () => {
  vi.mocked(fetchSpecificIssue).mockResolvedValue({
    issueDate: '20261006',
    url: 'https://cdn.uspto.gov/doc/TMOGIssue_20261006_entire?extension=xml',
    response: new Response('<fixture/>'),
  })
  vi.mocked(parseTrademarkIssue).mockImplementation(async function* () {})
  vi.mocked(buildTrademarkReportIssues)
    .mockResolvedValueOnce([123])
    .mockRejectedValueOnce(
      new IncompleteTrademarkMonthError(['2026-09-08'], new Date('2026-09-01')),
    )
  const update = vi.fn(async (args: { data: unknown }) => ({ id: 1, ...(args.data as object) }))
  const payload = {
    create: vi.fn(async () => ({ id: 1 })),
    update,
    logger: { error: vi.fn() },
  } as unknown as Payload
  const result = await runTmogImportJob(payload, '20261006')
  expect(result.run).toMatchObject({
    status: 'succeeded',
    issuesCreated: [123],
    error: expect.stringContaining('20260908'),
  })
  expect(buildTrademarkReportIssues).toHaveBeenNthCalledWith(2, payload, {
    asOf: new Date('2026-10-06'),
    weekly: false,
    monthly: true,
  })
})
