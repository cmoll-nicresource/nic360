import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { DashboardIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

export const dynamic = 'force-dynamic'

export default async function DatasetsPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = staffHasRole(user, 'editor')
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canRead = isStaff || planSatisfies(plan, 'premium')

  const { docs: datasets } = await payload.find({
    collection: 'datasets',
    limit: 100,
    sort: 'title',
    overrideAccess: true,
  })

  const CATEGORIES = [
    { value: 'policy', label: 'Policy' },
    { value: 'markets', label: 'Markets' },
    { value: 'trade', label: 'Trade' },
  ] as const

  return (
    <>
      <SiteNav />
      <div className="page">
        <h1 className="page-heading">
          <DashboardIcon />
          Data
        </h1>
        <p className="muted">
          Staff-maintained reference tables. {!canRead && 'Premium subscription required to view rows.'}
        </p>
        {CATEGORIES.map((c) => {
          const inCategory = datasets.filter((d) => d.category === c.value)
          if (inCategory.length === 0) return null
          return (
            <div key={c.value} style={{ marginBottom: 24 }}>
              <h2>{c.label}</h2>
              <div className="card">
                {inCategory.map((d) => (
                  <Link key={d.id} href={`/datasets/${d.slug}`} className="excerpt-list-item">
                    <h3>
                      {d.icon ? `${d.icon} ` : ''}
                      {d.title}
                    </h3>
                    <div className="excerpt-meta">
                      {d.description || `${d.columns.length} column(s)`}
                      {d.lastImport?.rowCount ? ` · ${d.lastImport.rowCount} row(s)` : ' · not yet imported'}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
        {datasets.length === 0 && <p className="muted">No datasets yet.</p>}
      </div>
    </>
  )
}
