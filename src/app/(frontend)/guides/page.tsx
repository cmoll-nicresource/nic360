import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

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
      <nav className="topnav">
        <Link href="/">Nicotine360</Link>
        <Link href="/articles">Articles</Link>
        <Link href="/datasets">Data</Link>
        <Link href="/guides">Guides</Link>
        <Link href="/publications">Publications</Link>
        <Link href="/events">Events</Link>
      </nav>
      <div className="page">
        <h1>Guides</h1>
        <p className="muted">Readable by any Base or Premium subscriber.</p>

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
    overrideAccess: true,
  })

  return (
    <div className="card">
      {guides.map((g) => (
        <Link key={g.id} href={`/guides/${g.slug}`} className="excerpt-list-item">
          <h3>{g.title}</h3>
          {g.description && <div className="excerpt-meta">{g.description}</div>}
        </Link>
      ))}
      {guides.length === 0 && <p className="muted">No guides yet.</p>}
    </div>
  )
}
