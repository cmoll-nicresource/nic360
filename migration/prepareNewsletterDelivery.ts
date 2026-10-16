/** Preview by default. Apply before deploying live newsletter code. */
import 'dotenv/config'
import fs from 'node:fs/promises'
import pg from 'pg'

async function main() {
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required')
  const sql = await fs.readFile(new URL('./newsletterDelivery.sql', import.meta.url), 'utf8')
  const apply = process.argv.includes('--apply')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query(apply ? sql : sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'))
    console.log(
      apply
        ? 'Newsletter schema applied. Sending mode and audience preferences unchanged.'
        : 'Newsletter schema preview succeeded and rolled back.',
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
