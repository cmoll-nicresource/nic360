import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { JournalIcon } from '@/components/brandIcons'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'
import { sentenceCase } from '@/lib/textCase'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Publications',
  description: 'Daily and weekly briefings, delivered to your inbox and archived here.',
}

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
      <SiteNav />
      <div className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="header-band-eyebrow">Content</p>
            <h1 className="page-heading">
              <span className="icon-badge">
                <JournalIcon />
              </span>
              Publications
            </h1>
            <p>Daily and weekly briefings, delivered to your inbox and archived here.</p>
          </div>
        </div>
      </div>
      <div className="page">
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

const CATEGORIES = [
  { value: 'news', label: 'News' },
  { value: 'legislation', label: 'Legislation' },
  { value: 'trademarks', label: 'Trademarks' },
] as const

async function PublicationList({ payload }: { payload: Awaited<ReturnType<typeof getPayload>> }) {
  const { docs: publications } = await payload.find({
    collection: 'publications',
    limit: 100,
    sort: 'title',
    overrideAccess: true,
  })

  if (publications.length === 0) return <p className="muted">No publications yet.</p>

  return (
    <>
      {CATEGORIES.map((c) => {
        const inCategory = publications.filter((p) => p.category?.includes(c.value))
        if (inCategory.length === 0) return null
        return (
          <div key={c.value} style={{ marginBottom: 24 }}>
            <h2>{c.label}</h2>
            <div className="card">
              {inCategory.map((p) => (
                <Link key={p.id} href={`/publications/${p.slug}`} className="excerpt-list-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0 }}>{p.title}</h3>
                    {p.frequency && <span className="tag-pill">{sentenceCase(p.frequency)}</span>}
                  </div>
                  {p.description && <div className="excerpt-meta">{p.description}</div>}
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
