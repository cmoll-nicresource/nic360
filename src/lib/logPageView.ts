import type { Payload, PayloadRequest } from 'payload'

/**
 * Records one front-end page visit for first-party traffic reporting.
 * Staff aren't tracked — only users (and anonymous visitors, with a blank
 * visitor). Never throws — analytics must never break a page render. Call
 * this inside `after()` (next/server) so it runs once the response has
 * already been sent, instead of adding latency to the page itself.
 */
export async function logPageView(payload: Payload, path: string, user: PayloadRequest['user']) {
  if (user && 'collection' in user && user.collection === 'staff') return

  try {
    const visitor = user && 'collection' in user && user.collection === 'users' ? user.id : undefined

    await payload.create({
      collection: 'page-views',
      data: { path, visitor },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('logPageView failed', err)
  }
}
