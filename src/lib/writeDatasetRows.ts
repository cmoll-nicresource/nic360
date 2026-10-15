import type { Payload } from 'payload'
import type { PoolClient } from 'pg'
import { withTransaction } from './ttb/db'

type Values = Record<string, unknown>
export type DatasetWriteOptions = {
  datasetId: number
  rows: Values[] | ((client: PoolClient) => Promise<Values[]>)
  replace?: 'all' | { yearKey: string; year: number }
  skipEmpty?: boolean
  mapping?: Record<string, string | null>
  fileId?: number
}

/** Internal trusted-import path; callers enforce staff permissions and validate mapping. */
export async function writeDatasetRows(payload: Payload, options: DatasetWriteOptions) {
  return withTransaction(payload, async (client) => {
    // Serialize CSV and trade refreshes for this dataset. Ordinary readers keep
    // seeing the complete previous version until this transaction commits.
    const locked = await client.query('select id from datasets where id = $1 for update', [
      options.datasetId,
    ])
    if (!locked.rows.length) throw new Error('Dataset no longer exists.')
    const rows = typeof options.rows === 'function' ? await options.rows(client) : options.rows
    if (options.skipEmpty && !rows.length) return { inserted: 0, total: 0, skippedEmpty: true }
    if (options.replace === 'all') {
      await client.query('delete from dataset_rows where dataset_id = $1', [options.datasetId])
    } else if (options.replace) {
      await client.query(
        'delete from dataset_rows where dataset_id = $1 and "values" ->> $2 = $3',
        [options.datasetId, options.replace.yearKey, String(options.replace.year)],
      )
    }
    for (let start = 0; start < rows.length; start += 1000) {
      await client.query(
        `insert into dataset_rows (dataset_id, "values", created_at, updated_at)
        select $1, item, now(), now() from jsonb_array_elements($2::jsonb) as item`,
        [options.datasetId, JSON.stringify(rows.slice(start, start + 1000))],
      )
    }
    const {
      rows: [count],
    } = await client.query<{ total: string }>(
      'select count(*)::text as total from dataset_rows where dataset_id = $1',
      [options.datasetId],
    )
    const total = Number(count.total)
    await client.query(
      `update datasets set last_import_imported_at = now(), last_import_row_count = $2,
      last_import_file_id = case when $3::boolean then $4::integer else last_import_file_id end,
      last_import_mapping = case when $5::boolean then $6::jsonb else last_import_mapping end,
      updated_at = now() where id = $1`,
      [
        options.datasetId,
        total,
        options.fileId !== undefined,
        options.fileId ?? null,
        options.mapping !== undefined,
        options.mapping === undefined ? null : JSON.stringify(options.mapping),
      ],
    )
    return { inserted: rows.length, total, skippedEmpty: false }
  })
}
