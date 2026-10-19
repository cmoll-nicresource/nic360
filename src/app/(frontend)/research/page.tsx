import Link from 'next/link'
import type { Where } from 'payload'
import { SiteNav } from '@/components/SiteNav'
import { ResearchRow } from '@/components/frontend/ResearchRow'
import { Pagination } from '@/components/Pagination'
import { frontendContext } from '@/lib/frontendContext'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import { searchColumnsForIds } from '@/lib/fullTextSearch'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Industry Research',
  description:
    'Research and journal articles for the nicotine and tobacco industry.',
}
export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const one = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : ''
  const keyword = one('keyword').trim().slice(0, 160),
    journal = one('journal'),
    dateFrom = one('dateFrom'),
    dateTo = one('dateTo')
  const { payload, user, canRead } = await frontendContext()
  const and: Where[] = [{ _status: { equals: 'published' } }]
  if (/^\d+$/.test(journal)) and.push({ journal: { equals: Number(journal) } })
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) &&
    Number.isFinite(Date.parse(dateFrom))
  )
    and.push({ publishedDate: { greater_than_equal: dateFrom + 'T00:00:00Z' } })
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo) && Number.isFinite(Date.parse(dateTo)))
    and.push({
      publishedDate: {
        less_than: new Date(Date.parse(dateTo) + 86400000).toISOString(),
      },
    })
  if (keyword) {
    const ids = await searchColumnsForIds(
      payload,
      'research',
      canRead ? ['title', 'authors', 'search_text'] : ['title', 'authors'],
      keyword,
    )
    and.push({ id: { in: ids } })
  }
  const page = parsePage(params.page)
  const [result, journals] = await Promise.all([
    payload.find({
      collection: 'research',
      where: { and },
      sort: '-publishedDate',
      limit: PAGE_SIZE,
      page,
      depth: 1,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'journals',
      sort: 'name',
      limit: 0,
      pagination: false,
      overrideAccess: false,
    }),
  ])
  const query = new URLSearchParams({
    ...(keyword && { keyword }),
    ...(journal && { journal }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  })
  return (
    <>
      <SiteNav />
      <header className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="edition-eyebrow">THE RESEARCH DESK</p>
            <h1>Industry Research</h1>
            <p>
              Journal articles, research findings and abstracts from across the
              industry.
            </p>
          </div>
          <Link
            href="/publications/monthly-research-digest"
            className="edition-text-link"
          >
            Monthly Research Digest ↗
          </Link>
        </div>
      </header>
      <div className="page-wide edition-news-layout">
        <aside className="edition-filter-panel">
          <form action="/research" method="get">
            <h2>Find research</h2>
            <div className="field">
              <label htmlFor="research-keyword">Search</label>
              <input
                id="research-keyword"
                name="keyword"
                defaultValue={keyword}
                placeholder={
                  canRead ? 'Title, author or body' : 'Title or author'
                }
              />
            </div>
            <div className="field">
              <label htmlFor="research-journal">Journal</label>
              <select
                id="research-journal"
                name="journal"
                defaultValue={journal}
              >
                <option value="">All journals</option>
                {journals.docs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="research-from">Published from</label>
              <input
                id="research-from"
                type="date"
                name="dateFrom"
                defaultValue={dateFrom}
              />
            </div>
            <div className="field">
              <label htmlFor="research-to">Published through</label>
              <input
                id="research-to"
                type="date"
                name="dateTo"
                defaultValue={dateTo}
              />
            </div>
            <button className="btn" type="submit">
              Apply filters
            </button>{' '}
            <Link href="/research">Reset</Link>
          </form>
        </aside>
        <section aria-label="Research articles">
          <p className="edition-meta">
            {result.totalDocs.toLocaleString()} research articles
          </p>
          {result.docs.length ? (
            result.docs.map((article) => (
              <ResearchRow key={article.id} article={article} />
            ))
          ) : (
            <div className="edition-empty">
              <h2>No matching research</h2>
              <p>Try another journal, date range or search term.</p>
            </div>
          )}
          <Pagination
            basePath={`/research?${query}`}
            page={page}
            totalPages={result.totalPages}
            totalDocs={result.totalDocs}
            pageSize={PAGE_SIZE}
          />
        </section>
      </div>
    </>
  )
}
