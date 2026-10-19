import { getPayload } from 'payload'
import config from '@/payload.config'
import { authenticateClipper, hashClipperSecret } from '@/lib/clipperAuth'
import { extensionCorsHeaders, extensionOptionsResponse } from '@/lib/extensionCors'
import { CLIPPER_CLIENTS } from '@/config/extension'
export const OPTIONS = extensionOptionsResponse
export async function POST(request: Request) {
  const headers = extensionCorsHeaders(request.headers.get('origin'))
  const payload = await getPayload({ config })
  const kind = CLIPPER_CLIENTS.find(client => client.origin === request.headers.get('origin'))?.kind
  const user = await authenticateClipper(payload, request, kind)
  if (!user) return Response.json({ error: 'Connection expired or already disconnected.' }, { status: 401, headers })
  await payload.db.pool.query('UPDATE clipper.connections SET revoked_at=now() WHERE token_hash=$1 AND staff_id=$2',
    [hashClipperSecret(request.headers.get('authorization')!.slice(7)), user.id])
  return Response.json({ disconnected: true }, { headers })
}
