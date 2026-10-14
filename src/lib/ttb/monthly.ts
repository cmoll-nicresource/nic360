// One monthly file: year rule, replace check, YTD check. Adapted from
// ttb-trade/src/monthly.ts to take an in-memory buffer (the uploaded file's
// bytes) plus its original filename, instead of a path on disk.
import type pg from 'pg'

import type { Flow } from './columns'
import { normalise, type Issue } from './normalise'
import { readSheetBuffer } from './read'
import { ensureReference, logIssues, newBatch, sha256, writeFacts } from './store'

const NAME = /^(imp|exp)_(\d{2})(\d{4})/i

/** Flow and the year/month in the file name (Imp_MMYYYY.xls / Exp_MMYYYY.xls). */
export function nameParts(fileName: string): { flow: Flow; nameYear: number; nameMonth: number } {
  const m = NAME.exec(fileName)
  if (!m) throw new Error(`${fileName}: name is not Imp_MMYYYY or Exp_MMYYYY`)
  return { flow: m[1].toLowerCase() === 'imp' ? 'import' : 'export', nameYear: Number(m[3]), nameMonth: Number(m[2]) }
}

/**
 * The files carry no year. Up to 2024 they are named for their data month (Exp_082024 = August 2024);
 * 2026 files for the month they arrived (Exp_032026 = January 2026). Data never comes after the
 * name's month, so year = name year, minus one when STAT_MONTH is later than the name's month.
 */
export function dataYear(nameYear: number, nameMonth: number, statMonth: number): number {
  return statMonth <= nameMonth ? nameYear : nameYear - 1
}

export interface LoadResult {
  flow: Flow
  yr: number
  mo: number
  rows: number
  replaced: number
  batchId: number
  ytdCheck: string | null
  issues: Issue[]
}

export interface LoadOptions {
  /** Called when the month already exists; return false to stop without changes. */
  confirmReplace?: (flow: Flow, yr: number, mo: number, existing: number) => Promise<boolean>
  year?: number
}

/** Load one monthly file inside the caller's transaction. Throws on any validation failure. */
export async function loadMonthlyFile(
  c: pg.PoolClient, fileName: string, buffer: Buffer, opts: LoadOptions = {},
): Promise<LoadResult | null> {
  const { flow, nameYear, nameMonth } = nameParts(fileName)
  const raw = readSheetBuffer(buffer)
  const months = new Set(raw.map((r) => Number(r.STAT_MONTH)).filter((m) => Number.isFinite(m) && m > 0))
  if (months.size !== 1) throw new Error(`expected one month, file has STAT_MONTH ${[...months].sort().join(', ')}`)
  const mo = [...months][0]
  const yr = opts.year ?? dataYear(nameYear, nameMonth, mo)

  const { facts, descriptions, issues } = normalise(raw, flow, yr)
  const { rows: ex } = await c.query(`select count(*)::int n from trade.${flow}_fact where yr=$1 and mo=$2`, [yr, mo])
  const existing: number = ex[0].n
  if (existing && opts.confirmReplace && !(await opts.confirmReplace(flow, yr, mo, existing))) return null

  const all = [...(await ensureReference(c, flow, facts, descriptions)), ...issues]
  const batchId = await newBatch(c, flow, fileName, sha256(buffer), yr, mo, facts.length)
  await writeFacts(c, flow, facts, batchId)
  await logIssues(c, batchId, flow, all)
  const ytdCheck = await checkYtd(c, flow, yr, mo)
  return { flow, yr, mo, rows: facts.length, replaced: existing, batchId, ytdCheck, issues: all }
}

/**
 * This month's YTD should equal last month's YTD plus this month (on the reporting basis:
 * consumption imports, domestic exports). Census revisions cause small gaps.
 */
async function checkYtd(c: pg.PoolClient, flow: Flow, yr: number, mo: number): Promise<string | null> {
  if (mo === 1) return null
  const [val, basis] = flow === 'import' ? ['con_val', 'true'] : ['all_val', 'dom_or_for = 1']
  const q = async (m: number) =>
    (await c.query(`select sum(${val}_mo)::float8 mo, sum(${val}_yr)::float8 ytd from trade.${flow}_fact
                    where yr=$1 and mo=$2 and ${basis}`, [yr, m])).rows[0]
  const prev = await q(mo - 1)
  const cur = await q(mo)
  if (prev.ytd === null) return `WARNING: no data for ${yr}-${String(mo - 1).padStart(2, '0')}; cannot check YTD`
  const expected = prev.ytd + cur.mo
  const diff = expected ? ((cur.ytd - expected) / expected) * 100 : 0
  const flag = Math.abs(diff) > 2 ? 'WARNING' : 'ok'
  return `${flag}: YTD value ${fmt(cur.ytd)} vs prior YTD + month ${fmt(expected)} (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%)`
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
