import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { AnnouncementIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { ExcerptFilterBar } from '@/components/ExcerptFilterBar'
import { excerptFiltersToQueryString, excerptWhere, parseExcerptFilters } from '@/lib/excerptFilters'
import { formatDate } from '@/lib/formatDate'
import { searchColumnsForIds, sortByIdOrder } from '@/lib/fullTextSearch'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'
import { TagPill } from '@/components/StatusBadge'
import type { Article } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'News',
  description: 'News found across the internet, indexed by location, sector, product and subject.',
}

export default async function ArticlesPage({
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
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canReadFull = isStaff || planSatisfies(plan, 'base')

  const [{ docs: sectors }, { docs: products }, { docs: subjects }, { docs: locations }, { totalDocs: totalArticles }] =
    await Promise.all([
      payload.find({ collection: 'sectors', limit: 100, sort: 'name', overrideAccess: true }),
      payload.find({ collection: 'products', limit: 100, sort: 'name', overrideAccess: true }),
      payload.find({ collection: 'subjects', limit: 200, sort: 'name', overrideAccess: true }),
      payload.find({ collection: 'locations', limit: 200, sort: 'name', overrideAccess: true }),
      payload.count({ collection: 'articles', overrideAccess: true }),
    ])

  const baseWhere = excerptWhere(filters, 'sourceDate')
  let articles: Article[] = []
  let totalDocs = 0
  let totalPages = 1

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
      totalDocs = articles.length
    }
  } else {
    const result = await payload.find({
      collection: 'articles',
      where: baseWhere,
      depth: 1,
      sort: '-sourceDate',
      limit: PAGE_SIZE,
      page,
      overrideAccess: true,
    })
    articles = result.docs
    totalDocs = result.totalDocs
    totalPages = result.totalPages
  }

  const queryString = excerptFiltersToQueryString(filters)

  return (
    <>
      <SiteNav />
      <div className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="header-band-eyebrow">Tracking</p>
            <h1 className="page-heading">
              <span className="icon-badge">
                <AnnouncementIcon />
              </span>
              News
            </h1>
            <p>
              News found across the internet, indexed by location, sector, product and subject.
              {!canReadFull && ' Sign in with a Base or Premium subscription to read full excerpts.'}
            </p>
          </div>
          <span className="header-band-meta">{totalArticles.toLocaleString()} articles · updated today</span>
        </div>
      </div>
      <div className="page">
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
                {a.sourceDate ? <span className="dot">·</span> : null}
                {a.sourceDate ? formatDate(a.sourceDate) : null}
                {a.primarySubject && typeof a.primarySubject === 'object' ? (
                  <>
                    <span className="dot">·</span>
                    <TagPill>{a.primarySubject.name}</TagPill>
                  </>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
        {!filters.keyword && (
          <Pagination
            basePath={`/articles${queryString ? `?${queryString}` : ''}`}
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
