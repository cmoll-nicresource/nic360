import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { SiteNav } from '@/components/SiteNav'
import { AccessPanel, NewsRow, SectionHeading } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { hasDistinctExcerpt, sourceLabel } from '@/lib/editorial'
import { formatDate } from '@/lib/formatDate'
import { sentenceCase } from '@/lib/textCase'
export const dynamic = 'force-dynamic'
export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user, canRead } = await frontendContext()
  const { docs } = await payload.find({
    collection: 'articles',
    where: { and: [{ id: { equals: id } }, { _status: { equals: 'published' } }] },
    limit: 1,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const article = docs[0]
  if (!article) notFound()
  const primarySubject = typeof article.primarySubject === 'object' ? article.primarySubject : null
  const related = primarySubject
    ? await payload.find({
        collection: 'articles',
        where: {
          and: [
            { _status: { equals: 'published' } },
            { id: { not_equals: article.id } },
            { primarySubject: { equals: primarySubject.id } },
          ],
        },
        sort: '-sourceDate',
        limit: 3,
        depth: 1,
        user,
        overrideAccess: false,
      })
    : null
  const groups = [
    {
      label: 'Subjects',
      key: 'subject',
      terms: [...(primarySubject ? [primarySubject] : []), ...(article.subjects || [])],
    },
    { label: 'Markets & locations', key: 'location', terms: article.locations || [] },
    { label: 'Sectors', key: 'sector', terms: article.sectors || [] },
    { label: 'Products', key: 'product', terms: article.products || [] },
  ]
  const source = sourceLabel(typeof article.source === 'object' ? article.source?.name : null)
  return (
    <>
      <SiteNav />
      <div className="page-wide">
        <div className="breadcrumbs">
          <Link href="/articles">News</Link>
          <span>/</span>
          <span>{primarySubject ? sentenceCase(primarySubject.name) : 'Industry reporting'}</span>
        </div>
        <header className="edition-article-header">
          <p className="edition-eyebrow">THE NEWS DESK / {source}</p>
          <h1>{article.title}</h1>
          <p className="edition-meta">
            {source}
            {article.sourceDate ? ` · ${formatDate(article.sourceDate)}` : ''}
          </p>
        </header>
        <div className="edition-content-grid">
          <article>
            <div className="edition-article-body">
              {canRead && article.excerpt ? (
                <>
                  {hasDistinctExcerpt(article.excerpt, article.title) ? (
                    <RichText data={article.excerpt} />
                  ) : (
                    <p>Read the original reporting from {source}.</p>
                  )}
                  {article.sourceUrl && (
                    <a
                      href={article.sourceUrl}
                      className="btn btn-secondary"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read the original at {source} ↗
                    </a>
                  )}
                </>
              ) : (
                <AccessPanel
                  title="Go beyond the headline."
                  description="Read the curated excerpt with a Base or Premium subscription."
                />
              )}
            </div>
            {!!related?.docs.length && (
              <section className="edition-section">
                <SectionHeading eyebrow="KEEP READING" title="The wider picture" />
                {related.docs.map((a) => (
                  <NewsRow key={a.id} article={a} />
                ))}
              </section>
            )}
          </article>
          <aside>
            <p className="edition-eyebrow">EXPLORE THIS STORY</p>
            {groups.map((group) => {
              const ids = new Set<number>()
              const terms = group.terms.filter((term) => {
                if (typeof term !== 'object' || ids.has(term.id)) return false
                ids.add(term.id)
                return true
              })
              if (!terms.length) return null
              return (
                <div className="edition-topic-group" key={group.key}>
                  <h3>{group.label}</h3>
                  <div>
                    {terms.map(
                      (term) =>
                        typeof term === 'object' && (
                          <Link
                            href={`/articles?${group.key}=${term.id}`}
                            className="tag-pill"
                            key={term.id}
                          >
                            {sentenceCase(term.name)}
                          </Link>
                        ),
                    )}
                  </div>
                </div>
              )
            })}
            <div className="edition-sidebar-note">
              <h2>Need the policy context?</h2>
              <p>Track related bills and regulatory developments.</p>
              <Link href="/bills">Explore legislation ↗</Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
