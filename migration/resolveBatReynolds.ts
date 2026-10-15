/** Complete the previously approved BAT/Reynolds reader grouping.
 * Keeps the old provider records and existing email preferences; sends no email.
 * Default is a rolled-back preview. Add --apply to commit.
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import pg from 'pg'

const sourceNames = new Map([
  [148, 'R.J. Reynolds Tobacco Company'],
  [176, 'Reynolds American Services Inc'],
  [200, 'Reynolds American Inc.'],
  [211, 'R.J. Reynolds Tobacco Company (North Carolina)'],
])

async function main() {
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '10s'")
    const { rows: providers } = await client.query(
      'SELECT * FROM access_providers WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
      [[102, ...sourceNames.keys()]],
    )
    const target = providers.find((p) => p.id === 102)
    if (
      !target ||
      target.name !== 'British American Tobacco' ||
      target.plan !== 'premium' ||
      target.status !== 'live' ||
      target.license_expires_at
    )
      throw new Error('BAT subscription differs from the reviewed assignment')
    for (const [id, name] of sourceNames) {
      const provider = providers.find((p) => p.id === id)
      if (!provider || provider.name !== name || provider.plan !== 'none')
        throw new Error(`Provider ${id} differs from the reviewed record`)
    }
    const { rows: users } = await client.query(
      'SELECT id,access_provider_id,updated_at FROM users WHERE access_provider_id=ANY($1::int[]) ORDER BY id FOR UPDATE',
      [[...sourceNames.keys()]],
    )
    const apply = process.argv.includes('--apply')
    if (apply && users.length) {
      await fs.mkdir('migration/data', { recursive: true })
      const file = `migration/data/bat-reynolds-before-${Date.now()}.json`
      await fs.writeFile(file, JSON.stringify({ providers, users }, null, 2), {
        mode: 0o600,
        flag: 'wx',
      })
      console.log(`Recovery snapshot: ${file}`)
    }
    const result = await client.query(
      'UPDATE users SET access_provider_id=102,updated_at=now() WHERE id=ANY($1::int[]) RETURNING id',
      [users.map((u) => u.id)],
    )
    await client.query(apply ? 'COMMIT' : 'ROLLBACK')
    console.log({
      mode: apply ? 'applied' : 'preview rolled back',
      readersMoved: result.rowCount,
      targetProvider: 102,
    })
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
