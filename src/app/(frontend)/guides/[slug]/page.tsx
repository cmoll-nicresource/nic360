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

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
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
          <Link href="/guides">Guides</Link>
        </div>
        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view this guide.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <GuideDetail payload={payload} slug={slug} />
        )}
      </div>
    </>
  )
}

async function GuideDetail({ payload, slug }: { payload: Awaited<ReturnType<typeof getPayload>>; slug: string }) {
  const { docs } = await payload.find({
    collection: 'guides',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const guide = docs[0]
  if (!guide) notFound()

  const file = guide.file && typeof guide.file === 'object' ? guide.file : null
  const sizeMb = file?.filesize ? (file.filesize / 1024 / 1024).toFixed(1) : null

  return (
    <div className="guide-detail-grid">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://placehold.co/400x520/e3e8ee/285888?text=${encodeURIComponent(guide.title)}`}
        alt=""
        role="presentation"
        style={{ width: '100%', borderRadius: 8, border: '1px solid var(--nrc-border)' }}
      />
      <div>
        <h1>{guide.title}</h1>
        {guide.description && <p className="muted">{guide.description}</p>}
        <p className="excerpt-meta">
          {formatDate(guide.updatedAt)}
          {sizeMb ? <span className="dot">·</span> : null}
          {sizeMb ? `${sizeMb} MB` : null}
        </p>
        <div className="card">
          {file?.url ? (
            <a href={file.url} target="_blank" rel="noreferrer" className="btn">
              Download PDF{sizeMb ? ` (${sizeMb} MB)` : ''}
            </a>
          ) : (
            <p className="muted">No file attached.</p>
          )}
        </div>
      </div>
    </div>
  )
}
