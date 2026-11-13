import dotenv from 'dotenv'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { applyProviderMerge, inspectProviderMerge } from './mergeAccessProvider'

// Temporary tables shadow app tables; never modifies customer data.
describe.skipIf(process.env.DATASET_INTEGRATION !== '1')('access provider consolidation on Postgres', () => {
  let client: pg.Client
  beforeAll(async () => {
    dotenv.config()
    const uri = process.env.DATABASE_URI
    if (!uri || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname)) throw Error('Local Postgres required')
    client = new pg.Client({ connectionString: uri })
    await client.connect()
    await client.query(`CREATE TEMP TABLE access_providers(id int PRIMARY KEY,name text,plan text,status text,license_expires_at timestamptz,updated_at timestamptz DEFAULT now());
      CREATE TEMP TABLE access_providers_allowed_domains(id varchar PRIMARY KEY,_parent_id int REFERENCES access_providers(id) ON DELETE CASCADE,_order int,domain text);
      CREATE TEMP TABLE users(id int PRIMARY KEY,access_provider_id int REFERENCES access_providers(id) ON DELETE SET NULL,updated_at timestamptz DEFAULT now(),password text,status text,verified boolean,preferences jsonb);
      CREATE TEMP TABLE discount_codes(id int PRIMARY KEY,access_provider_id int REFERENCES access_providers(id) ON DELETE SET NULL,updated_at timestamptz DEFAULT now(),percent_off int,max_uses int);`)
  })
  afterAll(async () => { await client?.end() })
  beforeEach(async () => {
    await client.query(`TRUNCATE access_providers_allowed_domains,users,discount_codes,access_providers;
      INSERT INTO access_providers(id,name,plan,status,license_expires_at) VALUES (1,'Subsidiary','none','pending',NULL),(2,'Parent','premium','live','2027-12-31'),(3,'Unrelated','base','live',NULL);
      INSERT INTO access_providers_allowed_domains VALUES ('a',1,1,'EXAMPLE.ORG '),('b',1,2,'branch.org'),('c',2,1,'example.org'),('d',3,1,'unrelated.org');
      INSERT INTO users(id,access_provider_id,password,status,verified,preferences) VALUES (1,1,'keep-secret-hash','suspended',false,'[3,5]'),(2,2,'parent-hash','active',true,'[5]'),(3,3,'other-hash','active',true,'[]');
      INSERT INTO discount_codes(id,access_provider_id,percent_off,max_uses) VALUES (1,1,25,10),(2,3,50,2);`)
  })
  it('previews without writes, transfers all references, deduplicates domains and preserves subscription and account fields', async () => {
    const { preview } = await inspectProviderMerge(client, 1, 2)
    expect(preview.source.users).toBe(1)
    expect(preview.target).toMatchObject({ name: 'Parent', plan: 'premium', status: 'live', users: 1 })
    expect(preview.domainsToAdd).toEqual(['branch.org'])
    expect(preview.discountCodesToMove).toBe(1)
    expect((await client.query('SELECT count(*)::int AS n FROM access_providers')).rows[0].n).toBe(3)
    const before = (await client.query('SELECT * FROM users ORDER BY id')).rows
    const providersBefore = (await client.query('SELECT * FROM access_providers WHERE id IN (2,3) ORDER BY id')).rows
    await client.query('BEGIN')
    try { await applyProviderMerge(client, 1, 2, preview.fingerprint); await client.query('COMMIT') }
    catch (error) { await client.query('ROLLBACK'); throw error }
    const after = (await client.query('SELECT * FROM users ORDER BY id')).rows
    expect(after[0]).toMatchObject({ ...before[0], access_provider_id: 2, updated_at: expect.any(Date) })
    expect(after.slice(1)).toEqual(before.slice(1))
    expect((await client.query('SELECT * FROM access_providers WHERE id IN (2,3) ORDER BY id')).rows).toEqual(providersBefore.map(p => p.id === 2 ? { ...p, updated_at: expect.any(Date) } : p))
    expect((await client.query('SELECT domain FROM access_providers_allowed_domains WHERE _parent_id=2 ORDER BY _order')).rows).toEqual([{ domain: 'example.org' }, { domain: 'branch.org' }])
    expect((await client.query('SELECT access_provider_id,percent_off,max_uses FROM discount_codes WHERE id=1')).rows[0]).toEqual({ access_provider_id: 2, percent_off: 25, max_uses: 10 })
    expect((await client.query('SELECT id FROM access_providers ORDER BY id')).rows).toEqual([{ id: 2 }, { id: 3 }])
    await expect(inspectProviderMerge(client, 1, 2)).rejects.toThrow('no longer exists')
  })
  it('rejects stale previews when subscription, domains, user assignments or discount assignments change', async () => {
    for (const sql of ["UPDATE access_providers SET plan='base' WHERE id=2", "UPDATE access_providers_allowed_domains SET domain='changed.org' WHERE id='a'", 'UPDATE users SET access_provider_id=2 WHERE id=1', 'UPDATE discount_codes SET access_provider_id=2 WHERE id=1']) {
      const { preview } = await inspectProviderMerge(client, 1, 2)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await expect(applyProviderMerge(client, 1, 2, preview.fingerprint)).rejects.toThrow('changed since the preview')
      } finally { await client.query('ROLLBACK') }
    }
  })
  it('rolls back domain and user moves when a later write fails', async () => {
    const { preview } = await inspectProviderMerge(client, 1, 2)
    await client.query('ALTER TABLE discount_codes ADD CONSTRAINT synthetic_block CHECK(access_provider_id<>2)')
    await client.query('BEGIN')
    try { await expect(applyProviderMerge(client, 1, 2, preview.fingerprint)).rejects.toThrow() }
    finally { await client.query('ROLLBACK'); await client.query('ALTER TABLE discount_codes DROP CONSTRAINT synthetic_block') }
    expect((await client.query('SELECT access_provider_id FROM users WHERE id=1')).rows[0].access_provider_id).toBe(1)
    expect((await client.query('SELECT count(*)::int AS n FROM access_providers')).rows[0].n).toBe(3)
    expect((await client.query('SELECT count(*)::int AS n FROM access_providers_allowed_domains')).rows[0].n).toBe(4)
  })
})
