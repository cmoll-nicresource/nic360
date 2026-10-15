import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { NewsRow } from '@/components/frontend/Editorial'
import { ExcerptFilterBar } from '@/components/ExcerptFilterBar'
import { Pagination } from '@/components/Pagination'
import { frontendContext } from '@/lib/frontendContext'
import {
  excerptFiltersToQueryString,
  excerptWhere,
  parseExcerptFilters,
} from '@/lib/excerptFilters'
import { groupByDate } from '@/lib/editorial'
import { searchColumnsForIds, sortByIdOrder } from '@/lib/fullTextSearch'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import type { Article } from '@/payload-types'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'News',
  description: 'The latest reporting across the nicotine and tobacco industry.',
}
export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filters = parseExcerptFilters(params)
  const page = parsePage(params.page)
  const { payload, user, canRead } = await frontendContext()
  const published = { _status: { equals: 'published' as const } }
  const [sectors, products, subjects, locations, count] = await Promise.all([
    payload.find({ collection: 'sectors', limit: 100, sort: 'name', overrideAccess: false }),
    payload.find({ collection: 'products', limit: 100, sort: 'name', overrideAccess: false }),
    payload.find({ collection: 'subjects', limit: 200, sort: 'name', overrideAccess: false }),
    payload.find({ collection: 'locations', limit: 200, sort: 'name', overrideAccess: false }),
    payload.count({ collection: 'articles', where: published, overrideAccess: false }),
  ])
  const where = { and: [published, excerptWhere(filters, 'sourceDate')] }
  let articles: Article[] = []
  let totalDocs = 0
  let totalPages = 1
  if (filters.keyword) {
    const ids = await searchColumnsForIds(
      payload,
      'articles',
      canRead ? ['title', 'search_text'] : ['title'],
      filters.keyword.slice(0, 160),
    )
    if (ids.length) {
      const result = await payload.find({
        collection: 'articles',
        where: { and: [where, { id: { in: ids } }] },
        depth: 1,
        limit: 500,
        user,
        overrideAccess: false,
      })
      const ordered = sortByIdOrder(result.docs, ids)
      totalDocs = ordered.length
      totalPages = Math.ceil(totalDocs / PAGE_SIZE)
      articles = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    }
  } else {
    const result = await payload.find({
      collection: 'articles',
      where,
      sort: '-sourceDate',
      page,
      limit: PAGE_SIZE,
      depth: 1,
      user,
      overrideAccess: false,
    })
    articles = result.docs
    totalDocs = result.totalDocs
    totalPages = result.totalPages
  }
  const query = excerptFiltersToQueryString(filters)
  return (
    <>
      <SiteNav />
      <header className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="edition-eyebrow">THE NEWS DESK</p>
            <h1>Across the industry.</h1>
            <p>
              Reporting from around the world, organized by the topics, markets and policies that
              matter to your work.
            </p>
          </div>
          <span className="header-band-meta">
            {count.totalDocs.toLocaleString()} articles in the archive
          </span>
        </div>
      </header>
      <div className="page-wide edition-news-layout">
        <aside className="edition-filter-column">
          <p className="edition-eyebrow">REFINE YOUR READING</p>
          <ExcerptFilterBar
            basePath="/articles"
            sectors={sectors.docs}
            products={products.docs}
            subjects={subjects.docs}
            locations={locations.docs}
            filters={filters}
          />
          <div className="edition-sidebar-note">
            <h2>Follow the wider picture.</h2>
            <p>Explore related policy developments and the data behind the headlines.</p>
            <Link href="/bills">Legislation ↗</Link>
            <Link href="/datasets">Market & trade data ↗</Link>
            <Link href="/publications">Publication library ↗</Link>
          </div>
        </aside>
        <section>
          <div className="edition-results-heading">
            <span>
              {filters.keyword ? `Search results for “${filters.keyword}”` : 'Latest reporting'}
            </span>
            <span>
              {totalDocs.toLocaleString()} results
              {filters.keyword && totalDocs === 500 ? ' (first 500 matches)' : ''}
            </span>
          </div>
          {[...groupByDate(articles, (article) => article.sourceDate)].map(([date, docs]) => (
            <section className="edition-news-date" key={date}>
              <h2>{date}</h2>
              {docs.map((article) => (
                <NewsRow key={article.id} article={article} summary={canRead} />
              ))}
            </section>
          ))}
          {!articles.length && (
            <div className="edition-empty">
              <h2>No matching articles.</h2>
              <p>Try a broader keyword or clear a filter.</p>
              <Link href="/articles">Reset your search →</Link>
            </div>
          )}
          <Pagination
            basePath={`/articles${query ? `?${query}` : ''}`}
            page={page}
            totalPages={totalPages}
            totalDocs={totalDocs}
            pageSize={PAGE_SIZE}
          />
          {!canRead && (
            <div className="edition-member-note">
              <strong>Go beyond the headlines.</strong>
              <p>
                Sign in with your company’s subscription to read curated excerpts and briefings.
              </p>
              <Link href="/login">Sign in ↗</Link>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
