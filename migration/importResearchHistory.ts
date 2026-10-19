import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { gzipSync } from 'node:zlib'
import { importResearchHistory, planResearchHistory, type HistoryCorrections } from '../src/lib/research/historyImport'

async function main() {
  const args = process.argv.slice(2)
  const file = args.find(arg => !arg.startsWith('--'))
  if (!file || !process.env.DATABASE_URI) throw new Error('Usage: node --import tsx migration/importResearchHistory.ts <export.jsonl> [--apply] [--expected-before=<preview hash>]')
  const corrections = JSON.parse(await fs.readFile(new URL('./researchHistoryCorrections.json', import.meta.url), 'utf8')) as HistoryCorrections
  const plan = planResearchHistory(await fs.readFile(file, 'utf8'), corrections)
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  const apply = args.includes('--apply')
  const expected = args.find(arg => arg.startsWith('--expected-before='))?.split('=')[1]
  if (apply && !expected) throw new Error('Apply requires --expected-before=<preview hash>')
  await fs.mkdir('migration/data', { recursive: true })
  await client.connect()
  try {
    await client.query('BEGIN')
    const result = await importResearchHistory(client, plan, expected)
    const receipt = path.resolve(`migration/data/research-history-${apply ? 'apply' : 'preview'}-${Date.now()}.json`)
    // Write recovery material before committing. Raw abstracts stay out of Git.
    await fs.writeFile(receipt + '.before.json.gz', gzipSync(JSON.stringify(result.before)), { mode: 0o600 })
    await fs.writeFile(receipt, JSON.stringify({ sourceHash: plan.sourceHash, beforeHash: result.beforeHash, sourceCount: plan.sourceCount, duplicates: plan.duplicates, occurrences: plan.occurrences, created: result.created, skipped: result.skipped, addedJournals: result.addedJournals }, null, 2), { mode: 0o600 })
    await client.query(apply ? 'COMMIT' : 'ROLLBACK')
    console.log(JSON.stringify({ applied: apply, sourceCount: plan.sourceCount, unique: plan.records.length, duplicates: plan.duplicates.length, created: result.created.length, skipped: result.skipped.length, addedJournals: result.addedJournals.length, beforeHash: result.beforeHash, receipt }))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { await client.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
