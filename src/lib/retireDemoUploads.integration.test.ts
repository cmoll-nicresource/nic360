import { createRequire } from 'node:module'
import dotenv from 'dotenv'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const { inspect, apply } = createRequire(import.meta.url)('../../migration/retireMissingDemoUploads.cjs')

describe.skipIf(process.env.DATASET_INTEGRATION !== '1')('approved demo-upload retirement on Postgres', () => {
  let client: pg.Client
  beforeAll(async () => {
    dotenv.config()
    const uri = process.env.DATABASE_URI
    if (!uri || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname)) throw Error('Local Postgres required')
    client = new pg.Client({ connectionString: uri })
    await client.connect()
    await client.query(`CREATE TEMP TABLE media(id int PRIMARY KEY,filename text,filesize bigint,alt text);
      CREATE TEMP TABLE guide_files(id int PRIMARY KEY,filename text,filesize bigint);
      CREATE TEMP TABLE guides(id int PRIMARY KEY,file_id int REFERENCES guide_files(id),thumbnail_id int REFERENCES media(id),title text);
      CREATE TEMP TABLE _guides_v(id int PRIMARY KEY,parent_id int REFERENCES guides(id),latest boolean,version_file_id int REFERENCES guide_files(id),version_thumbnail_id int REFERENCES media(id),body text);
      CREATE TEMP TABLE datasets(id int PRIMARY KEY,last_import_file_id int REFERENCES media(id),title text);
      CREATE TEMP TABLE speakers(id int PRIMARY KEY,headshot_id int REFERENCES media(id),name text);
      CREATE TEMP TABLE sponsors(id int PRIMARY KEY,logo_id int REFERENCES media(id),name text);
      CREATE TEMP TABLE users(id int PRIMARY KEY,avatar_id int REFERENCES media(id),password text);
      CREATE TEMP TABLE dataset_rows(id int PRIMARY KEY,dataset_id int REFERENCES datasets(id),value text);`)
  })
  afterAll(async () => { await client?.end() })
  beforeEach(async () => {
    await client.query(`TRUNCATE media,guide_files,guides,_guides_v,datasets,speakers,sponsors,users,dataset_rows;
      INSERT INTO media VALUES
      (83,'nic360-trademark-placeholder-7.png',68,'demo'),(84,'international-tax-rates-5.csv',361,'sample'),
      (85,'cigarette-market-share-by-company-5.csv',417,'sample'),(86,'nic360-guide-thumbnail-5.png',68,'demo'),
      (87,'nic360-Altria-ad-placeholder.png',68,'demo'),(88,'nic360-BAT-Group-ad-placeholder.png',68,'demo'),
      (89,'nic360-JUUL-Labs-ad-placeholder.png',68,'demo'),(90,'nic360-Speaker-headshot-placeholder-3.png',68,'demo'),
      (91,'nic360-Sponsor-logo-placeholder-3.png',68,'demo'),(100,'real-image.png',12345,'keep');
      INSERT INTO guide_files VALUES (13,'nic360-guide-placeholder-5.pdf',239),(24,'real-24.pdf',100),(25,'real-25.pdf',100),(26,'real-26.pdf',100),(27,'real-27.pdf',100),(28,'real-28.pdf',100);
      INSERT INTO guides VALUES (58,28,86,'US Tax Guide'),(59,27,86,'Tax Guide'),(60,25,86,'FDA Regulation'),(61,24,86,'EU-TPD'),(62,26,86,'FCTC');
      INSERT INTO _guides_v SELECT id,id,false,13,86,'obsolete demo' FROM guides;
      INSERT INTO _guides_v SELECT id+5,id,true,file_id,86,'real guide history' FROM guides;
      INSERT INTO datasets VALUES (124,84,'Tax data'),(126,85,'Market data');
      INSERT INTO dataset_rows VALUES (1,124,'real migrated data'),(2,126,'real migrated data');
      INSERT INTO speakers SELECT n,90,'Speaker '||n FROM generate_series(61,65) n;
      INSERT INTO sponsors SELECT n,91,'Sponsor '||n FROM generate_series(37,39) n;
      INSERT INTO users VALUES (1,100,'unchanged-synthetic-hash');`)
  })
  it('retires only the ten assets and obsolete versions, preserving current PDFs, datasets, profiles and all other fields', async () => {
    const before = await inspect(client)
    await client.query('BEGIN')
    try { expect((await apply(client, before.fingerprint)).retiredUploads).toBe(10); await client.query('COMMIT') }
    catch (error) { await client.query('ROLLBACK'); throw error }
    expect((await client.query('SELECT id FROM media')).rows).toEqual([{ id: 100 }])
    expect((await client.query('SELECT id FROM guide_files ORDER BY id')).rows.map(r => r.id)).toEqual([24,25,26,27,28])
    expect((await client.query('SELECT id,file_id,thumbnail_id FROM guides ORDER BY id')).rows).toEqual(before.snapshot.rows.guides.map((g: { id: number; file_id: number }) => ({ id: g.id, file_id: g.file_id, thumbnail_id: null })))
    expect((await client.query('SELECT count(*)::int AS n FROM _guides_v WHERE latest=true AND version_file_id<>13')).rows[0].n).toBe(5)
    expect((await client.query('SELECT value FROM dataset_rows ORDER BY id')).rows).toEqual([{ value: 'real migrated data' }, { value: 'real migrated data' }])
    expect((await client.query('SELECT * FROM users')).rows).toEqual([{ id: 1, avatar_id: 100, password: 'unchanged-synthetic-hash' }])
    expect((await client.query('SELECT count(*)::int AS n FROM sponsors')).rows[0].n).toBe(3)
  })
  it('rejects an ID reused for real content, unexpected user references and stale previews', async () => {
    await client.query("UPDATE media SET filename='real-company-logo.png' WHERE id=83")
    await expect(inspect(client)).rejects.toThrow('identity changed')
    await client.query("UPDATE media SET filename='nic360-trademark-placeholder-7.png' WHERE id=83")
    await client.query('UPDATE users SET avatar_id=83 WHERE id=1')
    await expect(inspect(client)).rejects.toThrow('Asset references changed: users.avatar_id')
    await client.query('UPDATE users SET avatar_id=100 WHERE id=1')
    const before = await inspect(client)
    await client.query("UPDATE sponsors SET name='Staff edited this sponsor' WHERE id=37")
    await expect(apply(client, before.fingerprint)).rejects.toThrow('Snapshot changed')
    expect((await client.query('SELECT count(*)::int AS n FROM media')).rows[0].n).toBe(10)
  })
  it('rolls back earlier link/history changes if asset deletion fails', async () => {
    const before = await inspect(client)
    await client.query(`CREATE FUNCTION pg_temp.reject_demo_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic deletion failure'; END $$;
      CREATE TRIGGER reject_demo_delete BEFORE DELETE ON media FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_demo_delete();`)
    await client.query('BEGIN')
    try { await expect(apply(client, before.fingerprint)).rejects.toThrow('synthetic deletion failure') }
    finally { await client.query('ROLLBACK'); await client.query('DROP TRIGGER reject_demo_delete ON media') }
    expect((await inspect(client)).fingerprint).toBe(before.fingerprint)
  })
})
