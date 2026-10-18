import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'

import config from '@/payload.config'
import { getSubscriptionPlan, planSatisfies } from '@/access/subscriptionPlan'
import { formatDate } from '@/lib/formatDate'
import { billStatusPill } from '@/lib/statusPill'
import { StatusBadge, TagPill } from '@/components/StatusBadge'

export const dynamic = 'force-dynamic'

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan = user && 'collection' in user && user.collection === 'users' ? await getSubscriptionPlan(user, payload) : 'none'
  const canReadFull = isStaff || planSatisfies(plan, 'base')

  const bill = await payload.findByID({ collection: 'bills', id, depth: 1, user, overrideAccess: false }).catch(() => null)
  if (!bill) notFound()

  const jurisdiction = bill.locations?.find((l) => typeof l === 'object')
  const jurisdictionName = jurisdiction && typeof jurisdiction === 'object' ? jurisdiction.name : bill.governmentLevel
  const hasFullText = bill.fullText && Array.isArray(bill.fullText.root?.children) && bill.fullText.root.children.length > 0

  return (
    <>
      <SiteNav />
      <div className="page">
        <div className="breadcrumbs">
          <Link href="/bills">Legislation</Link>
          <span className="sep">/</span>
          <span className="current">{jurisdictionName}</span>
          <span className="sep">/</span>
          <span className="current">{bill.billNumber}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span className="tag-pill tnum">{bill.billNumber}</span>
          <StatusBadge status={billStatusPill(bill)} />
        </div>
        <h1>{bill.title}</h1>
        <p className="excerpt-meta">
          {bill.billType} · {jurisdictionName}
          {bill.session ? ` · ${bill.session} session` : null}
          {bill.billDate ? ` · ${formatDate(bill.billDate)}` : null}
        </p>

        <div className="card">
          <h3>Abstract</h3>
          {canReadFull ? (
            <RichText data={bill.abstract} />
          ) : (
            <div className="locked-content">
              Full abstract requires a Base or Premium subscription.{' '}
              <Link href="/account">Sign in</Link> with your company&apos;s access, or contact your
              administrator.
            </div>
          )}
        </div>

        {canReadFull && hasFullText && (
          <div className="card">
            <h3>Full text</h3>
            <RichText data={bill.fullText} />
          </div>
        )}

        {bill.actions && bill.actions.length > 0 && (
          <div className="card">
            <h3>Status</h3>
            <ol className="status-timeline">
              {bill.actions.map((a, i) => (
                <li key={i}>
                  <span className="status-timeline-dot" />
                  <div>
                    <div className="excerpt-meta tnum">{a.date ? formatDate(a.date) : '—'}</div>
                    <div>
                      {a.action}
                      {a.actor ? <span className="muted"> — {a.actor}</span> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="card">
          <h3>Index terms</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {bill.primarySubject && typeof bill.primarySubject === 'object' && (
              <TagPill href={`/bills?subject=${bill.primarySubject.id}`}>{bill.primarySubject.name}</TagPill>
            )}
            {bill.subjects
              ?.filter((s) => typeof s === 'object')
              .map((s) => (
                <TagPill key={s.id} href={`/bills?subject=${s.id}`}>
                  {s.name}
                </TagPill>
              ))}
            {bill.sectors
              ?.filter((s) => typeof s === 'object')
              .map((s) => (
                <TagPill key={s.id} href={`/bills?sector=${s.id}`}>
                  {s.name}
                </TagPill>
              ))}
            {bill.products
              ?.filter((p) => typeof p === 'object')
              .map((p) => (
                <TagPill key={p.id} href={`/bills?product=${p.id}`}>
                  {p.name}
                </TagPill>
              ))}
            {bill.locations
              ?.filter((l) => typeof l === 'object')
              .map((l) => (
                <TagPill key={l.id} href={`/bills?location=${l.id}`}>
                  {l.name}
                </TagPill>
              ))}
            {!bill.primarySubject && !bill.subjects?.length && !bill.sectors?.length && !bill.products?.length && !bill.locations?.length && (
              <span className="muted">No index terms yet.</span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
