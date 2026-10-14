// Reference upkeep, batches, bulk inserts. Ported verbatim from ttb-trade/src/store.ts.
import { createHash } from 'node:crypto'
import type pg from 'pg'

import { type Flow, SPEC } from './columns'
import type { Descriptions, Fact, Issue } from './normalise'

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Add any code the facts use that the reference tables lack. Returns an issue per new HTS or country list. */
export async function ensureReference(c: pg.PoolClient, flow: Flow, facts: Fact[], d: Descriptions): Promise<Issue[]> {
  const issues: Issue[] = []
  const codes = (col: string) => new Set(facts.map((f) => f[col] as number))
  const desc = (col: string, code: number) => d[col]?.get(code) ?? null

  async function missing(table: string, col: string, wanted: Set<number>) {
    const { rows } = await c.query(`select ${col} as code from ref.${table}`)
    const have = new Set(rows.map((r) => Number(r.code)))
    return [...wanted].filter((x) => !have.has(x)).sort((a, b) => a - b)
  }

  const newHts = await missing('hts', 'hts', codes('hts'))
  for (const h of newHts) {
    await c.query(
      'insert into ref.hts (hts, description, unit_qy1, unit_qy2) values ($1,$2,$3,$4)',
      [h, desc('COMM_DESC', h) ?? `NEW CODE ${h} - add description`, desc('UNIT_QY1', h), desc('UNIT_QY2', h)],
    )
  }
  if (newHts.length) issues.push({ kind: 'new_hts_code', rowCount: newHts.length, detail: `HTS codes added to ref.hts: ${newHts.join(', ')}` })

  const newCty = await missing('country', 'cty_code', codes('cty_code'))
  for (const k of newCty) {
    const name = desc('CTY_DESC', k)
    await c.query(
      "insert into ref.country (cty_code, census_abbr, name, note) values ($1,$2,$3,'added by loader')",
      [k, name, name ?? `New country ${k}`],
    )
  }
  if (newCty.length) issues.push({ kind: 'new_country_code', rowCount: newCty.length, detail: `country codes added to ref.country: ${newCty.join(', ')}` })

  const districts = flow === 'import' ? new Set([...codes('dist_entry'), ...codes('dist_unlad')]) : codes('district')
  for (const k of await missing('district', 'district', districts)) {
    const name = flow === 'import' ? (desc('D_E_DESC', k) ?? desc('D_U_DESC', k)) : desc('DIST_DESC', k)
    await c.query('insert into ref.district (district, name) values ($1,$2)', [k, name])
  }
  if (flow === 'import') {
    for (const k of await missing('rate_provision', 'rate_prov', codes('rate_prov'))) {
      await c.query('insert into ref.rate_provision (rate_prov) values ($1)', [k])
    }
  }
  return issues
}

export async function newBatch(
  c: pg.PoolClient, flow: Flow, fileName: string, sha: string | null,
  yr: number | null, mo: number | null, rows: number, note?: string,
): Promise<number> {
  const { rows: r } = await c.query(
    `insert into trade.load_batch (flow, source_file, file_sha256, data_year, data_month, row_count, note)
     values ($1,$2,$3,$4,$5,$6,$7) returning batch_id`,
    [flow, fileName, sha, yr, mo, rows, note ?? null],
  )
  return r[0].batch_id
}

export async function logIssues(c: pg.PoolClient, batchId: number, flow: Flow, issues: Issue[]) {
  for (const i of issues) {
    await c.query(
      'insert into trade.load_issue (batch_id, flow, yr, mo, kind, detail, row_count) values ($1,$2,$3,$4,$5,$6,$7)',
      [batchId, flow, i.yr ?? null, i.mo ?? null, i.kind, i.detail ?? null, i.rowCount ?? null],
    )
  }
}

/** Write facts in bulk. With replacePeriods, the (year, month) periods they cover are deleted first. */
export async function writeFacts(c: pg.PoolClient, flow: Flow, facts: Fact[], batchId: number, replacePeriods = true) {
  const spec = SPEC[flow]
  const table = `trade.${flow}_fact`
  if (replacePeriods) {
    const periods = new Set(facts.map((f) => `${f.yr}|${f.mo}`))
    for (const p of periods) {
      const [yr, mo] = p.split('|').map(Number)
      await c.query(`delete from ${table} where yr=$1 and mo=$2`, [yr, mo])
    }
  }
  const cols = [...spec.key, ...spec.measures]
  const types = cols.map((col) => spec.keyTypes[col] ?? 'bigint')
  const sql = `insert into ${table} (${cols.join(', ')}, batch_id)
    select *, ${Number(batchId)} from unnest(${types.map((t, i) => `$${i + 1}::${t}[]`).join(', ')})`
  const CHUNK = 5000
  for (let i = 0; i < facts.length; i += CHUNK) {
    const part = facts.slice(i, i + CHUNK)
    await c.query(sql, cols.map((col) => part.map((f) => f[col])))
  }
}
