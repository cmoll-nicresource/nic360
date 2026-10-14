import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'
import { formatDate } from '@/lib/formatDate'

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
      <SiteNav />
      <div className="page">
        <div className="breadcrumbs">
          <Link href="/publications">Publications</Link>
        </div>
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

  const groups = new Map<string, typeof issues>()
  for (const issue of issues) {
    const key = new Date(issue.issueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const group = groups.get(key)
    if (group) group.push(issue)
    else groups.set(key, [issue])
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>{publication.title}</h1>
        {publication.frequency && <span className="tag-pill">{publication.frequency}</span>}
      </div>
      {publication.description && <p className="muted">{publication.description}</p>}

      {issues.length === 0 && <p className="muted">No issues yet.</p>}
      {[...groups.entries()].map(([month, monthIssues]) => (
        <div key={month} style={{ marginBottom: 24 }}>
          <h2>{month}</h2>
          <div className="card">
            {monthIssues.map((issue) => (
              <Link key={issue.id} href={`/publications/${slug}/issues/${issue.id}`} className="excerpt-list-item">
                <h3>
                  {new Date(issue.issueDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </h3>
                {isStaff && <div className="excerpt-meta">{issue.email?.status ?? 'not sent'}</div>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
