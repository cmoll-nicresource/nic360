import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { StampIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { TrademarkFilterBar } from '@/components/TrademarkFilterBar'
import { searchColumnsForIds, sortByIdOrder } from '@/lib/fullTextSearch'
import { parseTrademarkFilters, trademarkWhere } from '@/lib/trademarkFilters'
import type { Trademark } from '@/payload-types'

export const dynamic = 'force-dynamic'

export default async function TrademarksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams
  const filters = parseTrademarkFilters(resolvedSearchParams)

  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canRead = isStaff || planSatisfies(plan, 'base')

  return (
    <>
      <SiteNav />
      <div className="page">
        <h1 className="page-heading">
          <StampIcon />
          Trademarks
        </h1>
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
          <TrademarkTable payload={payload} filters={filters} />
        )}
      </div>
    </>
  )
}

async function TrademarkTable({
  payload,
  filters,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  filters: ReturnType<typeof parseTrademarkFilters>
}) {
  const baseWhere = trademarkWhere(filters)
  let trademarks: Trademark[] = []

  if (filters.keyword) {
    const rankedIds = await searchColumnsForIds(payload, 'trademarks', ['title', 'owner', 'goods'], filters.keyword)
    if (rankedIds.length > 0) {
      const { docs } = await payload.find({
        collection: 'trademarks',
        where: { and: [baseWhere, { id: { in: rankedIds } }].filter((w) => Object.keys(w).length) },
        depth: 0,
        limit: 100,
        overrideAccess: true,
      })
      trademarks = sortByIdOrder(docs, rankedIds)
    }
  } else {
    const { docs } = await payload.find({
      collection: 'trademarks',
      where: baseWhere,
      depth: 0,
      sort: '-publishedDate',
      limit: 100,
      overrideAccess: true,
    })
    trademarks = docs
  }

  return (
    <>
      <TrademarkFilterBar basePath="/trademarks" filters={filters} />
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
            {trademarks.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No trademarks match these filters.
                </td>
              </tr>
            )}
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
    </>
  )
}
