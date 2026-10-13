import type { Payload } from 'payload'

/**
 * Postgres full-text search (`to_tsvector`/`plainto_tsquery`/`ts_rank`) over
 * one or more plain-text columns of one table, returning matching row ids
 * ranked best-match-first. `table` and `columns` are always our own fixed
 * internal names (never request input) — only `query` and `limit` are
 * user-controlled, and those go through parameterized placeholders.
 *
 * No persisted/indexed tsvector column: this re-scans the table on every
 * call. Fine at this project's scale (dozens to low hundreds of rows per
 * collection); would need a generated+indexed column at real volume.
 */
export async function searchColumnsForIds(
  payload: Payload,
  table: string,
  columns: string[],
  query: string,
  limit = 500,
): Promise<number[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const vectorExpr = columns.map((c) => `coalesce("${c}", '')`).join(" || ' ' || ")
  const sql = `
    select id
    from "${table}"
    where to_tsvector('english', ${vectorExpr}) @@ plainto_tsquery('english', $1)
    order by ts_rank(to_tsvector('english', ${vectorExpr}), plainto_tsquery('english', $1)) desc
    limit $2
  `
  const result = await payload.db.pool.query(sql, [trimmed, limit])
  return result.rows.map((r: { id: number }) => r.id)
}

/** Re-orders `docs` to match `idOrder` (e.g. a full-text search's relevance rank) — Payload's own `find` can't sort by that, so we do it after fetching. */
export function sortByIdOrder<T extends { id: number }>(docs: T[], idOrder: number[]): T[] {
  const rank = new Map(idOrder.map((id, i) => [id, i]))
  return [...docs].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
}
