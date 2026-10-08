import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { ExcerptFilterBar } from '@/components/ExcerptFilterBar'
import { excerptWhere, parseExcerptFilters } from '@/lib/excerptFilters'

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

  const [{ docs: bills }, { docs: sectors }, { docs: products }, { docs: subjects }, { docs: locations }] =
    await Promise.all([
      payload.find({
        collection: 'bills',
        where: excerptWhere(filters),
        depth: 1,
        sort: '-billDate',
        limit: 100,
        overrideAccess: true,
      }),
      payload.find({ collection: 'sectors', limit: 100, sort: 'name', overrideAccess: true }),
      payload.find({ collection: 'products', limit: 100, sort: 'name', overrideAccess: true }),
      payload.find({ collection: 'subjects', limit: 200, sort: 'name', overrideAccess: true }),
      payload.find({ collection: 'locations', limit: 200, sort: 'name', overrideAccess: true }),
    ])

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
        <Link href="/events">Events</Link>
      </nav>
      <div className="page">
        <h1>Bills</h1>
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
