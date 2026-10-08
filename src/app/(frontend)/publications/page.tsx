import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

export const dynamic = 'force-dynamic'

export default async function PublicationsPage() {
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
      </nav>
      <div className="page">
        <h1>Publications</h1>
        <p className="muted">Newsletters, readable by any Base or Premium subscriber.</p>

        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view publications.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <PublicationList payload={payload} />
        )}
      </div>
    </>
  )
}

async function PublicationList({ payload }: { payload: Awaited<ReturnType<typeof getPayload>> }) {
  const { docs: publications } = await payload.find({
    collection: 'publications',
    limit: 100,
    sort: 'title',
    overrideAccess: true,
  })

  return (
    <div className="card">
      {publications.map((p) => (
        <Link key={p.id} href={`/publications/${p.slug}`} className="excerpt-list-item">
          <h3>{p.title}</h3>
          <div className="excerpt-meta">
            {p.description} · {p.frequency}
          </div>
        </Link>
      ))}
      {publications.length === 0 && <p className="muted">No publications yet.</p>}
    </div>
  )
}
