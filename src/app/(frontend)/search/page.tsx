import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { frontendContext } from '@/lib/frontendContext'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Search' }
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 160) : ''
  const { payload, user, canRead, plan, isStaff } = await frontendContext()
  const title = { title: { like: query } }
  const published = { _status: { equals: 'published' as const } }
  const options = { limit: 8, depth: 0, user, overrideAccess: false as const }
  const results: {
    label: string
    href: string
    items: { title: string; href: string; detail?: string | null }[]
    total: number
  }[] = []
  if (query.length >= 2) {
    const [news, bills, datasets, guides, publications, research] = await Promise.all([
      payload.find({ collection: 'articles', where: { and: [title, published] }, ...options }),
      payload.find({ collection: 'bills', where: { and: [title, published] }, ...options }),
      payload.find({ collection: 'datasets', where: title, ...options }),
      canRead
        ? payload.find({
            collection: 'guides',
            where: {
              and: [
                title,
                published,
                ...(!isStaff && plan !== 'premium' ? [{ requiresPremium: { equals: false } }] : []),
              ],
            },
            ...options,
          })
        : null,
      canRead ? payload.find({ collection: 'publications', where: title, ...options }) : null,
      payload.find({ collection: 'research', where: { and: [title, published] }, ...options }),
    ])
    results.push(
      { label: 'Industry Research', href: `/research?keyword=${encodeURIComponent(query)}`, total: research.totalDocs, items: research.docs.map(d => ({ title: d.title, href: `/research/${d.id}` })) },
      {
        label: 'News',
        href: `/articles?keyword=${encodeURIComponent(query)}`,
        total: news.totalDocs,
        items: news.docs.map((d) => ({ title: d.title, href: `/articles/${d.id}` })),
      },
      {
        label: 'Legislation',
        href: `/bills?keyword=${encodeURIComponent(query)}`,
        total: bills.totalDocs,
        items: bills.docs.map((d) => ({
          title: d.title,
          href: `/bills/${d.id}`,
          detail: d.billNumber,
        })),
      },
      {
        label: 'Data',
        href: '/datasets',
        total: datasets.totalDocs,
        items: datasets.docs.map((d) => ({
          title: d.title,
          href: `/datasets/${d.slug}`,
          detail: d.description,
        })),
      },
    )
    if (guides)
      results.push({
        label: 'Guides',
        href: '/guides',
        total: guides.totalDocs,
        items: guides.docs.map((d) => ({
          title: d.title,
          href: `/guides/${d.slug}`,
          detail: d.description,
        })),
      })
    if (publications)
      results.push({
        label: 'Publications',
        href: '/publications',
        total: publications.totalDocs,
        items: publications.docs.map((d) => ({
          title: d.title,
          href: `/publications/${d.slug}`,
          detail: d.frequency,
        })),
      })
  }
  const total = results.reduce((sum, group) => sum + group.total, 0)
  return (
    <>
      <SiteNav />
      <div className="page-wide edition-search-page">
        <p className="edition-eyebrow">FIND YOUR NEXT INSIGHT</p>
        <h1>Search Nicotine360</h1>
        <form action="/search" className="edition-search-form">
          <label htmlFor="site-query">
            Search titles across news, legislation, data, guides and publications
          </label>
          <div>
            <input
              id="site-query"
              type="search"
              name="q"
              defaultValue={query}
              minLength={2}
              maxLength={160}
              placeholder="Try taxation, vaping, or trade…"
              required
            />
            <button className="btn" type="submit">
              Search
            </button>
          </div>
        </form>
        {query.length >= 2 && (
          <p className="edition-meta" role="status">
            {total.toLocaleString()} results for “{query}”
            {!canRead && ' · Sign in to include your subscription library.'}
          </p>
        )}
        {query.length === 1 && <p>Enter at least two characters.</p>}
        {results
          .filter((g) => g.items.length)
          .map((group) => (
            <section className="edition-search-group" key={group.label}>
              <div className="edition-section-heading">
                <h2>
                  {group.label} <span className="edition-meta">({group.total})</span>
                </h2>
                <Link href={group.href}>
                  {group.label === 'News' || group.label === 'Legislation'
                    ? 'Search this section'
                    : 'Browse section'}{' '}
                  ↗
                </Link>
              </div>
              {group.items.map((item) => (
                <Link className="edition-search-result" href={item.href} key={item.href}>
                  <h3>{item.title}</h3>
                  {item.detail && <p className="muted">{item.detail}</p>}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </section>
          ))}
        {query.length >= 2 && !total && (
          <div className="edition-empty">
            <h2>No matching titles.</h2>
            <p>
              Try a broader term, or use the news and legislation filters to explore by topic or
              location.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
