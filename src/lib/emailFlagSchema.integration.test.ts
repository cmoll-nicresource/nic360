import dotenv from 'dotenv'
import pg from 'pg'
import { afterAll, beforeAll, expect, it, describe } from 'vitest'
import { migrateEmailFlagSchema } from './emailFlagSchema'

// TEMP tables shadow the real app tables. No real user records are touched.
describe.skipIf(process.env.DATASET_INTEGRATION !== '1')('email flag deletion on Postgres', () => {
  let client: pg.Client
  beforeAll(async () => {
    dotenv.config()
    const uri = process.env.DATABASE_URI
    if (!uri || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname))
      throw new Error('Local Postgres required')
    client = new pg.Client({ connectionString: uri })
    await client.connect()
    await client.query(`CREATE TEMP TABLE users (id integer primary key, email varchar not null);
      CREATE TEMP TABLE email_flags (id integer primary key,
        user_id integer not null references pg_temp.users(id) on delete set null,
        status varchar, reason varchar)`)
  })
  afterAll(async () => {
    await client?.end()
  })
  it('backfills existing flags, permits deletion, preserves suppression history, and is repeatable', async () => {
    await client.query('BEGIN')
    try {
      await client.query(
        "INSERT INTO users VALUES (1,'User@Example.invalid'), (2,'Other@Example.invalid')",
      )
      await client.query(
        "INSERT INTO email_flags VALUES (1,1,'open','cleaned'),(2,2,'resolved','unsubscribed')",
      )
      await migrateEmailFlagSchema(client as unknown as pg.PoolClient)
      await client.query('DELETE FROM users WHERE id=1')
      await migrateEmailFlagSchema(client as unknown as pg.PoolClient)
      expect((await client.query('SELECT * FROM email_flags ORDER BY id')).rows).toEqual([
        {
          id: 1,
          user_id: null,
          recipient_email: 'user@example.invalid',
          status: 'open',
          reason: 'cleaned',
        },
        {
          id: 2,
          user_id: 2,
          recipient_email: 'other@example.invalid',
          status: 'resolved',
          reason: 'unsubscribed',
        },
      ])
    } finally {
      await client.query('ROLLBACK')
    }
  })
})
