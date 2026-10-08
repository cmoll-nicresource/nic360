import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'

export const dynamic = 'force-dynamic'

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canReadFull = isStaff || planSatisfies(plan, 'base')

  const article = await payload
    .findByID({ collection: 'articles', id, depth: 1, overrideAccess: true })
    .catch(() => null)
  if (!article) notFound()

  return (
    <>
      <nav className="topnav">
        <Link href="/">Nicotine360</Link>
        <Link href="/articles">Articles</Link>
        <Link href="/bills">Bills</Link>
        <Link href="/trademarks">Trademarks</Link>
      </nav>
      <div className="page">
        <p>
          <Link href="/articles">&larr; All articles</Link>
        </p>
        <h1>{article.title}</h1>
        <p className="excerpt-meta">
          {article.source && typeof article.source === 'object' ? article.source.name : null}
          {article.sourceDate ? ` · ${new Date(article.sourceDate).toLocaleDateString()}` : null}
          {article.sourceUrl ? (
            <>
              {' · '}
              <a href={article.sourceUrl} target="_blank" rel="noreferrer">
                Original source
              </a>
            </>
          ) : null}
        </p>

        <div className="card">
          {canReadFull ? (
            <RichText data={article.excerpt} />
          ) : (
            <div className="locked-content">
              Full excerpt requires a Base or Premium subscription.{' '}
              <Link href="/account">Sign in</Link> with your company&apos;s access, or contact your
              administrator.
            </div>
          )}
        </div>

        <div className="card">
          <h3>Index terms</h3>
          <p className="excerpt-meta">
            <strong>Primary subject:</strong>{' '}
            {article.primarySubject && typeof article.primarySubject === 'object'
              ? article.primarySubject.name
              : '—'}
          </p>
          <p className="excerpt-meta">
            <strong>Subjects:</strong>{' '}
            {article.subjects
              ?.map((s) => (typeof s === 'object' ? s.name : s))
              .join(', ') || '—'}
          </p>
          <p className="excerpt-meta">
            <strong>Sectors:</strong>{' '}
            {article.sectors?.map((s) => (typeof s === 'object' ? s.name : s)).join(', ') || '—'}
          </p>
          <p className="excerpt-meta">
            <strong>Products:</strong>{' '}
            {article.products?.map((p) => (typeof p === 'object' ? p.name : p)).join(', ') || '—'}
          </p>
          <p className="excerpt-meta">
            <strong>Locations:</strong>{' '}
            {article.locations?.map((l) => (typeof l === 'object' ? l.name : l)).join(', ') || '—'}
          </p>
        </div>
      </div>
    </>
  )
}
