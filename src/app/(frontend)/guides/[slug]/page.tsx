import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

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
      <nav className="topnav">
        <Link href="/">Nicotine360</Link>
        <Link href="/articles">Articles</Link>
        <Link href="/datasets">Data</Link>
        <Link href="/guides">Guides</Link>
      </nav>
      <div className="page">
        <p>
          <Link href="/guides">&larr; All guides</Link>
        </p>
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

  return (
    <>
      <h1>{guide.title}</h1>
      {guide.description && <p className="muted">{guide.description}</p>}
      <div className="card">
        {file?.url ? (
          <a href={file.url} target="_blank" rel="noreferrer">
            Download PDF
          </a>
        ) : (
          <p className="muted">No file attached.</p>
        )}
      </div>
    </>
  )
}
