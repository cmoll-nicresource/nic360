import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { LawIcon } from '@/components/brandIcons'
import { EditorialPhoto } from '@/components/frontend/EditorialPhoto'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { ExcerptFilterBar } from '@/components/ExcerptFilterBar'
import {
  excerptFiltersToQueryString,
  excerptWhere,
  parseExcerptFilters,
} from '@/lib/excerptFilters'
import { formatDate } from '@/lib/formatDate'
import { searchColumnsForIds, sortByIdOrder } from '@/lib/fullTextSearch'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { billStatusPill } from '@/lib/statusPill'
import type { Bill } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Legislation',
  description: 'Legislation tracked via StateNet, summarized and categorized.',
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams
  const filters = parseExcerptFilters(resolvedSearchParams)
  const page = parsePage(resolvedSearchParams.page)

  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan =
    user && 'collection' in user && user.collection === 'users'
      ? await getReaderPlan(user, payload)
      : 'none'
  const canReadFull = isStaff || planSatisfies(plan, 'base')

  const [
    { docs: sectors },
    { docs: products },
    { docs: subjects },
    { docs: locations },
    { totalDocs: totalBills },
  ] = await Promise.all([
    payload.find({ collection: 'sectors', limit: 100, sort: 'name', overrideAccess: true }),
    payload.find({ collection: 'products', limit: 100, sort: 'name', overrideAccess: true }),
    payload.find({ collection: 'subjects', limit: 200, sort: 'name', overrideAccess: true }),
    payload.find({ collection: 'locations', limit: 200, sort: 'name', overrideAccess: true }),
    payload.count({ collection: 'bills', where: { _status: { equals: 'published' } }, overrideAccess: true }),
  ])

  const baseWhere = excerptWhere(filters, 'billDate')
  let bills: Bill[] = []
  let totalDocs = 0
  let totalPages = 1

  if (filters.keyword) {
    const rankedIds = await searchColumnsForIds(
      payload,
      'bills',
      ['title', 'bill_number', 'search_text'],
      filters.keyword,
    )
    if (rankedIds.length > 0) {
      const { docs } = await payload.find({
        collection: 'bills',
        where: { and: [baseWhere, { id: { in: rankedIds } }].filter((w) => Object.keys(w).length) },
        depth: 1,
        limit: 100,
        user,
        overrideAccess: false,
      })
      bills = sortByIdOrder(docs, rankedIds)
      totalDocs = bills.length
    }
  } else {
    const result = await payload.find({
      collection: 'bills',
      where: baseWhere,
      depth: 1,
      sort: '-billDate',
      limit: PAGE_SIZE,
      page,
      user,
      overrideAccess: false,
    })
    bills = result.docs
    totalDocs = result.totalDocs
    totalPages = result.totalPages
  }

  const queryString = excerptFiltersToQueryString(filters)

  return (
    <>
      <SiteNav />
      <div className="header-band header-band--photographic">
        <div className="header-band-inner">
          <div>
            <p className="header-band-eyebrow">Tracking</p>
            <h1 className="page-heading">
              <span className="icon-badge">
                <LawIcon />
              </span>
              Legislation
            </h1>
            <p>
              Legislation tracked via StateNet, summarized and categorized.
              {!canReadFull &&
                ' Sign in with a Base or Premium subscription to read full abstracts and text.'}
            </p>
          </div>
          <span className="header-band-meta">{totalBills.toLocaleString()} bills tracked</span>
          <EditorialPhoto
            photo="chamber"
            className="editorial-header-photo"
            decorative
            eager
            sizes="(max-width: 700px) 100vw, 360px"
          />
        </div>
      </div>
      <div className="page">
        <ExcerptFilterBar
          basePath="/bills"
          sectors={sectors}
          products={products}
          subjects={subjects}
          locations={locations}
          filters={filters}
        />

        <div className="card">
          {bills.length === 0 && <p className="muted">No bills match these filters.</p>}
          {bills.map((b) => {
            const jurisdiction = b.locations?.find((l) => typeof l === 'object')
            const jurisdictionName =
              jurisdiction && typeof jurisdiction === 'object'
                ? jurisdiction.name
                : b.governmentLevel
            return (
              <Link key={b.id} href={`/bills/${b.id}`} className="excerpt-list-item">
                <div
                  className="excerpt-meta"
                  style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span className="tag-pill tnum">{b.billNumber}</span>
                  <StatusBadge status={billStatusPill(b)} />
                </div>
                <h3>{b.title}</h3>
                <div className="excerpt-meta">
                  {jurisdictionName}
                  {b.billDate ? <span className="dot">·</span> : null}
                  {b.billDate ? formatDate(b.billDate) : null}
                </div>
              </Link>
            )
          })}
        </div>
        {!filters.keyword && (
          <Pagination
            basePath={`/bills${queryString ? `?${queryString}` : ''}`}
            page={page}
            totalPages={totalPages}
            totalDocs={totalDocs}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>
    </>
  )
}
