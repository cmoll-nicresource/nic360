import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function EventSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ order?: string; session_id?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  let order = null
  if (sp.order) {
    const candidate = await payload.findByID({ collection: 'orders', id: sp.order, depth: 0, overrideAccess: true }).catch(() => null)
    if (candidate && user && 'collection' in user && user.collection === 'users' && candidate.buyer === user.id) {
      order = candidate
    }
  }

  return (
    <div className="page">
      <h1>Thank you!</h1>
      {order ? (
        <div className="card">
          <p>
            Order status: <strong>{order.status}</strong>
          </p>
          {order.status !== 'paid' && (
            <p className="muted">
              If you just completed payment, this can take a few seconds to update — refresh the
              page.
            </p>
          )}
          <p>
            <Link href="/account">View your registrations on your account page</Link>
          </p>
        </div>
      ) : (
        <p className="muted">
          Your payment is being processed. Check <Link href="/account">your account</Link> for your
          tickets shortly.
        </p>
      )}
      <p>
        <Link href={`/events/${id}`}>&larr; Back to event</Link>
      </p>
    </div>
  )
}
