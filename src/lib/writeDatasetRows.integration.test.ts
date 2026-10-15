import dotenv from 'dotenv'
import pg from 'pg'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { writeDatasetRows } from './writeDatasetRows'

// Session-local TEMP tables shadow the app tables. No real content is modified.
describe.skipIf(process.env.DATASET_INTEGRATION !== '1')(
  'atomic dataset imports on Postgres',
  () => {
    let pool: pg.Pool
    let payload: Payload
    beforeAll(async () => {
    dotenv.config()
      const uri = process.env.DATABASE_URI
      if (!uri || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname))
        throw new Error('Local Postgres required')
      pool = new pg.Pool({ connectionString: uri, max: 1 })
      payload = { db: { pool } } as unknown as Payload
      await pool.query(`create temp table datasets (id integer primary key, updated_at timestamptz,
      last_import_imported_at timestamptz, last_import_row_count numeric, last_import_file_id integer check (last_import_file_id >= 0), last_import_mapping jsonb)`)
      await pool.query(`create temp table dataset_rows (id bigint generated always as identity, dataset_id integer references pg_temp.datasets(id),
      "values" jsonb not null check (coalesce(("values" ->> 'reject')::boolean,false) = false), created_at timestamptz, updated_at timestamptz)`)
    })
    beforeEach(async () => {
      await pool.query('truncate pg_temp.dataset_rows, pg_temp.datasets')
      await pool.query('insert into datasets (id,last_import_row_count) values (1,0),(2,0)')
    })
    afterAll(async () => {
      await pool?.end()
    })
    it('replaces every matching year past 20,000 rows, preserves other years/datasets, and is idempotent', async () => {
      await writeDatasetRows(payload, {
        datasetId: 1,
        rows: Array.from({ length: 21050 }, (_, index) => ({
          year: index < 20500 ? 2026 : 2025,
          index,
        })),
      })
      await writeDatasetRows(payload, { datasetId: 2, rows: [{ year: 2026, other: true }] })
      for (let run = 0; run < 2; run++)
        expect(
          await writeDatasetRows(payload, {
            datasetId: 1,
            rows: [{ year: 2026, fresh: true }],
            replace: { yearKey: 'year', year: 2026 },
          }),
        ).toMatchObject({ inserted: 1, total: 551 })
      expect(
        (
          await pool.query(
            "select count(*)::int as n from dataset_rows where dataset_id=1 and \"values\"->>'year'='2026'",
          )
        ).rows[0].n,
      ).toBe(1)
      expect(
        (await pool.query('select last_import_row_count::int as n from datasets where id=1'))
          .rows[0].n,
      ).toBe(551)
      expect(
        (await pool.query('select count(*)::int as n from dataset_rows where dataset_id=2')).rows[0]
          .n,
      ).toBe(1)
    })
    it('rolls back deletion and earlier batches if a later batch fails', async () => {
      await writeDatasetRows(payload, {
        datasetId: 1,
        rows: [{ old: true }],
        mapping: { A: 'old' },
      })
      const before = (await pool.query('select * from datasets where id=1')).rows[0]
      await expect(
        writeDatasetRows(payload, {
          datasetId: 1,
          replace: 'all',
          rows: [...Array.from({ length: 1000 }, () => ({ new: true })), { reject: true }],
          mapping: { A: 'new' },
        }),
      ).rejects.toThrow()
      expect((await pool.query('select "values" from dataset_rows')).rows).toEqual([
        { values: { old: true } },
      ])
      expect((await pool.query('select * from datasets where id=1')).rows[0]).toEqual(before)
    })
    it('rolls back rows when import metadata fails, and keeps data when no trade facts are available', async () => {
      await writeDatasetRows(payload, { datasetId: 1, rows: [{ old: true }] })
      await expect(
        writeDatasetRows(payload, {
          datasetId: 1,
          replace: 'all',
          rows: [{ new: true }],
          fileId: -1,
        }),
      ).rejects.toThrow()
      expect(
        await writeDatasetRows(payload, {
          datasetId: 1,
          replace: 'all',
          rows: [],
          skipEmpty: true,
        }),
      ).toMatchObject({ skippedEmpty: true })
      expect((await pool.query('select "values" from dataset_rows')).rows).toEqual([
        { values: { old: true } },
      ])
    })
  },
)
