import { getPayload } from 'payload'
import config from '@/payload.config'
import { exchangeClipperCode, isClipperOrigin } from '@/lib/clipperAuth'
import { extensionCorsHeaders, extensionOptionsResponse } from '@/lib/extensionCors'
export const OPTIONS = extensionOptionsResponse
export async function POST(request: Request) {
  const headers = extensionCorsHeaders(request.headers.get('origin'))
  if (!isClipperOrigin(request)) return Response.json({ error: 'Invalid extension origin.' }, { status: 403, headers })
  const input = await request.json().catch(() => null)
  const result = input && await exchangeClipperCode(await getPayload({ config }), input)
  return result ? Response.json(result, { headers }) : Response.json({ error: 'Connection expired or invalid. Please connect again.' }, { status: 401, headers })
}
