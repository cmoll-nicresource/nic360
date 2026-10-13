const ALLOWED_ORIGIN_PREFIX = 'chrome-extension://'

/**
 * The browser extension (tma-ext/) calls these two routes cross-origin —
 * every other API route in this app is same-origin, so this is the only
 * place CORS headers are needed. Scoped to extension origins only, and only
 * these routes; the real security boundary is the staff JWT these routes
 * require, not this header (which just controls whether a browser lets the
 * extension's JS read the response).
 */
export function extensionCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !origin.startsWith(ALLOWED_ORIGIN_PREFIX)) return {}

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function extensionOptionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: extensionCorsHeaders(request.headers.get('origin')) })
}
