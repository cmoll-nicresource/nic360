import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import layout from './fixtures/cbp-tobacco-layout.json'
import { cbpCandidateDates, cbpReportUrl, fetchLatestTrq, parseCbpPdf, parseTobaccoRows, type PdfText, type Trq } from './trq'
import { resolveReportInputs } from './reportInputs'

const date = '2026-10-13'
const now = new Date('2026-10-15T15:00:00Z')
const fixture = () => structuredClone(layout) as PdfText[][]
const raw = (day: string) => fs.readFileSync(`src/lib/ttb/fixtures/cbp-${day}.pdf`)
const expected: Trq = { periodLabel: 'Fixture', quotaYear: '2026/2027', rows: [{ country: 'Brazil', quota: 80200000, imported: 736386 }] }

describe('CBP tobacco extraction', () => {
  it.each([
    ['2026-10-05', 498786, 202400, 403991.44],
    ['2026-10-13', 736386, 625600, 491096.34],
  ] as const)('extracts the actual %s PDF with precise quantities and correct quota period', async (day, brazil, guatemala, eu) => {
    const result = await parseCbpPdf(raw(day), day)
    expect(result.rows).toHaveLength(11)
    expect(result.rows.find(r => r.country === 'Brazil')?.imported).toBe(brazil)
    expect(result.rows.find(r => r.country === 'Guatemala')?.imported).toBe(guatemala)
    expect(result.rows.find(r => r.country.includes('EUROC'))?.imported).toBe(eu)
    expect(result.rows.find(r => r.country === 'Others')?.imported).toBe(2523834.6)
    expect(result.rows.reduce((sum, r) => sum + r.quota, 0)).toBe(150700000)
    expect(result.rows.reduce((sum, r) => sum + r.imported, 0)).toBeCloseTo(day === '2026-10-13' ? 5434602.3 : 4686697.4, 2)
    expect(result.quotaYear).toBe('2026/2027')
    expect(result.periodLabel).toContain('September 13, 2026')
    expect(result.source?.releaseDate).toBe(day)
    expect(result.source?.excluded).toEqual(['CANADA', 'ISRAEL', 'MEXICO'])
    expect(result.source?.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.rows.find(r => r.country === 'Argentina')?.imported).toBe(0)
  })

  function editRow(pages: PdfText[][], country: string, text: string, change: string) {
    const p = pages.find(p => p.some(t => t.text === country && t.x > 350 && t.x < 440))!
    const anchor = p.find(t => t.text === country && t.x > 350 && t.x < 440)!
    const cell = p.find(t => Math.abs(t.y - anchor.y) < 1 && t.text === text)!
    cell.text = change
  }

  it('ignores Tobacco under FTA IDs beginning 99 and non-Tobacco rows beginning 24', () => {
    const pages = fixture()
    expect(pages.flat().some(t => t.text.startsWith('991824'))).toBe(true)
    const p = pages[3]
    const anchor = p.find(t => t.text === 'ARGENTINA')!
    const extra = p.filter(t => Math.abs(t.y - anchor.y) < 1).map(t => ({ ...t, y: t.y + 10000, text: t.text === 'Tobacco' ? 'Other commodity' : t.text }))
    p.push(...extra)
    expect(parseTobaccoRows(pages, date).rows).toHaveLength(11)
  })

  it.each([
    ['KG', 'LB'], ['736386', 'bad'], ['0.92%', '92.00%'], ['09/13/2027', '09/13/2025'],
  ])('rejects changed units, quantities, percentages or dates: %s -> %s', (from, to) => {
    const pages = fixture()
    editRow(pages, 'BRAZIL', from, to)
    expect(() => parseTobaccoRows(pages, date)).toThrow()
  })

  it('rejects partial tables, duplicated countries and mismatched release dates', () => {
    const pages = fixture()
    editRow(pages, 'BRAZIL', 'BRAZIL', 'ARGENTINA')
    expect(() => parseTobaccoRows(pages, date)).toThrow(/duplicate/)
    expect(() => parseTobaccoRows(fixture().slice(0, 3), date)).toThrow(/found 0/)
    expect(() => parseTobaccoRows(fixture(), '2026-10-05')).toThrow(/date/)
  })

  it('rejects missing headers and changed exclusions', () => {
    const pages = fixture()
    pages[0] = pages[0].filter(t => t.text !== 'Allocated')
    expect(() => parseTobaccoRows(pages, date)).toThrow(/header changed/)
    const excluded = fixture()
    editRow(excluded, 'CANADA', 'EXCL', 'OPEN')
    expect(() => parseTobaccoRows(excluded, date)).toThrow(/exclusion changed/)
  })
})

