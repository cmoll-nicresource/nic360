import { currentEditions } from '@/lib/currentEditions'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { AccessPanel, PublicationCover, SectionHeading } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { formatDate } from '@/lib/formatDate'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Publications',
  description: 'Your library of industry briefings and reports.',
}
export default async function PublicationsPage() {
  const { canRead } = await frontendContext()
  const { publications, issues } = await currentEditions()
  return (
    <>
      <SiteNav />
      <header className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="edition-eyebrow">DAILY · WEEKLY · MONTHLY</p>
            <h1>Publications</h1>
            <p>
              Daily briefings, specialist reporting and monthly analysis. Read the latest edition or
              explore the archive.
            </p>
          </div>
          {canRead && (
            <Link href="/account" className="edition-text-link">
              Manage email preferences ↗
            </Link>
          )}
        </div>
      </header>
      <div className="page-wide">
        {!canRead ? (
          <AccessPanel
            title="Your industry. In perspective."
            description="Sign in with a Base or Premium subscription to read the publication library."
          />
        ) : (
          <>
            {['news', 'legislation', 'trademarks', 'research'].map((category) => {
              const docs = publications.filter((p) =>
                p.category?.includes(category as 'news' | 'legislation' | 'trademarks' | 'research'),
              )
              if (!docs.length) return null
              return (
                <section key={category} id={category} className="edition-section">
                  <SectionHeading
                    eyebrow="PUBLICATIONS"
                    title={
                      category === 'news'
                        ? 'News & analysis'
                        : category === 'legislation'
                          ? 'Policy & legislation'
                          : category === 'research' ? 'Industry Research' : 'Trademark intelligence'
                    }
                  />
                  <div className="edition-publication-grid">
                    {docs.map((publication) => {
                      const latest = issues.find(
                        (issue) =>
                          (typeof issue.publication === 'object'
                            ? issue.publication.id
                            : issue.publication) === publication.id,
                      )
                      return (
                        <Link
                          href={`/publications/${publication.slug}`}
                          key={publication.id}
                          className="edition-publication-card"
                        >
                          <PublicationCover publication={publication} date={latest?.issueDate} />
                          <div>
                            <span className="tag-pill">{publication.frequency}</span>
                            <h3>{publication.title}</h3>
                            <p className="muted">{publication.description}</p>
                            <p className="edition-meta">
                              {latest
                                ? `Latest edition · ${formatDate(latest.issueDate)}`
                                : 'Browse the archive'}
                            </p>
                            <span className="edition-text-link">Explore editions ↗</span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )
            })}
            {!publications.length && <p className="muted">Published briefings will appear here.</p>}
          </>
        )}
      </div>
    </>
  )
}
