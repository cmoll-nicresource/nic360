import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { AccessPanel, PublicationCover } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { formatDate } from '@/lib/formatDate'
export const dynamic = 'force-dynamic'
export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { payload, user, canRead } = await frontendContext()
  if (!canRead)
    return (
      <>
        <SiteNav />
        <div className="page-wide">
          <h1>Publication library</h1>
          <AccessPanel title="Your publication archive awaits." />
        </div>
      </>
    )
  const { docs } = await payload.find({
    collection: 'publications',
    where: { slug: { equals: slug } },
    limit: 1,
    user,
    overrideAccess: false,
  })
  const publication = docs[0]
  if (!publication) notFound()
  const { docs: issues } = await payload.find({
    collection: 'publication-issues',
    where: {
      and: [{ publication: { equals: publication.id } }, { _status: { equals: 'published' } }],
    },
    sort: '-issueDate',
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const groups = new Map<string, typeof issues>()
  for (const issue of issues) {
    const key = new Date(issue.issueDate).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const group = groups.get(key)
    if (group) group.push(issue)
    else groups.set(key, [issue])
  }
  return (
    <>
      <SiteNav />
      <div className="page-wide">
        <div className="breadcrumbs">
          <Link href="/publications">Publications</Link>
          <span>/</span>
          <span>{publication.title}</span>
        </div>
        <header className="edition-library-header">
          <PublicationCover publication={publication} date={issues[0]?.issueDate} compact />
          <div>
            <p className="edition-eyebrow">{publication.frequency} / PUBLICATION ARCHIVE</p>
            <h1>{publication.title}</h1>
            <p className="edition-deck">{publication.description}</p>
            <div className="edition-actions">
              {issues[0] && (
                <Link href={`/publications/${slug}/issues/${issues[0].id}`} className="btn">
                  Read latest edition ↗
                </Link>
              )}
              <Link href="/account" className="btn btn-secondary">
                Email preferences
              </Link>
            </div>
          </div>
        </header>
        {[...groups].map(([month, entries]) => (
          <section className="edition-archive-month" key={month}>
            <h2>{month}</h2>
            <div>
              {entries.map((issue) => (
                <Link
                  className="edition-archive-row"
                  key={issue.id}
                  href={`/publications/${slug}/issues/${issue.id}`}
                >
                  <span className="edition-archive-day">
                    {new Date(issue.issueDate).getUTCDate().toString().padStart(2, '0')}
                  </span>
                  <div>
                    <p className="edition-meta">
                      {formatDate(issue.issueDate)} ·{' '}
                      {issue.format === 'pdf-report' ? 'PDF report' : 'Briefing'}
                    </p>
                    <h3>{issue.title}</h3>
                  </div>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {!issues.length && (
          <div className="edition-empty">The first published edition will appear here.</div>
        )}
      </div>
    </>
  )
}
