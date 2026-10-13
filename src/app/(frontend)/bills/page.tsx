import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { LawIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { ExcerptFilterBar } from '@/components/ExcerptFilterBar'
import { excerptWhere, parseExcerptFilters } from '@/lib/excerptFilters'
import { searchColumnsForIds, sortByIdOrder } from '@/lib/fullTextSearch'
import type { Bill } from '@/payload-types'

export const dynamic = 'force-dynamic'

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams
  const filters = parseExcerptFilters(resolvedSearchParams)

  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canReadFull = isStaff || planSatisfies(plan, 'base')

  const [{ docs: sectors }, { docs: products }, { docs: subjects }, { docs: locations }] = await Promise.all([
    payload.find({ collection: 'sectors', limit: 100, sort: 'name', overrideAccess: true }),
    payload.find({ collection: 'products', limit: 100, sort: 'name', overrideAccess: true }),
    payload.find({ collection: 'subjects', limit: 200, sort: 'name', overrideAccess: true }),
    payload.find({ collection: 'locations', limit: 200, sort: 'name', overrideAccess: true }),
  ])

  const baseWhere = excerptWhere(filters, 'billDate')
  let bills: Bill[] = []

  if (filters.keyword) {
    const rankedIds = await searchColumnsForIds(payload, 'bills', ['title', 'bill_number', 'search_text'], filters.keyword)
    if (rankedIds.length > 0) {
      const { docs } = await payload.find({
        collection: 'bills',
        where: { and: [baseWhere, { id: { in: rankedIds } }].filter((w) => Object.keys(w).length) },
        depth: 1,
        limit: 100,
        overrideAccess: true,
      })
      bills = sortByIdOrder(docs, rankedIds)
    }
  } else {
    const { docs } = await payload.find({
      collection: 'bills',
      where: baseWhere,
      depth: 1,
      sort: '-billDate',
      limit: 100,
      overrideAccess: true,
    })
    bills = docs
  }

  return (
    <>
      <SiteNav />
      <div className="page">
        <h1 className="page-heading">
          <LawIcon />
          Legislation
        </h1>
        <p className="muted">
          Legislation tracked via StateNet, summarized and categorized.
          {!canReadFull && ' Sign in with a Base or Premium subscription to read full abstracts and text.'}
        </p>

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
          {bills.map((b) => (
            <Link key={b.id} href={`/bills/${b.id}`} className="excerpt-list-item">
              <h3>
                {b.billNumber} — {b.title}
              </h3>
              <div className="excerpt-meta">
                {b.governmentLevel}
                {b.billDate ? ` · ${new Date(b.billDate).toLocaleDateString()}` : null}
                {b.statusText ? ` · ${b.statusText}` : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
