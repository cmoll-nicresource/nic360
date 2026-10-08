import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

export const dynamic = 'force-dynamic'

export default async function PublicationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = staffHasRole(user, 'editor')
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canRead = isStaff || planSatisfies(plan, 'base')

  return (
    <>
      <nav className="topnav">
        <Link href="/">Nicotine360</Link>
        <Link href="/articles">Articles</Link>
        <Link href="/datasets">Data</Link>
        <Link href="/guides">Guides</Link>
        <Link href="/publications">Publications</Link>
        <Link href="/events">Events</Link>
      </nav>
      <div className="page">
        <p>
          <Link href="/publications">&larr; All publications</Link>
        </p>
        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view this publication.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <PublicationDetail payload={payload} slug={slug} isStaff={isStaff} />
        )}
      </div>
    </>
  )
}

async function PublicationDetail({
  payload,
  slug,
  isStaff,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  slug: string
  isStaff: boolean
}) {
  const { docs } = await payload.find({
    collection: 'publications',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })
  const publication = docs[0]
  if (!publication) notFound()

  const { docs: issues } = await payload.find({
    collection: 'publication-issues',
    where: isStaff
      ? { publication: { equals: publication.id } }
      : { and: [{ publication: { equals: publication.id } }, { _status: { equals: 'published' } }] },
    sort: '-issueDate',
    limit: 100,
    overrideAccess: true,
  })

  return (
    <>
      <h1>{publication.title}</h1>
      {publication.description && <p className="muted">{publication.description}</p>}

      <div className="card">
        {issues.map((issue) => (
          <Link key={issue.id} href={`/publications/${slug}/issues/${issue.id}`} className="excerpt-list-item">
            <h3>{issue.title}</h3>
            <div className="excerpt-meta">
              {new Date(issue.issueDate).toLocaleDateString()} · {issue.email?.status ?? 'not sent'}
            </div>
          </Link>
        ))}
        {issues.length === 0 && <p className="muted">No issues yet.</p>}
      </div>
    </>
  )
}
