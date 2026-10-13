import { NextResponse, type NextRequest } from 'next/server'

/**
 * Stamps the current pathname onto a request header so Server Components
 * (which don't otherwise receive the URL) can read it via `headers()` — used
 * by SiteNav to log page views. Pure header manipulation, no DB access here,
 * so this stays cheap on every matched request.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  // Front-end pages only: skip /admin (Payload has its own activity log),
  // /api, Next internals and static files.
  matcher: ['/((?!admin|api|_next/static|_next/image|favicon.ico|logo.png).*)'],
}
