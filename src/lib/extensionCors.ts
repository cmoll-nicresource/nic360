import { CLIPPER_ORIGIN } from '@/config/extension'
export function extensionCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' }
  if (origin !== CLIPPER_ORIGIN) return headers
  return { ...headers, 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
}
export function extensionOptionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: extensionCorsHeaders(request.headers.get('origin')) })
}
