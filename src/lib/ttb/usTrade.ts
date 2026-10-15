import { monthName } from './report/format'

type FlowFigures = { month: number; prevMonth: number; ytd: number; prevYtd: number; priorThreeMonthAverage?: number }
export interface UsTrade {
  exports: FlowFigures
  imports: FlowFigures
  /** Signed balance, in billions: exports minus imports. */
  balance?: { month: number; prevMonth: number; ytd: number; prevYtd: number }
  source?: { period: string; retrievedAt: string; series: string[] }
}

export const US_TRADE_SERIES = ['BOPTEXP', 'BOPTIMP', 'BOPGSTB'] as const
type Series = typeof US_TRADE_SERIES[number]
const monthKey = (yr: number, mo: number) => `${yr}-${String(mo).padStart(2, '0')}-01`
const offsetKey = (yr: number, mo: number, offset: number) => {
  const d = new Date(Date.UTC(yr, mo - 1 + offset, 1))
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1)
}

/** These three monthly, seasonally adjusted FRED series are all in millions. */
export function parseFredCsv(csv: string, series: Series): Map<string, number> {
  const lines = csv.trim().replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines.shift() !== `observation_date,${series}`) throw new Error(`Invalid FRED CSV header for ${series}`)
  const values = new Map<string, number>()
  for (const line of lines) {
    if (!line.trim()) continue
    const [date, raw, extra] = line.split(',')
    if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(date) || extra !== undefined || values.has(date)) throw new Error(`Invalid or duplicate FRED date for ${series}`)
    if (raw === '.' || raw === '') continue
    if (!raw || !/^-?\d+(?:\.\d+)?$/.test(raw)) throw new Error(`Invalid FRED value for ${series}`)
    const value = Number(raw)
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (series !== 'BOPGSTB' && value < 0)) throw new Error(`Invalid FRED value for ${series}`)
    values.set(date, value / 1000)
  }
  return values
}

export async function fetchUsTrade(yr: number, mo: number, fetcher: typeof fetch = fetch): Promise<UsTrade> {
  if (!Number.isInteger(yr) || yr < 1901 || yr > 9998 || !Number.isInteger(mo) || mo < 1 || mo > 12) throw new Error('Invalid US trade report period')
  const series = await Promise.all(US_TRADE_SERIES.map(async id => {
    const url = new URL('https://fred.stlouisfed.org/graph/fredgraph.csv')
    url.search = new URLSearchParams({ id, cosd: monthKey(yr - 1, 1), coed: monthKey(yr, mo) }).toString()
    const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`FRED ${id} request failed (${response.status})`)
    const csv = await response.text()
    if (csv.length > 1_000_000) throw new Error(`FRED ${id} response too large`)
    return parseFredCsv(csv, id)
  }))
  const value = (index: number, date: string) => {
    const n = series[index].get(date)
    if (n === undefined) throw new Error(`FRED ${US_TRADE_SERIES[index]} has no observation for ${date.slice(0, 7)}; report month was not substituted`)
    return n
  }
  // Require every month used by either YTD comparison and by the preceding
  // three-month average. Never join away gaps or silently sum a partial year.
  const required = new Set([offsetKey(yr, mo, -1), offsetKey(yr, mo, -2), offsetKey(yr, mo, -3)])
  for (let m = 1; m <= mo; m++) for (const y of [yr, yr - 1]) required.add(monthKey(y, m))
  for (const date of required) {
    const [ex, im, bal] = [0, 1, 2].map(i => value(i, date))
    if (Math.abs(ex - im - bal) > 0.00201) throw new Error(`FRED trade series do not reconcile for ${date.slice(0, 7)}`)
  }
  const figures = (i: number): FlowFigures => {
    const sum = (year: number) => Array.from({ length: mo }, (_, m) => value(i, monthKey(year, m + 1))).reduce((a, b) => a + b, 0)
    return { month: value(i, monthKey(yr, mo)), prevMonth: value(i, offsetKey(yr, mo, -1)), ytd: sum(yr), prevYtd: sum(yr - 1),
      priorThreeMonthAverage: [-1, -2, -3].reduce((sum, k) => sum + value(i, offsetKey(yr, mo, k)), 0) / 3 }
  }
  return { exports: figures(0), imports: figures(1), balance: figures(2),
    source: { period: `${yr}-${String(mo).padStart(2, '0')}`, retrievedAt: new Date().toISOString(), series: [...US_TRADE_SERIES] } }
}

const dollars = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} billion`
const kind = (n: number) => n < 0 ? 'deficit' : n > 0 ? 'surplus' : 'balance'
function magnitudeComparison(current: number, prior: number): string {
  const diff = Math.abs(current) - Math.abs(prior)
  if (Math.abs(diff) < 0.000001) return 'unchanged'
  const pct = prior === 0 ? '' : ` (${(Math.abs(diff) / Math.abs(prior) * 100).toFixed(1)}%)`
  return `${dollars(diff)}${pct} ${diff > 0 ? 'greater' : 'less'}`
}

/** Accurate on declines, unchanged values, zero baselines and sign changes. */
export function usTradeParagraphs(us: UsTrade, yr: number, mo: number, commentary?: string): string[] {
  const current = `${monthName(mo)} ${yr}`
  const prev = mo === 1 ? `December ${yr - 1}` : `${monthName(mo - 1)} ${yr}`
  const b = us.balance ?? { month: us.exports.month - us.imports.month, prevMonth: us.exports.prevMonth - us.imports.prevMonth,
    ytd: us.exports.ytd - us.imports.ytd, prevYtd: us.exports.prevYtd - us.imports.prevYtd }
  const monthly = kind(b.month) !== kind(b.prevMonth)
    ? `shifted from a ${dollars(b.prevMonth)} ${kind(b.prevMonth)} in ${prev} to a ${dollars(b.month)} ${kind(b.month)} in ${current}`
    : `recorded a ${kind(b.month)} of ${dollars(b.month)} in ${current}, ${magnitudeComparison(b.month, b.prevMonth)} compared with the revised ${dollars(b.prevMonth)} ${kind(b.prevMonth)} in ${prev}`
  const ytd = kind(b.ytd) !== kind(b.prevYtd)
    ? `compared with a ${dollars(b.prevYtd)} ${kind(b.prevYtd)} for the same months of ${yr - 1}`
    : `was ${magnitudeComparison(b.ytd, b.prevYtd)} compared with the comparable ${yr - 1} figure of ${dollars(b.prevYtd)}`
  const flow = (label: string, f: FlowFigures) => `${monthName(mo)}'s ${label} of ${dollars(f.month)} were ${magnitudeComparison(f.month, f.prevMonth)} compared with the revised ${dollars(f.prevMonth)} in ${prev}`
    + (f.priorThreeMonthAverage === undefined ? '.' : `, and ${magnitudeComparison(f.month, f.priorThreeMonthAverage)} compared with the ${dollars(f.priorThreeMonthAverage)} monthly average for the preceding three months.`)
  return [`The nation’s goods and services trade ${monthly}. The year-to-date ${yr} ${kind(b.ytd)} of ${dollars(b.ytd)} ${ytd}.${commentary ? ` ${commentary}` : ''}`,
    `${flow('imports', us.imports)} ${flow('exports', us.exports)}`]
}
