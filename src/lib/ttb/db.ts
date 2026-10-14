import type { Payload } from 'payload'
import type pg from 'pg'

/**
 * Run `fn` inside one transaction against Payload's own Postgres pool,
 * rolling back if it throws. The ttb schemas (ref/trade/report) live in the
 * same database Payload manages (see sql in migration/ttb — namespaced so
 * Payload's own schema-push never touches them), so this reuses
 * payload.db.pool rather than opening a second connection pool, matching
 * the pattern already used in migration/dedupeBills.ts.
 */
export async function withTransaction<T>(payload: Payload, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await payload.db.pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}
