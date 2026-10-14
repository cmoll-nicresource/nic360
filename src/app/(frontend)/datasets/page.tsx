import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { DashboardIcon } from '@/components/brandIcons'
import { MarketsIcon, PolicyIcon, TradeIcon } from '@/components/icons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'
import { formatDate } from '@/lib/formatDate'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  { value: 'policy', label: 'Policy', Icon: PolicyIcon },
  { value: 'markets', label: 'Markets', Icon: MarketsIcon },
  { value: 'trade', label: 'Trade', Icon: TradeIcon },
] as const

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

  return (
    <>
      <SiteNav />
      <div className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="header-band-eyebrow">Data</p>
            <h1 className="page-heading">
              <span className="icon-badge">
                <DashboardIcon />
              </span>
              Data
            </h1>
            <p>
              Market, tax and trade data, researched and updated by our analysts.{' '}
              {!canRead && 'Premium subscription required to view rows.'}
            </p>
          </div>
          <span className="header-band-meta">{datasets.length} datasets</span>
        </div>
      </div>
      <div className="page" style={{ maxWidth: 'var(--page-wide)' }}>
        {CATEGORIES.map((c) => {
          const inCategory = datasets.filter((d) => d.category === c.value)
          if (inCategory.length === 0) return null
          return (
            <div key={c.value} style={{ marginBottom: 32 }}>
              <h2>{c.label}</h2>
              <div className="product-grid">
                {inCategory.map((d) => (
                  <Link key={d.id} href={`/datasets/${d.slug}`} className="product-card">
                    <div className="icon">
                      <c.Icon />
                    </div>
                    <h3>{d.title}</h3>
                    <p>{d.description || `${d.columns.length} column(s)`}</p>
                    <p className="muted" style={{ marginTop: 6 }}>
                      {d.lastImport?.rowCount
                        ? `${d.lastImport.rowCount.toLocaleString()} rows${d.lastImport.importedAt ? ` · updated ${formatDate(d.lastImport.importedAt)}` : ''}`
                        : 'Not yet imported'}
                    </p>
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
