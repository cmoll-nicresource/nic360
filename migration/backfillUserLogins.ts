/** Read-only preview by default. --plan-only prepares private sources; --apply updates only last_login_at. */
import 'dotenv/config'
import fs from 'node:fs'
import zlib from 'node:zlib'
import readline from 'node:readline'
import pg from 'pg'
import { backfillUserLogins, latestLegacyLogin, normalizeLoginEmail, type LegacyUserLogin } from '../src/lib/legacyUserLogins'

async function table(name: string, onRow: (row: Record<string, string>) => void) {
  const stream = fs.createReadStream('old-db/truecms.sql.gz')
  const input = stream.pipe(zlib.createGunzip())
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  let columns: string[] | undefined
  try {
    for await (const line of lines) {
      if (!columns) {
        if (line.startsWith(`COPY public.${name} (`)) columns = line.slice(line.indexOf('(') + 1, line.indexOf(')')).split(', ')
        continue
      }
      if (line === '\\.') break
      const values = line.split('\t')
      onRow(Object.fromEntries(columns.map((column, index) => [column, values[index]])))
    }
    if (!columns) throw new Error(`Missing legacy table: ${name}`)
  } finally { lines.close(); input.destroy(); stream.destroy() }
}

async function main() {
  const accounts = new Set<string>(), users = new Set<string>()
  const excludedAccounts = new Set(['87', '21', '58', '60'])
  const excludedDomains = new Set(['nicotineresource.org', 'tma.org', 'gtnftrust.org', 'truegroup.agency'])
  await table('accounts', row => {
    if (row.personal === 'f' && row.status && row.status !== '\\N' && !excludedAccounts.has(row.id)) accounts.add(row.id)
  })
  await table('account_users', row => { if (accounts.has(row.account_id)) users.add(row.user_id) })
  const sources: LegacyUserLogin[] = []
  let eligibleReaders = 0, noHistoricalLogin = 0
  const now = new Date()
  await table('users', row => {
    const email = normalizeLoginEmail(row.email)
    if (!users.has(row.id) || excludedDomains.has(email.split('@')[1])) return
    if (row.status !== 'Active' && !(row.status === 'Blocked' && Number(row.sign_in_count) > 0)) return
    eligibleReaders++
    const lastLoginAt = latestLegacyLogin(row.current_sign_in_at, row.last_sign_in_at, now)
    if (!lastLoginAt) { noHistoricalLogin++; return }
    sources.push({ legacyId: row.id, email, lastLoginAt })
  })
  if (new Set(sources.map(source => source.email)).size !== sources.length) throw new Error('Duplicate eligible legacy emails require review.')
  fs.mkdirSync('migration/data', { recursive: true })
  const plan = { createdAt: now.toISOString(), timestampInterpretation: 'Legacy Rails UTC, truncated to CMS millisecond precision', eligibleReaders, noHistoricalLogin, sources }
  fs.writeFileSync('migration/data/user-login-sources.json', JSON.stringify(plan), { mode: 0o600 })
  console.log(JSON.stringify({ eligibleReaders, noHistoricalLogin, readersWithHistoricalLogin: sources.length }))
  if (process.argv.includes('--plan-only')) return
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout='10s'")
    const preview = await backfillUserLogins(client, sources)
    const backup = `migration/data/user-logins-local-before-${Date.now()}.json.gz`
    fs.writeFileSync(backup, Buffer.from(preview.snapshotGzip, 'base64'), { mode: 0o600 })
    const apply = process.argv.includes('--apply')
    if (apply) await backfillUserLogins(client, sources, true, preview.beforeHash)
    await client.query(apply ? 'COMMIT' : 'ROLLBACK')
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', backup, ...preview.stats }))
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { await client.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
