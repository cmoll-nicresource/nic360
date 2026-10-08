import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'

export const dynamic = 'force-dynamic'

export default async function TrademarksPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canRead = isStaff || planSatisfies(plan, 'base')

  return (
    <>
      <nav className="topnav">
        <Link href="/">Nicotine360</Link>
        <Link href="/articles">Articles</Link>
        <Link href="/bills">Bills</Link>
        <Link href="/trademarks">Trademarks</Link>
        <Link href="/datasets">Data</Link>
        <Link href="/guides">Guides</Link>
        <Link href="/publications">Publications</Link>
      </nav>
      <div className="page">
        <h1>Trademarks</h1>
        <p className="muted">
          Scraped weekly from the USPTO XML feed: filings, renewals, cancellations. No public
          preview — the whole listing requires a Base or Premium subscription.
        </p>

        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view trademark filings.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <TrademarkTable payload={payload} />
        )}
      </div>
    </>
  )
}

async function TrademarkTable({ payload }: { payload: Awaited<ReturnType<typeof getPayload>> }) {
  const { docs: trademarks } = await payload.find({
    collection: 'trademarks',
    depth: 0,
    sort: '-publishedDate',
    limit: 100,
    overrideAccess: true,
  })

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Brand name</th>
            <th>Owner</th>
            <th>Class</th>
            <th>Published</th>
          </tr>
        </thead>
        <tbody>
          {trademarks.map((t) => (
            <tr key={t.id}>
              <td>
                <Link href={`/trademarks/${t.id}`}>{t.title}</Link>
              </td>
              <td>{t.owner || '—'}</td>
              <td>{t.class || '—'}</td>
              <td>{t.publishedDate ? new Date(t.publishedDate).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
