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
      <SiteNav />
      <div className="page-wide">
        <div className="breadcrumbs">
          <Link href="/datasets">Data</Link>
          <span className="sep">/</span>
          <span className="current">{dataset.title}</span>
        </div>
        <div className="dashboard-header">
          <div>
            <h1>{dataset.title}</h1>
            {dataset.description && <p className="muted">{dataset.description}</p>}
            {dataset.lastImport?.rowCount ? (
              <p className="muted" style={{ fontSize: 13 }}>
                {dataset.lastImport.rowCount.toLocaleString()} rows
                {dataset.lastImport.importedAt ? ` · updated ${formatDate(dataset.lastImport.importedAt)}` : ''}
              </p>
            ) : null}
          </div>
          {canRead && (
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`/api/datasets/${dataset.id}/export?format=csv`} className="btn btn-secondary">
                Download CSV
              </a>
              <a href={`/api/datasets/${dataset.id}/export?format=xlsx`} className="btn btn-secondary">
                Download Excel
              </a>
            </div>
          )}
        </div>

        {!canRead ? (
          <div className="locked-content">
            A Premium subscription is required to view this data.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <div className="card">
            <DatasetGrid datasetId={String(dataset.id)} />
          </div>
        )}
      </div>
    </>
  )
}
