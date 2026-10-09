import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { SiteNav } from '@/components/SiteNav'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const isReader = !!user && 'collection' in user && user.collection === 'users'

  return (
    <>
      <SiteNav />
      <div className="page">
        <h1>Nicotine360</h1>
        <p className="muted">
          Industry news, legislation, trademarks, data and events for the nicotine and tobacco
          industry.
        </p>
        <div className="card">
          {isReader && (
            <p>
              Welcome back. <Link href="/dashboard">Go to your dashboard →</Link>
            </p>
          )}
          {isStaff && (
            <p>
              Signed in as staff. <Link href={payloadConfig.routes.admin}>Go to admin →</Link>
            </p>
          )}
          {!user && (
            <p>
              <Link href="/signup" className="btn">
                Create an account
              </Link>{' '}
              or browse Articles, Bills and Trademarks above — full content requires a company
              subscription.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
