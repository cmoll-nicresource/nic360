import dotenv from 'dotenv'
import pg from 'pg'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { COMPANY_USAGE_SQL } from './companyUsage'

// Temporary tables shadow app tables; no real readers or analytics are changed.
describe.skipIf(process.env.DATASET_INTEGRATION !== '1')('company usage SQL on Postgres', () => {
  let client: pg.Client
  beforeAll(async () => {
    dotenv.config()
    const uri = process.env.DATABASE_URI
    if (!uri || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname))
      throw Error('Local Postgres required')
    client = new pg.Client({ connectionString: uri })
    await client.connect()
    await client.query(`CREATE TEMP TABLE users(id int primary key,email text,first_name text,last_name text,status text,access_provider_id int);
      CREATE TEMP TABLE page_views(id serial,visitor_id int,path text,created_at timestamptz);
      INSERT INTO users VALUES (1,'a@example.invalid','A','Reader','active',10),(2,'zero@example.invalid',NULL,NULL,'suspended',10),(3,'other@example.invalid',NULL,NULL,'active',20);
      INSERT INTO page_views(visitor_id,path,created_at) VALUES
      (1,'/articles/a','2026-03-08T04:59:59.999Z'),(1,'/articles/a','2026-03-08T05:00:00Z'),
      (1,'/articles/a','2026-03-09T03:59:59.999Z'),(1,'/bills/b','2026-03-09T04:00:00Z'),
      (3,'/articles/other','2026-03-08T12:00:00Z'),(NULL,'/','2026-03-08T12:00:00Z'),
      (1,'/datasets','2026-11-01T04:00:00Z'),(1,'/datasets','2026-11-02T04:59:59.999Z'),(1,'/datasets','2026-11-02T05:00:00Z');`)
  })
  afterAll(async () => {
    await client?.end()
  })
  it('includes complete Eastern days across spring DST, excludes other providers and keeps zero-usage users', async () => {
    const { rows } = await client.query(COMPANY_USAGE_SQL, [10, '2026-03-08', '2026-03-08'])
    expect(rows.map((r) => [r.id, r.views, r.days, r.pages])).toEqual([
      [1, 2, 1, 1],
      [2, 0, 0, 0],
    ])
    expect(rows[0].paths).toEqual([{ path: '/articles/a', count: 2 }])
    expect(rows[1].first_view).toBeNull()
  })
  it('handles the 25-hour fall DST day and the exclusive following midnight', async () => {
    const { rows } = await client.query(COMPANY_USAGE_SQL, [10, '2026-11-01', '2026-11-01'])
    expect(rows[0].views).toBe(2)
    expect(rows[0].days).toBe(1)
  })
  it('does not truncate history at the existing analytics 10,000-view cap', async () => {
    await client.query(
      "INSERT INTO page_views(visitor_id,path,created_at) SELECT 1,'/publications/test','2026-10-16T12:00:00Z' FROM generate_series(1,10001)",
    )
    const { rows } = await client.query(COMPANY_USAGE_SQL, [10, '2026-10-16', '2026-10-16'])
    expect(rows[0].views).toBe(10001)
    expect(rows[0].paths[0].count).toBe(10001)
  })
  it('returns an empty result for a provider without users', async () => {
    expect((await client.query(COMPANY_USAGE_SQL, [99, '2026-01-01', '2026-12-31'])).rows).toEqual(
      [],
    )
  })
})
