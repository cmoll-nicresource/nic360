import type { TrademarkReportOptions } from '../trademarkReportIssues'

export function parseReportRequest(body: unknown): TrademarkReportOptions {
  const input = body as { kind?: unknown; period?: unknown } | null
  if (
    !input ||
    !['weekly', 'monthly'].includes(String(input.kind)) ||
    typeof input.period !== 'string'
  )
    throw new Error('Choose a report and reporting date.')
  const monthly = input.kind === 'monthly'
  const pattern = monthly ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/
  if (!pattern.test(input.period)) throw new Error('Invalid reporting date.')
  const isoDay = monthly ? `${input.period}-01` : input.period
  const date = new Date(`${isoDay}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== isoDay)
    throw new Error('Invalid reporting date.')
  if (monthly) date.setUTCMonth(date.getUTCMonth() + 1)
  return { asOf: date, weekly: !monthly, monthly }
}
