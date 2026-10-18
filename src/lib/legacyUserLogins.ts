import type { Client } from 'pg'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

export type LegacyUserLogin = { legacyId: string; email: string; lastLoginAt: string }
export const normalizeLoginEmail = (email: string) => email.trim().toLowerCase()

/** Legacy Rails timestamps have no zone in PostgreSQL; interpret their stored UTC values explicitly. */
export function legacyLoginDate(value: string | undefined, now = new Date()): string | null {
  if (!value || value === '\\N') return null
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/.exec(value)
  if (!match) return null
  const iso = `${match[1]}T${match[2]}.${(match[3] || '').padEnd(3, '0').slice(0, 3)}Z`
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== iso || date.getUTCFullYear() < 1900 || date > now) return null
  return iso
}

export function latestLegacyLogin(current: string | undefined, previous: string | undefined, now = new Date()): string | undefined {
  return [legacyLoginDate(current, now), legacyLoginDate(previous, now)]
    .filter((date): date is string => !!date).sort().at(-1)
}

/** Caller owns the transaction. Only last_login_at changes; account hooks and emails never run. */
export async function backfillUserLogins(client: Client, sources: LegacyUserLogin[], apply = false, expectedBeforeHash?: string) {
  const byEmail = new Map(sources.map(source => [normalizeLoginEmail(source.email), source]))
  if (byEmail.size !== sources.length) throw new Error('Ambiguous duplicate legacy email addresses.')
  for (const source of sources)
    if (!source.email.includes('@') || !Number.isFinite(Date.parse(source.lastLoginAt))) throw new Error('Invalid login source.')
  if (apply && !expectedBeforeHash) throw new Error('A saved preview and rollback snapshot are required.')
  const { rows } = await client.query<{ id: number; email: string; last_login_at: Date | null; unchanged_hash: string }>(
    `SELECT u.id,u.email,u.last_login_at,md5((to_jsonb(u)-'last_login_at')::text) AS unchanged_hash
     FROM users u WHERE lower(btrim(u.email))=ANY($1::text[]) ORDER BY u.id FOR UPDATE`,
    [[...byEmail.keys()]],
  )
  const beforeJson = JSON.stringify(rows)
  const beforeHash = createHash('sha256').update(beforeJson).digest('hex')
  if (apply && beforeHash !== expectedBeforeHash) throw new Error('Reader state changed since preview. Create a fresh snapshot.')
  const matched = new Set<string>()
  const changes: { id: number; lastLoginAt: string }[] = []
  const stats = { sourceReaders: sources.length, matchedReaders: rows.length, unmatchedReaders: 0, updated: 0, filledEmpty: 0, advancedOlder: 0, preservedNewer: 0, alreadyCorrect: 0 }
  for (const row of rows) {
    const email = normalizeLoginEmail(row.email)
    if (matched.has(email)) throw new Error('Ambiguous duplicate destination reader emails.')
    matched.add(email)
    const source = byEmail.get(email)!
    const before = row.last_login_at?.getTime()
    const recovered = Date.parse(source.lastLoginAt)
    if (before != null && before >= recovered) {
      if (before === recovered) stats.alreadyCorrect++
      else stats.preservedNewer++
      continue
    }
    changes.push({ id: row.id, lastLoginAt: source.lastLoginAt })
    if (before == null) stats.filledEmpty++
    else stats.advancedOlder++
  }
  stats.unmatchedReaders = sources.length - matched.size
  stats.updated = changes.length
  if (apply) {
    for (const change of changes) {
      const result = await client.query('UPDATE users SET last_login_at=$2 WHERE id=$1 AND (last_login_at IS NULL OR last_login_at<$2::timestamptz)', [change.id, change.lastLoginAt])
      if (result.rowCount !== 1) throw new Error('Login backfill count mismatch.')
    }
    const after = await client.query<{ id: number; unchanged_hash: string }>(
      "SELECT u.id,md5((to_jsonb(u)-'last_login_at')::text) AS unchanged_hash FROM users u WHERE id=ANY($1::int[]) ORDER BY u.id", [rows.map(row => row.id)],
    )
    if (JSON.stringify(after.rows) !== JSON.stringify(rows.map(({ id, unchanged_hash }) => ({ id, unchanged_hash })))) throw new Error('Unexpected change to another reader field; roll back.')
  }
  return { stats, beforeHash, snapshotGzip: gzipSync(beforeJson).toString('base64') }
}
