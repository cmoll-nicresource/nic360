import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { StampIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { TrademarkFilterBar } from '@/components/TrademarkFilterBar'
import { formatDate } from '@/lib/formatDate'
import { searchColumnsForIds, sortByIdOrder } from '@/lib/fullTextSearch'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { trademarkStatusPill } from '@/lib/statusPill'
import { parseTrademarkFilters, trademarkFiltersToQueryString, trademarkWhere } from '@/lib/trademarkFilters'
import type { Trademark } from '@/payload-types'

export const dynamic = 'force-dynamic'

export default async function TrademarksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams
  const filters = parseTrademarkFilters(resolvedSearchParams)
  const page = parsePage(resolvedSearchParams.page)

  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canRead = isStaff || planSatisfies(plan, 'base')
  const { totalDocs: totalTrademarks } = await payload.count({ collection: 'trademarks', overrideAccess: true })

  return (
    <>
      <SiteNav />
      <div className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="header-band-eyebrow">Tracking</p>
            <h1 className="page-heading">
              <span className="icon-badge">
                <StampIcon />
              </span>
              Trademarks
            </h1>
            <p>New tobacco and nicotine trademark filings, renewals and cancellations from the USPTO, updated every week.</p>
          </div>
          <span className="header-band-meta">{totalTrademarks.toLocaleString()} trademarks</span>
        </div>
      </div>
      <div className="page">
        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view trademark filings.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <TrademarkTable payload={payload} filters={filters} page={page} />
        )}
      </div>
    </>
  )
}

async function TrademarkTable({
  payload,
  filters,
  page,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  filters: ReturnType<typeof parseTrademarkFilters>
  page: number
}) {
  const baseWhere = trademarkWhere(filters)
  let trademarks: Trademark[] = []
  let totalDocs = 0
  let totalPages = 1

  if (filters.keyword) {
    const rankedIds = await searchColumnsForIds(payload, 'trademarks', ['title', 'owner', 'goods'], filters.keyword)
    if (rankedIds.length > 0) {
      const { docs } = await payload.find({
        collection: 'trademarks',
        where: { and: [baseWhere, { id: { in: rankedIds } }].filter((w) => Object.keys(w).length) },
        depth: 1,
        limit: 100,
        overrideAccess: true,
      })
      trademarks = sortByIdOrder(docs, rankedIds)
      totalDocs = trademarks.length
    }
  } else {
    const result = await payload.find({
      collection: 'trademarks',
      where: baseWhere,
      depth: 1,
      sort: '-publishedDate',
      limit: PAGE_SIZE,
      page,
      overrideAccess: true,
    })
    trademarks = result.docs
    totalDocs = result.totalDocs
    totalPages = result.totalPages
  }

  const queryString = trademarkFiltersToQueryString(filters)

  return (
    <>
      <TrademarkFilterBar basePath="/trademarks" filters={filters} />
      <div className="card">
        <table className="trademark-table">
          <thead>
            <tr>
              <th></th>
              <th>Brand name</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Class</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {trademarks.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No trademarks match these filters.
                </td>
              </tr>
            )}
            {trademarks.map((t) => {
              const image = t.image && typeof t.image === 'object' ? t.image : null
              return (
                <tr key={t.id}>
                  <td>
                    {image?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                    ) : null}
                  </td>
                  <td>
                    <Link href={`/trademarks/${t.id}`}>{t.title}</Link>
                  </td>
                  <td>{t.owner || '—'}</td>
                  <td>
                    <StatusBadge status={trademarkStatusPill(t)} />
                  </td>
                  <td>{t.class || '—'}</td>
                  <td className="tnum">{t.publishedDate ? formatDate(t.publishedDate) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="trademark-cards">
          {trademarks.length === 0 && <p className="muted">No trademarks match these filters.</p>}
          {trademarks.map((t) => {
            const image = t.image && typeof t.image === 'object' ? t.image : null
            return (
              <Link key={t.id} href={`/trademarks/${t.id}`} className="trademark-card">
                {image?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt="" />
                ) : (
                  <div style={{ width: 48, height: 48, flexShrink: 0 }} />
                )}
                <div className="trademark-card-body">
                  <h3>{t.title}</h3>
                  <div className="excerpt-meta">{t.owner || '—'}</div>
                  <div style={{ marginTop: 4 }}>
                    <StatusBadge status={trademarkStatusPill(t)} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
      {!filters.keyword && (
        <Pagination
          basePath={`/trademarks${queryString ? `?${queryString}` : ''}`}
          page={page}
          totalPages={totalPages}
          totalDocs={totalDocs}
          pageSize={PAGE_SIZE}
        />
      )}
    </>
  )
}
