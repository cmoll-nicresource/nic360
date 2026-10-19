import { getPayload } from 'payload'
import config from '@/payload.config'
import { isWebsiteOrigin, websiteStaff } from '@/lib/clipperAuth'
import { clipperDisplayName } from '@/config/extension'
const headers = { 'Cache-Control': 'no-store' }
export async function GET(request: Request) {
  const payload = await getPayload({ config }), user = await websiteStaff(payload, request)
  if (!user) return Response.json({ error: 'Staff sign-in required.' }, { status: 401, headers })
  const { rows } = await payload.db.pool.query(`SELECT id,label,created_at,expires_at,last_used_at,revoked_at, (expires_at > now()) AS unexpired
    FROM clipper.connections WHERE staff_id=$1 ORDER BY created_at DESC LIMIT 50`, [user.id])
  return Response.json({ connections: rows.map(row => ({ ...row, label: clipperDisplayName(row.label) })) }, { headers })
}
export async function POST(request: Request) {
  if (!isWebsiteOrigin(request)) return Response.json({ error: 'Invalid origin.' }, { status: 403, headers })
  const payload = await getPayload({ config }), user = await websiteStaff(payload, request)
  if (!user) return Response.json({ error: 'Staff sign-in required.' }, { status: 401, headers })
  const input = await request.json().catch(() => null)
  if (typeof input?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id)) return Response.json({ error: 'Invalid connection.' }, { status: 400, headers })
  const result = await payload.db.pool.query('UPDATE clipper.connections SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND staff_id=$2 RETURNING id', [input.id, user.id])
  return Response.json({ disconnected: !!result.rowCount }, { status: result.rowCount ? 200 : 404, headers })
}
