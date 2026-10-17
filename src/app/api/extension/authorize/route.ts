import { getPayload } from 'payload'
import config from '@/payload.config'
import { isWebsiteOrigin, websiteStaff, validConnectRequest, issueClipperCode } from '@/lib/clipperAuth'
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (!isWebsiteOrigin(request)) return Response.json({ error: 'Open this request on Nicotine360.' }, { status: 403, headers })
  const payload = await getPayload({ config })
  const user = await websiteStaff(payload, request)
  if (!user) return Response.json({ error: 'Staff sign-in required.' }, { status: 401, headers })
  const input = await request.json().catch(() => null)
  if (!validConnectRequest(input)) return Response.json({ error: 'Invalid connection request.' }, { status: 400, headers })
  try { return Response.json({ callback: await issueClipperCode(payload, user.id, input) }, { headers }) }
  catch { return Response.json({ error: 'Unable to connect. Please sign in again or wait five minutes before retrying.' }, { status: 400, headers }) }
}