describe('CBP release lookup', () => {
  const pdf = () => new Response('%PDF-fixture', { headers: { 'content-type': 'application/pdf' } })
  const missing = () => new Response('', { status: 404 })

  it('finds the Tuesday holiday release and tries dates newest first', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => String(input).includes('26_1013_') ? pdf() : missing())
    const parse = vi.fn().mockResolvedValue(expected)
    expect(await fetchLatestTrq(now, fetcher, parse)).toBe(expected)
    expect(fetcher.mock.calls.map(([u]) => String(u))).toEqual(['2026-10-15', '2026-10-14', '2026-10-13'].map(cbpReportUrl))
    expect(parse.mock.calls[0][1]).toBe('2026-10-13')
  })

  it('falls back to the previous week if Monday and holiday Tuesday have not been posted', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => String(input).includes('26_1005_') ? pdf() : missing())
    const parse = vi.fn().mockResolvedValue(expected)
    await fetchLatestTrq(new Date('2026-10-13T15:00:00Z'), fetcher, parse)
    expect(parse.mock.calls[0][1]).toBe('2026-10-05')
    expect(fetcher.mock.calls).toHaveLength(9)
  })

  it('crosses month/year boundaries, uses Eastern dates and never requests a future day', () => {
    const dates = cbpCandidateDates(new Date('2027-01-01T02:00:00Z'))
    expect(dates[0]).toBe('2026-12-31')
    expect(dates).toHaveLength(14)
    expect(cbpReportUrl('2027-01-04')).toContain('/2027-01/27_0104_')
    expect(cbpReportUrl('2026-12-28')).toContain('/2026-12/26_1228_')
    expect(() => cbpReportUrl('2026-02-30')).toThrow()
  })

  it('fails visibly after a bounded 14-day search', async () => {
    const fetcher = vi.fn(async () => missing())
    await expect(fetchLatestTrq(now, fetcher)).rejects.toThrow(/last 14 days/)
    expect(fetcher).toHaveBeenCalledTimes(14)
  })

  it.each([403, 500])('reports HTTP %s instead of silently selecting an older release', async status => {
    const parse = vi.fn()
    const fetcher = vi.fn(async (input: string | URL | Request) => String(input).includes('26_1015_') ? new Response('', { status }) : pdf())
    await expect(fetchLatestTrq(now, fetcher, parse)).rejects.toThrow(String(status))
    expect(parse).not.toHaveBeenCalled()
  })

  it('reports timeouts, HTML and oversized downloads as source failures', async () => {
    await expect(fetchLatestTrq(now, vi.fn().mockRejectedValue(new Error('Timed out')))).rejects.toThrow(/Timed out/)
    await expect(fetchLatestTrq(now, vi.fn(async () => new Response('<html>not a PDF</html>')))).rejects.toThrow(/not a PDF/)
    await expect(fetchLatestTrq(now, vi.fn(async () => new Response('%PDF-', { headers: { 'content-length': '6000000' } })))).rejects.toThrow(/size limit/)
  })

  it('does not hide a malformed newest PDF by falling back to an older one', async () => {
    const parse = vi.fn().mockRejectedValue(new Error('Changed tobacco headers'))
    await expect(fetchLatestTrq(now, vi.fn(async () => pdf()), parse)).rejects.toThrow(/Changed tobacco headers/)
    expect(parse).toHaveBeenCalledOnce()
  })

  it('keeps manual TRQ inputs and enriches the other source independently', async () => {
    const usTrade = { exports: { month: 1, prevMonth: 1, ytd: 1, prevYtd: 1 }, imports: { month: 2, prevMonth: 2, ytd: 2, prevYtd: 2 } }
    const usLoader = vi.fn().mockResolvedValue(usTrade), trqLoader = vi.fn().mockResolvedValue(expected)
    const result = await resolveReportInputs({ trq: expected }, 2026, 8, usLoader, trqLoader)
    expect(result.inputs.trq).toBe(expected)
    expect(result.inputs.usTrade).toBe(usTrade)
    expect(trqLoader).not.toHaveBeenCalled()
    const failure = await resolveReportInputs({ usTrade }, 2026, 8, usLoader, vi.fn().mockRejectedValue(new Error('Blocked')))
    expect(failure.inputs.usTrade).toBe(usTrade)
    expect(failure.inputs.trq).toBeUndefined()
    expect(failure.notes[0]).toMatch(/TRQ.*Blocked.*generation requires/)
    const success = await resolveReportInputs({ usTrade }, 2026, 8, usLoader, trqLoader)
    expect(success.inputs.trq).toBe(expected)
    expect(success.notes).toEqual([])
  })
})
