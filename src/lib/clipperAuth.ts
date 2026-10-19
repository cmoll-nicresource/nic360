import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import { CLIPPER_CLIENTS } from '@/config/extension'
import { staffHasRole } from '@/access/staffRoles'
import { withTransaction } from '@/lib/ttb/db'

export const CLIPPER_TTL_SECONDS = 12 * 60 * 60
export const hashClipperSecret = (value: string) => createHash('sha256').update(value).digest('hex')
export const pkceChallenge = (value: string) => createHash('sha256').update(value).digest('base64url')
const credentialVersion = (staff: { hash: string; salt: string }) => hashClipperSecret(`${staff.hash}:${staff.salt}`)
export type ConnectRequest = { redirect_uri: string; code_challenge: string; state: string }

export function validConnectRequest(value: unknown): value is ConnectRequest {
  if (!value || typeof value !== 'object') return false
  const v = value as ConnectRequest
  return CLIPPER_CLIENTS.some(client => client.redirect === v.redirect_uri) && typeof v.code_challenge === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(v.code_challenge) && typeof v.state === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(v.state)
}
/** Origin is an additional browser restriction, never proof of identity. */
export const isClipperOrigin = (request: Request) => CLIPPER_CLIENTS.some(client => client.origin === request.headers.get('origin'))
export function isWebsiteOrigin(request: Request) {
  return request.headers.get('origin') === new URL(process.env.SITE_URL || request.url).origin
}
export async function websiteStaff(payload: Payload, request: Request) {
  const { user } = await payload.auth({ headers: request.headers })
  return staffHasRole(user, 'editor') ? user : null
}
export async function issueClipperCode(payload: Payload, staffId: number, input: ConnectRequest) {
  const code = randomBytes(32).toString('base64url')
  await withTransaction(payload, async client => {
    const { rows } = await client.query('SELECT hash, salt, lock_until FROM public.staff WHERE id=$1', [staffId])
    const staff = rows[0]
    if (!staff || (staff.lock_until && new Date(staff.lock_until).getTime() > Date.now())) throw new Error('Staff sign-in required.')
    await client.query('DELETE FROM clipper.codes WHERE expires_at < now()')
    const count = await client.query('SELECT count(*)::int AS total FROM clipper.codes WHERE staff_id=$1 AND created_at > now() - interval \'5 minutes\'', [staffId])
    if (count.rows[0].total >= 10) throw new Error('Too many connection attempts.')
    await client.query(`INSERT INTO clipper.codes(id,code_hash,staff_id,redirect_uri,challenge,credential_version,label,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '2 minutes')`,
    [randomUUID(), hashClipperSecret(code), staffId, input.redirect_uri, input.code_challenge, credentialVersion(staff), CLIPPER_CLIENTS.find(client => client.redirect === input.redirect_uri)!.label])
  })
  const callback = new URL(input.redirect_uri)
  callback.searchParams.set('code', code)
  callback.searchParams.set('state', input.state)
  return callback.toString()
}
export async function exchangeClipperCode(payload: Payload, input: { code?: string; code_verifier?: string; redirect_uri?: string }) {
  if (typeof input.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.code) ||
      typeof input.code_verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(input.code_verifier) || !CLIPPER_CLIENTS.some(client => client.redirect === input.redirect_uri)) return null
  return withTransaction(payload, async client => {
    const { rows } = await client.query(`SELECT c.*, s.hash, s.salt, s.name, s.role, s.lock_until
      FROM clipper.codes c JOIN public.staff s ON s.id=c.staff_id
      WHERE c.code_hash=$1 AND c.used_at IS NULL AND c.expires_at > now() FOR UPDATE OF c`, [hashClipperSecret(input.code!)])
    const row = rows[0]
    if (!row || row.challenge !== pkceChallenge(input.code_verifier!) || row.redirect_uri !== input.redirect_uri ||
        row.credential_version !== credentialVersion(row) || !['editor','gatekeeper','admin'].includes(row.role) ||
        (row.lock_until && new Date(row.lock_until).getTime() > Date.now())) return null
    const token = 'nic360_clip_' + randomBytes(32).toString('base64url'), id = randomUUID()
    const exp = Math.floor(Date.now() / 1000) + CLIPPER_TTL_SECONDS
    await client.query('UPDATE clipper.codes SET used_at=now() WHERE id=$1', [row.id])
    await client.query(`INSERT INTO clipper.connections(id,staff_id,token_hash,credential_version,label,expires_at)
      VALUES($1,$2,$3,$4,$5,to_timestamp($6))`, [id, row.staff_id, hashClipperSecret(token), row.credential_version, row.label, exp])
    return { token, exp, connectionId: id, user: { name: row.name, role: row.role } }
  })
}
/** Opaque credentials work only here, never through Payload's JWT authentication. */
export async function authenticateClipper(payload: Payload, request: Request, kind: 'news' | 'research' = 'news'): Promise<PayloadRequest['user']> {
  const client = CLIPPER_CLIENTS.find(client => client.kind === kind && client.origin === request.headers.get('origin'))
  if (!client) return null
  const match = /^Bearer (nic360_clip_[A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization') || '')
  if (!match) return null
  const { rows } = await payload.db.pool.query(`SELECT c.id, c.staff_id, c.label, c.credential_version, s.hash, s.salt, s.lock_until, s.role
    FROM clipper.connections c JOIN public.staff s ON s.id=c.staff_id
    WHERE c.token_hash=$1 AND c.revoked_at IS NULL AND c.expires_at > now()`, [hashClipperSecret(match[1])])
  const row = rows[0]
  if (!row || row.label !== client.label || row.credential_version !== credentialVersion(row) || !['editor','gatekeeper','admin'].includes(row.role) ||
      (row.lock_until && new Date(row.lock_until).getTime() > Date.now())) return null
  const result = await payload.db.pool.query('UPDATE clipper.connections SET last_used_at=now() WHERE id=$1 AND revoked_at IS NULL AND expires_at > now() RETURNING id', [row.id])
  if (!result.rowCount) return null
  const staff = await payload.findByID({ collection: 'staff', id: row.staff_id, depth: 0 })
  return { ...staff, collection: 'staff' }
}
