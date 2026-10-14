import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { DocumentationIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'
import { formatDate } from '@/lib/formatDate'

export const dynamic = 'force-dynamic'

export default async function GuidesPage() {
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
      <div className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="header-band-eyebrow">Content</p>
            <h1 className="page-heading">
              <span className="icon-badge">
                <DocumentationIcon />
              </span>
              Guides
            </h1>
            <p>In-depth reference guides to tax, trade and regulation.</p>
          </div>
        </div>
      </div>
      <div className="page">
        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view guides.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <GuideList payload={payload} />
        )}
      </div>
    </>
  )
}

async function GuideList({ payload }: { payload: Awaited<ReturnType<typeof getPayload>> }) {
  const { docs: guides } = await payload.find({
    collection: 'guides',
    limit: 100,
    sort: '-createdAt',
    depth: 1,
    overrideAccess: true,
  })

  if (guides.length === 0) return <p className="muted">No guides yet.</p>

  return (
    <div className="guide-grid">
      {guides.map((g) => {
        const file = g.file && typeof g.file === 'object' ? g.file : null
        return (
          <Link key={g.id} href={`/guides/${g.slug}`} className="guide-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://placehold.co/480x620/e3e8ee/285888?text=${encodeURIComponent(g.title)}`}
              alt=""
              role="presentation"
              className="guide-card-cover"
            />
            <div className="guide-card-body">
              <h3>{g.title}</h3>
              {g.description && <p className="muted">{g.description}</p>}
              <p className="excerpt-meta">
                {formatDate(g.updatedAt)}
                {file?.filesize ? ` · ${(file.filesize / 1024 / 1024).toFixed(1)} MB` : ''}
              </p>
              <span className="btn btn-secondary" style={{ marginTop: 8 }}>
                Download PDF
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
