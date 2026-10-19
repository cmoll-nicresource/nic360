import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { SiteNav } from '@/components/SiteNav'
import { AccessPanel } from '@/components/frontend/Editorial'
import { ResearchRow } from '@/components/frontend/ResearchRow'
import { frontendContext } from '@/lib/frontendContext'
import { formatDate } from '@/lib/formatDate'
export const dynamic = 'force-dynamic'
export default async function ResearchDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { payload, user, canRead } = await frontendContext()
  const { docs } = await payload.find({
    collection: 'research',
    where: {
      and: [{ id: { equals: id } }, { _status: { equals: 'published' } }],
    },
    limit: 1,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const article = docs[0]
  if (!article) notFound()
  const journal = typeof article.journal === 'object' ? article.journal : null
  const related = await payload.find({
    collection: 'research',
    where: {
      and: [
        { _status: { equals: 'published' } },
        { id: { not_equals: article.id } },
        { journal: { equals: journal?.id ?? article.journal } },
      ],
    },
    sort: '-publishedDate',
    limit: 3,
    depth: 1,
    user,
    overrideAccess: false,
  })
  return (
    <>
      <SiteNav />
      <div className="page-wide">
        <div className="breadcrumbs">
          <Link href="/research">Industry Research</Link>
          <span>/</span>
          <span>{journal?.name || 'Journal article'}</span>
        </div>
        <header className="edition-article-header">
          <p className="edition-eyebrow">THE RESEARCH DESK / {journal?.name}</p>
          <h1>{article.title}</h1>
          {article.authors && <p>{article.authors}</p>}
          <p className="edition-meta">
            {journal?.name}
            {article.publishedDate
              ? ` · ${formatDate(article.publishedDate)}`
              : ''}
          </p>
        </header>
        <div className="edition-content-grid">
          <article className="edition-article-body">
            {canRead && article.body ? (
              <>
                <RichText data={article.body} />
                {article.doiLink && (
                  <p>
                    <a
                      href={article.doiLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="edition-text-link"
                    >
                      Read the original journal article (DOI) ↗
                    </a>
                  </p>
                )}
              </>
            ) : (
              <AccessPanel
                title="Read the research."
                description="Sign in with an active Base or Premium subscription to read the body and access the DOI link."
              />
            )}
          </article>
          <aside>
            <h2>More from this journal</h2>
            {related.docs.map((item) => (
              <ResearchRow key={item.id} article={item} />
            ))}
            <Link href={`/research?journal=${journal?.id ?? article.journal}`}>
              Browse this journal ↗
            </Link>
          </aside>
        </div>
      </div>
    </>
  )
}
