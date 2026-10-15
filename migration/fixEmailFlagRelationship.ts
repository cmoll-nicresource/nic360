/** Add/backfill the retained address before deploying the nullable user relationship.
 * Preview (default): pnpm exec tsx migration/fixEmailFlagRelationship.ts
 * Apply: pnpm exec tsx migration/fixEmailFlagRelationship.ts --apply
 * Does not initialize Payload, reconcile unrelated schema, or send email.
 */
import 'dotenv/config'
import pg from 'pg'
import { migrateEmailFlagSchema } from '../src/lib/emailFlagSchema'

async function main() {
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '10s'")
    await migrateEmailFlagSchema(client as unknown as pg.PoolClient)
    const { rows } = await client.query(`SELECT count(*)::int flags,
      count(recipient_email)::int retained_addresses FROM email_flags`)
    const apply = process.argv.includes('--apply')
    await client.query(apply ? 'COMMIT' : 'ROLLBACK')
    console.log({ mode: apply ? 'applied' : 'preview rolled back', ...rows[0] })
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
