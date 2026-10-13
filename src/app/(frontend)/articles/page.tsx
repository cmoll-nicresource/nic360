import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { AnnouncementIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { ExcerptFilterBar } from '@/components/ExcerptFilterBar'
import { excerptWhere, parseExcerptFilters } from '@/lib/excerptFilters'
import { searchColumnsForIds, sortByIdOrder } from '@/lib/fullTextSearch'
import type { Article } from '@/payload-types'

export const dynamic = 'force-dynamic'

export default async function ArticlesPage({
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

  const baseWhere = excerptWhere(filters, 'sourceDate')
  let articles: Article[] = []

  if (filters.keyword) {
    const rankedIds = await searchColumnsForIds(payload, 'articles', ['title', 'search_text'], filters.keyword)
    if (rankedIds.length > 0) {
      const { docs } = await payload.find({
        collection: 'articles',
        where: { and: [baseWhere, { id: { in: rankedIds } }].filter((w) => Object.keys(w).length) },
        depth: 1,
        limit: 100,
        overrideAccess: true,
      })
      articles = sortByIdOrder(docs, rankedIds)
    }
  } else {
    const { docs } = await payload.find({
      collection: 'articles',
      where: baseWhere,
      depth: 1,
      sort: '-sourceDate',
      limit: 100,
      overrideAccess: true,
    })
    articles = docs
  }

  return (
    <>
      <SiteNav />
      <div className="page">
        <h1 className="page-heading">
          <AnnouncementIcon />
          News
        </h1>
        <p className="muted">
          News found across the internet, indexed by location, sector, product and subject.
          {!canReadFull && ' Sign in with a Base or Premium subscription to read full excerpts.'}
        </p>

        <ExcerptFilterBar
          basePath="/articles"
          sectors={sectors}
          products={products}
          subjects={subjects}
          locations={locations}
          filters={filters}
        />

        <div className="card">
          {articles.length === 0 && <p className="muted">No articles match these filters.</p>}
          {articles.map((a) => (
            <Link key={a.id} href={`/articles/${a.id}`} className="excerpt-list-item">
              <h3>{a.title}</h3>
              <div className="excerpt-meta">
                {a.source && typeof a.source === 'object' ? a.source.name : null}
                {a.sourceDate ? ` · ${new Date(a.sourceDate).toLocaleDateString()}` : null}
                {a.primarySubject && typeof a.primarySubject === 'object' ? ` · ${a.primarySubject.name}` : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
