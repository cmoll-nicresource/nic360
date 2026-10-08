import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'
import { DatasetGrid } from '@/components/DatasetGrid'

export const dynamic = 'force-dynamic'

export default async function DatasetViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = staffHasRole(user, 'editor')
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canRead = isStaff || planSatisfies(plan, 'premium')

  const { docs } = await payload.find({
    collection: 'datasets',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })
  const dataset = docs[0]
  if (!dataset) notFound()

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
          <Link href="/datasets">&larr; All datasets</Link>
        </p>
        <h1>
          {dataset.icon ? `${dataset.icon} ` : ''}
          {dataset.title}
        </h1>
        {dataset.description && <p className="muted">{dataset.description}</p>}

        {!canRead ? (
          <div className="locked-content">
            A Premium subscription is required to view this data.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <>
            <p>
              <a href={`/api/datasets/${dataset.id}/export`}>Download CSV</a>
            </p>
            <div className="card">
              <DatasetGrid datasetId={String(dataset.id)} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
