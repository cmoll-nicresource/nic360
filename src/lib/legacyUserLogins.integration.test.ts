import pg from 'pg'
import { gunzipSync } from 'node:zlib'
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { backfillUserLogins } from './legacyUserLogins'

describe.skipIf(process.env.LOGIN_BACKFILL_INTEGRATION !== '1')('login backfill on isolated Postgres', () => {
  let client: pg.Client
  const sources = [
    { legacyId: 'old1', email: 'empty@example.invalid', lastLoginAt: '2026-10-10T12:00:00.000Z' },
    { legacyId: 'old2', email: 'older@example.invalid', lastLoginAt: '2026-10-10T12:00:00.000Z' },
    { legacyId: 'old3', email: 'newer@example.invalid', lastLoginAt: '2026-10-10T12:00:00.000Z' },
    { legacyId: 'old4', email: 'absent@example.invalid', lastLoginAt: '2026-10-10T12:00:00.000Z' },
  ]
  beforeAll(async () => {
    const uri = new URL(process.env.DATABASE_URI!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname) || !uri.pathname.endsWith('_test')) throw new Error('Disposable loopback _test database required')
    client = new pg.Client({ connectionString: uri.href })
    await client.connect()
    await client.query('CREATE TEMP TABLE users(id int PRIMARY KEY,email text,last_login_at timestamptz,password text,status text,access_provider_id int,updated_at timestamptz)')
  })
  beforeEach(async () => {
    await client.query('ROLLBACK')
    await client.query('TRUNCATE users')
    await client.query(`INSERT INTO users VALUES
      (1,' EMPTY@EXAMPLE.INVALID ',NULL,'keep-password','suspended',12,'2026-10-01'),
      (2,'older@example.invalid','2026-01-01','keep-password','active',13,'2026-10-01'),
      (3,'newer@example.invalid','2026-10-18','keep-password','active',14,'2026-10-01'),
      (4,'unmatched@example.invalid',NULL,'keep-password','active',15,'2026-10-01')`)
    await client.query('BEGIN')
  })
  afterAll(async () => { await client?.end() })
  it('previews without writes and snapshots only identity, login date and a checksum of other fields', async () => {
    const result = await backfillUserLogins(client, sources)
    expect(result.stats).toMatchObject({ matchedReaders: 3, unmatchedReaders: 1, updated: 2, filledEmpty: 1, advancedOlder: 1, preservedNewer: 1 })
    const backup = JSON.parse(gunzipSync(Buffer.from(result.snapshotGzip, 'base64')).toString())
    expect(backup[0].last_login_at).toBeNull()
    expect(Object.keys(backup[0]).sort()).toEqual(['email', 'id', 'last_login_at', 'unchanged_hash'])
    expect((await client.query('SELECT last_login_at FROM users WHERE id=1')).rows[0].last_login_at).toBeNull()
  })
  it('fills blanks, advances older dates, preserves newer logins and leaves all other reader fields untouched', async () => {
    const preview = await backfillUserLogins(client, sources)
    await backfillUserLogins(client, sources, true, preview.beforeHash)
    const rows = (await client.query('SELECT * FROM users ORDER BY id')).rows
    expect(rows.slice(0, 3).map(row => row.last_login_at.toISOString())).toEqual(['2026-10-10T12:00:00.000Z', '2026-10-10T12:00:00.000Z', '2026-10-18T00:00:00.000Z'])
    expect(rows[3].last_login_at).toBeNull()
    expect(rows[0]).toMatchObject({ password: 'keep-password', status: 'suspended', access_provider_id: 12 })
    expect((await backfillUserLogins(client, sources)).stats).toMatchObject({ updated: 0, alreadyCorrect: 2, preservedNewer: 1 })
  })
  it('rejects a stale snapshot after a new login instead of overwriting it', async () => {
    const preview = await backfillUserLogins(client, sources)
    await client.query("UPDATE users SET last_login_at='2026-10-18' WHERE id=1")
    await expect(backfillUserLogins(client, sources, true, preview.beforeHash)).rejects.toThrow('changed since preview')
  })
  it('requires a snapshot and rejects ambiguous source identities', async () => {
    await expect(backfillUserLogins(client, sources, true)).rejects.toThrow('snapshot')
    await expect(backfillUserLogins(client, [...sources, sources[0]])).rejects.toThrow('duplicate legacy')
  })
})
