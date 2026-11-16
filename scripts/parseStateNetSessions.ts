/**
 * Turns a saved State Net session-calendar page into reviewable JSON.
 *
 *   pnpm tsx scripts/parseStateNetSessions.ts <saved-page.htm> [out.json]
 *
 * Writes out.json (default: next to the input, same name, .json) and prints a
 * coverage report: which jurisdictions are missing, which dates were projected,
 * and anything it could not read. Read-only: touches no database. See
 * docs/state-legislatures.md for the yearly process.
 */
import fs from 'fs'
import path from 'path'

import { coverageReport, parseStateNetSessionsHtml } from '../src/lib/legislatures/statenetSessions'

const [input, outArg] = process.argv.slice(2)
if (!input) {
  console.error('Usage: pnpm tsx scripts/parseStateNetSessions.ts <saved-page.htm> [out.json]')
  process.exit(1)
}

const html = fs.readFileSync(input, 'utf8')
const result = parseStateNetSessionsHtml(html)
const report = coverageReport(result.sessions)
const out = outArg ?? path.join(path.dirname(input), `${path.basename(input, path.extname(input))}.json`)

fs.writeFileSync(
  out,
  JSON.stringify({ source: path.basename(input), parsedAt: new Date().toISOString(), columns: result.columns, report, sessions: result.sessions }, null, 2),
)

console.log(`${result.sessions.length} sessions across ${report.jurisdictions} jurisdictions (year ${report.year ?? 'unknown'}) -> ${out}`)
console.log(`Columns: ${result.columns.join(' | ')}`)
if (report.missing.length) console.log(`Missing (${report.missing.length}): ${report.missing.join(', ')}`)
if (report.extra.length) console.log(`Also listed, not tracked: ${report.extra.join(', ')}`)
const projected = report.projectedAdjournments
if (projected.length > 10) console.log(`Projected adjournments: ${projected.length} of ${result.sessions.length} (normal for a future-year page)`)
else if (projected.length) console.log(`Projected adjournments: ${projected.join('; ')}`)
for (const p of [...result.problems, ...report.conflicts, ...report.unreadableDates]) console.log(`Check: ${p}`)
if (!result.sessions.length) process.exit(2)
