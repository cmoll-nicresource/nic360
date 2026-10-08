import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { ExcerptFilterBar } from '@/components/ExcerptFilterBar'
import { excerptWhere, parseExcerptFilters } from '@/lib/excerptFilters'

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

  const [{ docs: articles }, { docs: sectors }, { docs: products }, { docs: subjects }, { docs: locations }] =
    await Promise.all([
      payload.find({
        collection: 'articles',
        where: excerptWhere(filters),
        depth: 1,
        sort: '-sourceDate',
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
      </nav>
      <div className="page">
        <h1>Articles</h1>
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
