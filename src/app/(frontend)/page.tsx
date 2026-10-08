import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  return (
    <>
      <nav className="topnav">
        <Link href="/">Nicotine360</Link>
        <Link href="/articles">Articles</Link>
        <Link href="/bills">Bills</Link>
        <Link href="/trademarks">Trademarks</Link>
        <Link href="/account">Account</Link>
        <Link href="/access-check">Access check</Link>
        <Link href={payloadConfig.routes.admin}>Admin</Link>
      </nav>
      <div className="page">
        <h1>Nicotine360</h1>
        <p className="muted">Skeleton prototype — Milestone 2: excerpts (articles, bills, trademarks).</p>
        <div className="card">
          {user ? (
            <p>
              Signed in as <strong>{'email' in user ? user.email : ''}</strong> (
              {'collection' in user ? user.collection : 'unknown'})
            </p>
          ) : (
            <p>Not signed in.</p>
          )}
        </div>
      </div>
    </>
  )
}
