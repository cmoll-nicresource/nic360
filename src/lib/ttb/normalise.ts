// Cleaning: blanks, duplicates, key clashes, month checks. Ported verbatim from ttb-trade/src/normalise.ts.
import { type Flow, OPTIONAL_MEASURES, SPEC } from './columns'
import { tradeNumber } from './numeric'
import type { Row } from './read'

export type Fact = Record<string, number | string | null>

export interface Issue {
  kind: string
  yr?: number
  mo?: number
  rowCount?: number
  detail?: string
}

/** code -> latest non-blank description, per descriptive source column. */
export type Descriptions = Record<string, Map<number, string>>

export interface Normalised {
  facts: Fact[]
  descriptions: Descriptions
  issues: Issue[]
}

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === ''

function toInt(v: unknown, col: string, row: number): number {
  const n = Number(String(v).trim())
  if (!Number.isSafeInteger(n)) throw new Error(`row ${row + 2}: ${col} is not a safe whole number (${String(v)})`)
  return n
}

function toNum(v: unknown, col: string, row: number): number {
  return tradeNumber(String(v).trim(), `row ${row + 2}: ${col}`)
}

/**
 * Turn source rows (Census column names) into clean fact rows. Columns are matched by
 * header name, never by position. Identical rows (a month appended twice) are dropped;
 * rows that share a key but differ are summed. Both are reported as issues.
 */
export function normalise(rows: Row[], flow: Flow, year?: number): Normalised {
  const spec = SPEC[flow]
  const issues: Issue[] = []

  const kept = rows.filter((r) => !blank(r.COMMODITY))
  if (kept.length < rows.length) {
    issues.push({ kind: 'empty_row', rowCount: rows.length - kept.length, detail: 'rows with no COMMODITY dropped' })
  }
  if (kept.length === 0) throw new Error('no data rows')

  const sample = kept[0]
  const missing = Object.keys(spec.rename).filter((c) => !(c in sample) && !(c === 'YEAR' && year !== undefined))
  if (missing.length) throw new Error(`${flow} file is missing required columns: ${missing.join(', ')}`)
  for (const m of spec.measures) {
    if (!(m.toUpperCase() in sample) && !OPTIONAL_MEASURES.has(m)) {
      throw new Error(`${flow} file is missing measure column ${m.toUpperCase()}`)
    }
  }

  // Descriptions, latest period last so it wins.
  const descriptions: Descriptions = {}
  const codeFor: Record<string, string> = {
    COMM_DESC: 'COMMODITY', UNIT_QY1: 'COMMODITY', UNIT_QY2: 'COMMODITY', CTY_DESC: 'CTY_CODE',
    D_E_DESC: 'DIST_ENTRY', D_U_DESC: 'DIST_UNLAD', DIST_DESC: 'DISTRICT',
  }
  const ordered = [...kept].sort(
    (a, b) => Number(year ?? a.YEAR) * 100 + Number(a.STAT_MONTH) - (Number(year ?? b.YEAR) * 100 + Number(b.STAT_MONTH)),
  )
  for (const col of spec.descColumns) {
    if (!(col in sample)) continue
    const map = new Map<number, string>()
    for (const r of ordered) {
      if (!blank(r[col]) && !blank(r[codeFor[col]])) map.set(Number(r[codeFor[col]]), String(r[col]).trim())
    }
    descriptions[col] = map
  }

  let facts: Fact[] = kept.map((r, i) => {
    const f: Fact = {}
    for (const [src, dst] of Object.entries(spec.rename)) {
      if (dst === 'cty_subco') f[dst] = blank(r[src]) ? '' : String(r[src]).trim()
      else if (src === 'YEAR' && year !== undefined) f[dst] = year
      else f[dst] = toInt(r[src], src, i)
    }
    for (const m of spec.measures) {
      const v = r[m.toUpperCase()]
      f[m] = blank(v) ? (OPTIONAL_MEASURES.has(m) ? null : 0) : toNum(v, m.toUpperCase(), i)
    }
    return f
  })

  const badMonth = facts.filter((f) => (f.mo as number) < 1 || (f.mo as number) > 12).length
  if (badMonth) throw new Error(`${badMonth} rows have STAT_MONTH outside 1-12`)

  const cols = [...spec.key, ...spec.measures]
  const periodCount = (list: Fact[]) => {
    const m = new Map<string, number>()
    for (const f of list) m.set(`${f.yr}|${f.mo}`, (m.get(`${f.yr}|${f.mo}`) ?? 0) + 1)
    return m
  }

  // Identical rows: a file appended twice. Keep the first copy.
  const seen = new Set<string>()
  const dups: Fact[] = []
  facts = facts.filter((f) => {
    const sig = cols.map((c) => f[c]).join('|')
    if (seen.has(sig)) {
      dups.push(f)
      return false
    }
    seen.add(sig)
    return true
  })
  for (const [p, n] of periodCount(dups)) {
    const [yr, mo] = p.split('|').map(Number)
    issues.push({ kind: 'duplicate_row', yr, mo, rowCount: n, detail: 'identical rows removed (same month loaded more than once)' })
  }

  // Same key, different values: separate Census records. Sum them.
  const byKey = new Map<string, Fact[]>()
  for (const f of facts) {
    const k = spec.key.map((c) => f[c]).join('|')
    const list = byKey.get(k)
    if (list) list.push(f)
    else byKey.set(k, [f])
  }
  const clashes: Fact[] = []
  facts = []
  for (const list of byKey.values()) {
    if (list.length === 1) {
      facts.push(list[0])
      continue
    }
    clashes.push(...list)
    const merged: Fact = { ...list[0] }
    for (const m of spec.measures) {
      const vals = list.map((f) => f[m]).filter((v): v is number => v !== null)
      merged[m] = vals.length ? tradeNumber(vals.reduce((a, b) => a + b, 0), `merged ${m}`) : null
    }
    facts.push(merged)
  }
  for (const [p, n] of periodCount(clashes)) {
    const [yr, mo] = p.split('|').map(Number)
    issues.push({ kind: 'conflicting_key_summed', yr, mo, rowCount: n, detail: 'rows sharing a key with different values were summed' })
  }

  return { facts, descriptions, issues }
}
