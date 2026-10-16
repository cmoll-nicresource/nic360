/** Preview by default. --plan-only emits original recovery sources for private remote execution. */
import 'dotenv/config'
import fs from 'node:fs'
import zlib from 'node:zlib'
import readline from 'node:readline'
import pg from 'pg'
import {
  repairLegacyArticleExcerpts,
  type LegacyArticleRepairSource,
} from '../src/lib/repairLegacyArticleExcerpts'

async function main() {
  const input = fs.createReadStream('old-db/truecms.sql.gz').pipe(zlib.createGunzip()),
    lines = readline.createInterface({ input, crlfDelay: Infinity })
  let columns: string[] = []
  const sources: LegacyArticleRepairSource[] = []
  for await (const line of lines) {
    if (!columns.length) {
      if (line.startsWith('COPY public.articles ('))
        columns = line.slice(line.indexOf('(') + 1, line.indexOf(')')).split(', ')
      continue
    }
    if (line === '\\.') break
    const fields = line.split('\t'),
      row = Object.fromEntries(columns.map((column, index) => [column, fields[index]]))
    if (row.status !== 'Published') continue
    sources.push({
      legacyId: row.id,
      title: row.title,
      shortAbstract: row.short_abstract,
      fullText: row.full_text,
      content: row.content,
      rawContent: row.raw_content,
      sourceUrl: row.link && row.link !== '\\N' ? row.link : row.source_link,
      updatedAt: row.updated_at,
    })
  }
  lines.close()
  input.destroy()
  if (sources.length !== 9430)
    throw new Error('Original published article count changed; review the source dump.')
  if (process.argv.includes('--plan-only')) {
    fs.writeFileSync('tmp/article-excerpt-recovery-sources.json', JSON.stringify(sources))
    console.log('Original recovery sources prepared for ' + sources.length + ' articles.')
    return
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout='10s'")
    const result = await repairLegacyArticleExcerpts(client, sources)
    const path = 'migration/data/article-excerpts-local-before-' + Date.now() + '.json.gz'
    fs.writeFileSync(path, Buffer.from(result.snapshotGzip, 'base64'), { mode: 0o600 })
    const apply = process.argv.includes('--apply')
    if (apply) await repairLegacyArticleExcerpts(client, sources, true, result.beforeHash)
    await client.query(apply ? 'COMMIT' : 'ROLLBACK')
    const report = {
      mode: apply ? 'applied' : 'preview rolled back',
      backup: path,
      beforeHash: result.beforeHash,
      ...result.stats,
    }
    const reportPath = `migration/data/article-excerpts-local-${apply ? 'applied' : 'preview'}-${Date.now()}.json`
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(
      JSON.stringify({ ...report, unresolved: result.stats.unresolved.length, report: reportPath }),
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
