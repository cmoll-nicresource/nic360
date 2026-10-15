import type { Inputs } from './report/chapters'
import { fetchUsTrade } from './usTrade'
import { fetchLatestTrq } from './trq'

/** Network enrichment stays outside buildReport and its database snapshot. */
export async function resolveReportInputs(inputs: Inputs, yr: number, mo: number, load = fetchUsTrade, loadTrq = fetchLatestTrq): Promise<{ inputs: Inputs; notes: string[] }> {
  if (inputs.usTrade && inputs.trq) return { inputs, notes: [] }
  const [us, trq] = await Promise.allSettled([
    inputs.usTrade ? Promise.resolve(inputs.usTrade) : load(yr, mo),
    inputs.trq ? Promise.resolve(inputs.trq) : loadTrq(),
  ])
  const resolved = { ...inputs }
  const notes: string[] = []
  if (us.status === 'fulfilled') resolved.usTrade = us.value
  else notes.push(`US trade figures unavailable for ${yr}-${String(mo).padStart(2, '0')}: ${us.reason instanceof Error ? us.reason.message : 'source request failed'}. PDF generation requires these figures; retry or supply complete manual inputs.`)
  if (trq.status === 'fulfilled') resolved.trq = trq.value
  else notes.push(`TRQ figures unavailable: ${trq.reason instanceof Error ? trq.reason.message : 'source request failed'}. PDF generation requires these figures; retry or supply complete manual inputs.`)
  return { inputs: resolved, notes }
}
