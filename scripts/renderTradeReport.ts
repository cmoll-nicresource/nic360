import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

import { buildReport } from '../src/lib/ttb/report/chapters'
import { renderPdf } from '../src/lib/ttb/report/pdf'
import { resolveReportInputs } from '../src/lib/ttb/reportInputs'

async function main() {
  const [yearArg, monthArg, outputArg] = process.argv.slice(2)
  const year = Number(yearArg)
  const month = Number(monthArg)
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Usage: pnpm trade:render YEAR MONTH [output.pdf]')
  }
  const connectionString = process.env.DATABASE_URI
  if (!connectionString || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname)) {
    throw new Error('PDF previews require a local DATABASE_URI; production uploads belong in the staff wizard')
  }
  const output = path.resolve(outputArg ?? `tmp/trade-barometer-${year}-${String(month).padStart(2, '0')}.pdf`)
  if (path.extname(output).toLowerCase() !== '.pdf') throw new Error('Output must have a .pdf extension')
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 })
  const resolved = await resolveReportInputs({}, year, month)
  if (resolved.notes.length) throw new Error(`Cannot generate a complete PDF. ${resolved.notes.join(' ')}`)
  let report: Awaited<ReturnType<typeof buildReport>>
  try {
    await client.connect()
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    report = await buildReport(client, year, month, resolved.inputs)
  } finally {
    try { await client.query('ROLLBACK') } finally { await client.end() }
  }
  console.log('Report built from a read-only snapshot; rendering PDF…')
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, await renderPdf(report))
  console.log(output)
  for (const note of report.notes) console.log(`Data note: ${note}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Report preview failed')
  process.exitCode = 1
})
