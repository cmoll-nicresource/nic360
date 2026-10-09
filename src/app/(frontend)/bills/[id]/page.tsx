import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'

export const dynamic = 'force-dynamic'

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canReadFull = isStaff || planSatisfies(plan, 'base')

  const bill = await payload.findByID({ collection: 'bills', id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!bill) notFound()

  return (
    <>
      <SiteNav />
      <div className="page">
        <p>
          <Link href="/bills">&larr; All bills</Link>
        </p>
        <h1>
          {bill.billNumber} — {bill.title}
        </h1>
        <p className="excerpt-meta">
          {bill.billType} · {bill.governmentLevel}
          {bill.session ? ` · ${bill.session} session` : null}
          {bill.billDate ? ` · ${new Date(bill.billDate).toLocaleDateString()}` : null}
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

        {canReadFull && (
          <div className="card">
            <h3>Full text</h3>
            <RichText data={bill.fullText} />
          </div>
        )}

        <div className="card">
          <h3>Status</h3>
          <p className="excerpt-meta">{bill.statusText || '—'}</p>
          {bill.actions && bill.actions.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {bill.actions.map((a, i) => (
                  <tr key={i}>
                    <td>{a.date ? new Date(a.date).toLocaleDateString() : '—'}</td>
                    <td>{a.action}</td>
                    <td>{a.actor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Index terms</h3>
          <p className="excerpt-meta">
            <strong>Primary subject:</strong>{' '}
            {bill.primarySubject && typeof bill.primarySubject === 'object' ? bill.primarySubject.name : '—'}
          </p>
          <p className="excerpt-meta">
            <strong>Subjects:</strong>{' '}
            {bill.subjects?.map((s) => (typeof s === 'object' ? s.name : s)).join(', ') || '—'}
          </p>
          <p className="excerpt-meta">
            <strong>Sectors:</strong>{' '}
            {bill.sectors?.map((s) => (typeof s === 'object' ? s.name : s)).join(', ') || '—'}
          </p>
          <p className="excerpt-meta">
            <strong>Products:</strong>{' '}
            {bill.products?.map((p) => (typeof p === 'object' ? p.name : p)).join(', ') || '—'}
          </p>
          <p className="excerpt-meta">
            <strong>Locations:</strong>{' '}
            {bill.locations?.map((l) => (typeof l === 'object' ? l.name : l)).join(', ') || '—'}
          </p>
        </div>
      </div>
    </>
  )
}
