import 'dotenv/config'
import pg from 'pg'

// Works against an explicitly configured DATABASE_URI. No Payload init,
// schema push, restores, or other mutations; never prints connection secrets.
async function main() {
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI, connectionTimeoutMillis: 5000 })
  let ready = true
  try {
    await client.connect()
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    for (const table of ['ref.hts', 'ref.country', 'ref.district', 'ref.rate_provision', 'trade.import_fact', 'trade.export_fact', 'trade.load_batch', 'trade.load_issue', 'report.chapter', 'report.line', 'report.line_member', 'public.trade_import_runs', 'public.trade_import_runs_data_quality_notes', 'public.trade_import_runs_rels']) {
      const { rows: [{ present }] } = await client.query('select to_regclass($1) is not null as present', [table])
      if (!present) { console.log(`Missing table: ${table}`); ready = false }
    }
    if (ready) {
      for (const table of ['trade.import_fact', 'trade.export_fact']) {
        const { rows } = await client.query(`select yr, min(mo) as first_month, max(mo) as last_month, count(distinct mo)::int as months from ${table} group by yr order by yr`)
        console.log(`${table}: ${JSON.stringify(rows)}`)
        if (rows.length < 2) { console.log('Prior-year history is required for comparisons'); ready = false }
      }
      for (const table of ['ref.hts', 'ref.country', 'report.line', 'report.line_member']) {
        const { rows: [{ count }] } = await client.query(`select count(*)::int as count from ${table}`)
        console.log(`${table}: ${count} rows`)
        if (!count) ready = false
      }
    }
    const { rows: [counts] } = await client.query(`select
      (select count(*)::int from public.publications where generator::text = 'monthly-trade-barometer') as publications,
      (select count(*)::int from public.datasets where slug in ('us-imports', 'us-exports')) as datasets`)
    console.log(`Trade publications: ${counts.publications}; required datasets: ${counts.datasets}/2`)
    if (counts.publications !== 1 || counts.datasets !== 2) ready = false
  } finally {
    try { await client.query('ROLLBACK') } finally { await client.end() }
  }
  console.log(ready ? 'Trade prerequisites present; still verify report output and the staff upload flow.' : 'Trade prerequisites incomplete.')
  if (!ready) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Readiness check failed')
  process.exitCode = 1
})
