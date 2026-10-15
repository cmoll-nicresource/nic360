/** October 15 staff-approved exception decisions. Preview by default; --apply commits.
 * Snapshot before writes, exact identity checks, one transaction, no emails.
 * The saved staff list's standard Base tier applies to Pillar/Republic; Citi retains Premium.
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import pg from 'pg'

const names = new Map([
  [226, 'Citi'],
  [273, 'Citi Research'],
  [230, 'Citigroup Global Markets Inc.'],
  [322, 'Pillar Clinical Research'],
  [332, 'DRL Enterprises, Inc.'],
  [344, 'PT Djarum'],
  [349, 'JUUL Labs'],
])

async function main() {
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '10s'")
    const { rows: providers } = await client.query(
      'SELECT * FROM access_providers WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE',
      [[...names.keys()]],
    )
    for (const [id, name] of names) {
      const provider = providers.find((p) => p.id === id)
      if (!provider && [226, 273].includes(id)) continue // already consolidated
      if (!provider || provider.name !== name)
        throw new Error(`Provider ${id} differs from reviewed identity`)
    }
    const citi = providers.find((p) => p.id === 230)
    if (citi.plan !== 'premium' || citi.status !== 'live' || citi.license_expires_at)
      throw new Error('Citigroup subscription differs from reviewed state')
    const { rows: domains } = await client.query(
      'SELECT * FROM access_providers_allowed_domains WHERE _parent_id=ANY($1::int[]) ORDER BY _parent_id,_order',
      [[...names.keys()]],
    )
    if (domains.some((d) => [226, 273].includes(d._parent_id)))
      throw new Error('A Citi source now has domains; review before consolidation')
    const { rows: users } = await client.query(
      'SELECT id,access_provider_id,updated_at FROM users WHERE access_provider_id=ANY($1::int[]) ORDER BY id FOR UPDATE',
      [[...names.keys()]],
    )
    for (const id of [322, 332, 344, 349]) {
      const provider = providers.find((p) => p.id === id)
      const allowed = id === 322 || id === 332 || id === 349 ? ['none', 'base'] : ['none']
      if (
        !allowed.includes(provider.plan) ||
        provider.status !== 'live' ||
        provider.license_expires_at
      )
        throw new Error(`Provider ${id} subscription differs from reviewed state`)
    }
    const apply = process.argv.includes('--apply')
    if (apply) {
      await fs.mkdir('migration/data', { recursive: true })
      const file = `migration/data/reviewed-memberships-before-${Date.now()}.json`
      await fs.writeFile(file, JSON.stringify({ providers, domains, users }, null, 2), {
        mode: 0o600,
        flag: 'wx',
      })
      console.log(`Recovery snapshot: ${file}`)
    }
    const moved = await client.query(
      'UPDATE users SET access_provider_id=230,updated_at=now() WHERE access_provider_id=ANY($1::int[]) RETURNING id',
      [[226, 273]],
    )
    const removed = await client.query(
      'DELETE FROM access_providers WHERE id=ANY($1::int[]) RETURNING id',
      [[226, 273]],
    )
    const plans =
      await client.query(`UPDATE access_providers SET plan = CASE WHEN id IN (322,332) THEN 'base'::enum_access_providers_plan ELSE 'none'::enum_access_providers_plan END,
      updated_at=now() WHERE id IN (322,332,344,349) AND plan::text IS DISTINCT FROM CASE WHEN id IN (322,332) THEN 'base' ELSE 'none' END RETURNING id,plan`)
    await client.query(apply ? 'COMMIT' : 'ROLLBACK')
    console.log({
      mode: apply ? 'applied' : 'preview rolled back',
      citiReadersMoved: moved.rowCount,
      citiProvidersMerged: removed.rowCount,
      planChanges: plans.rows,
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
