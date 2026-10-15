import type { Inputs } from './chapters'
import type { Report } from './model'

export function generationDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(now)
}

/** Required data must be complete before building a publication PDF. */
export function assertReportInputs(inputs: Inputs, yr: number, mo: number): void {
  if (!inputs.usTrade || !inputs.trq) throw new Error('Cannot generate a complete report: US trade and TRQ figures are required. Retry their sources or supply complete report inputs.')
  const finite = (value: unknown, label: string, negative = false) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (!negative && value < 0)) throw new Error(`Invalid report input: ${label}`)
  }
  for (const flow of ['exports', 'imports'] as const) {
    const f = inputs.usTrade[flow]
    for (const key of ['month', 'prevMonth', 'ytd', 'prevYtd'] as const) finite(f?.[key], `US ${flow} ${key}`)
    if (f?.priorThreeMonthAverage !== undefined) finite(f.priorThreeMonthAverage, `US ${flow} three-month average`)
  }
  if (inputs.usTrade.balance) for (const key of ['month', 'prevMonth', 'ytd', 'prevYtd'] as const) {
    finite(inputs.usTrade.balance[key], `US balance ${key}`, true)
    if (Math.abs(inputs.usTrade.exports[key] - inputs.usTrade.imports[key] - inputs.usTrade.balance[key]) > 0.025) throw new Error(`US trade balance does not reconcile: ${key}`)
  }
  if (inputs.usTrade.source && inputs.usTrade.source.period !== `${yr}-${String(mo).padStart(2, '0')}`) throw new Error('US trade source month does not match the report month')
  const trq = inputs.trq
  if (!trq.periodLabel?.trim() || !trq.quotaYear?.trim() || !Array.isArray(trq.rows) || !trq.rows.length) throw new Error('TRQ report inputs are incomplete')
  const countries = new Set<string>()
  for (const row of trq.rows) {
    const country = row.country?.trim().toLowerCase()
    if (!country || countries.has(country)) throw new Error('TRQ report inputs contain a missing or duplicate country')
    countries.add(country)
    finite(row.imported, `TRQ ${row.country} allocated quantity`)
    finite(row.quota, `TRQ ${row.country} quota`)
    if (row.quota === 0) throw new Error('TRQ quota must be positive; omit excluded countries')
  }
}

/** Final guard covers every visible string, including table cells and metadata. */
export function assertReportReady(report: Report): void {
  if (report.notes.length) throw new Error(`Report data needs attention: ${report.notes.join(' ')}`)
  const check = (text: string) => {
    if (/\[\[|\]\]|\b(?:NaN|Infinity)\b/.test(text)) throw new Error(`Report contains unfinished or invalid text: ${text.slice(0, 160)}`)
  }
  check(report.title); check(report.subtitle)
  for (const chapter of report.chapters) {
    check(chapter.title)
    for (const section of chapter.sections) {
      check(section.header)
      for (const block of section.blocks) {
        if (block.kind === 'para' || block.kind === 'heading') check(block.text)
        else if (block.kind === 'table') {
          if (block.table.title) check(block.table.title)
          for (const row of [...block.table.header, ...block.table.rows]) for (const cell of row.cells) check(cell.text)
        }
      }
    }
  }
}
