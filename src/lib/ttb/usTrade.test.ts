import { describe, expect, it, vi } from 'vitest'
import { resolveReportInputs } from './reportInputs'
import { fetchUsTrade, parseFredCsv, US_TRADE_SERIES, usTradeParagraphs, type UsTrade } from './usTrade'

function source(override?: (id: string, date: string, value: number) => string | number | null) {
  return vi.fn(async (input: string | URL | Request) => {
    const id = new URL(String(input)).searchParams.get('id')!
    const rows: string[] = []
    for (let year = 2025; year <= 2026; year++) for (let month = 1; month <= 12; month++) {
      const date = `${year}-${String(month).padStart(2, '0')}-01`
      const ex = 100000 + month * 1000, im = 150000 + month * 2000
      const value = id === 'BOPTEXP' ? ex : id === 'BOPTIMP' ? im : ex - im
      const raw = override ? override(id, date, value) : value
      if (raw !== null) rows.push(`${date},${raw}`)
    }
    return new Response(`observation_date,${id}\n${rows.join('\n')}\n`)
  }) as unknown as typeof fetch
}

describe('monthly US trade data', () => {
  it('uses matching monthly series, scales millions to billions and selects the report month', async () => {
    const fetcher = source()
    const result = await fetchUsTrade(2026, 4, fetcher)
    expect(result.exports.month).toBe(104)
    expect(result.imports.month).toBe(158)
    expect(result.balance?.month).toBe(-54)
    expect(result.exports.prevMonth).toBe(103)
    expect(result.exports.priorThreeMonthAverage).toBe(102)
    expect(result.exports.ytd).toBe(410)
    expect(result.imports.prevYtd).toBe(620)
    expect(result.source?.period).toBe('2026-04')
    expect(result.source?.series).toEqual([...US_TRADE_SERIES])
    for (const [url, options] of vi.mocked(fetcher).mock.calls) {
      expect(String(url)).toContain('coed=2026-04-01')
      expect(options?.cache).toBe('no-store')
      expect(options?.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it('handles January prior-month and preceding-three-month comparisons across years', async () => {
    const result = await fetchUsTrade(2026, 1, source())
    expect(result.exports.prevMonth).toBe(112)
    expect(result.exports.priorThreeMonthAverage).toBe(111)
    expect(result.exports.ytd).toBe(101)
    expect(result.exports.prevYtd).toBe(101)
  })

  it.each(['2026-04-01', '2026-02-01', '2025-03-01'])('rejects a missing required month %s without silently shortening YTD', async date => {
    await expect(fetchUsTrade(2026, 4, source((id, d, value) => id === 'BOPTEXP' && d === date ? '.' : value))).rejects.toThrow(/no observation/)
  })

  it('rejects inconsistent balance series and upstream HTTP failures', async () => {
    await expect(fetchUsTrade(2026, 4, source((id, _d, v) => id === 'BOPGSTB' ? v + 1000 : v))).rejects.toThrow(/do not reconcile/)
    await expect(fetchUsTrade(2026, 4, vi.fn(async () => new Response('', { status: 503 })))).rejects.toThrow(/503/)
  })

  it.each(['NaN', 'Infinity', '1e10', '-1', '9007199254740992'])('rejects invalid export measure %s', value => {
    expect(() => parseFredCsv(`observation_date,BOPTEXP\n2026-01-01,${value}`, 'BOPTEXP')).toThrow(/Invalid FRED value/)
  })

  it('rejects the wrong series and duplicate observations', () => {
    expect(() => parseFredCsv('observation_date,EXPGS\n2026-01-01,100', 'BOPTEXP')).toThrow(/header/)
    expect(() => parseFredCsv('observation_date,BOPTEXP\n2026-01-01,100\n2026-01-01,101', 'BOPTEXP')).toThrow(/duplicate/)
  })

  it('preserves manual inputs and reports a source failure as an editorial note', async () => {
    const trq = { periodLabel: 'Fixture', quotaYear: '2026', rows: [] }
    const manual = { trq, usTrade: await fetchUsTrade(2026, 4, source()), commentary: { usTrade: 'Editor note.' } }
    const loader = vi.fn().mockRejectedValue(new Error('Timed out'))
    expect((await resolveReportInputs(manual, 2026, 4, loader)).inputs).toBe(manual)
    expect(loader).not.toHaveBeenCalled()
    const result = await resolveReportInputs({ trq }, 2026, 4, loader)
    expect(result.inputs.usTrade).toBeUndefined()
    expect(result.notes[0]).toMatch(/2026-04.*Timed out.*generation requires/)
  })
})

describe('US trade prose', () => {
  const base: UsTrade = {
    exports: { month: 110, prevMonth: 100, ytd: 220, prevYtd: 200, priorThreeMonthAverage: 120 },
    imports: { month: 130, prevMonth: 140, ytd: 260, prevYtd: 280, priorThreeMonthAverage: 120 },
  }
  it('describes a shrinking deficit and uses independent directions for the two import comparisons', () => {
    const [lead, flows] = usTradeParagraphs(base, 2026, 2)
    expect(lead).toContain('deficit of $20.00 billion')
    expect(lead).toContain('$20.00 billion (50.0%) less')
    expect(flows).toContain('$10.00 billion (7.1%) less')
    expect(flows).toContain('$10.00 billion (8.3%) greater')
    expect(flows).toContain('$10.00 billion (8.3%) less')
  })
  it('describes surplus transitions instead of calling a surplus a deficit', () => {
    const [lead] = usTradeParagraphs({ ...base, balance: { month: 10, prevMonth: -10, ytd: 20, prevYtd: -20 } }, 2026, 1)
    expect(lead).toContain('shifted from a $10.00 billion deficit in December 2025 to a $10.00 billion surplus in January 2026')
    expect(lead).toContain('compared with a $20.00 billion deficit')
  })
  it('avoids invalid percentages for zero baselines and says unchanged on equal figures', () => {
    const prose = usTradeParagraphs({ exports: { month: 0, prevMonth: 0, ytd: 0, prevYtd: 0 }, imports: { month: 10, prevMonth: 0, ytd: 10, prevYtd: 0 } }, 2026, 1).join(' ')
    expect(prose).toContain('unchanged')
    expect(prose).not.toMatch(/NaN|Infinity|\d{4,}%/)
  })
})
