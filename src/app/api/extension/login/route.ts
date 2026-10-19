import { extensionCorsHeaders, extensionOptionsResponse } from '@/lib/extensionCors'
export const OPTIONS = extensionOptionsResponse
export async function POST(request: Request) {
  return Response.json({ error: 'Update the N360 News Clipper and use Connect to Nicotine360. Password sign-in is no longer supported here.' },
    { status: 410, headers: extensionCorsHeaders(request.headers.get('origin')) })
}
