import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { formatDate } from '@/lib/formatDate'
import { StatusBadge } from '@/components/StatusBadge'
import { trademarkStatusPill } from '@/lib/statusPill'

export const dynamic = 'force-dynamic'

export default async function TrademarkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canRead = isStaff || planSatisfies(plan, 'base')

  return (
    <>
      <SiteNav />
      <div className="page">
        <div className="breadcrumbs">
          <Link href="/trademarks">Trademarks</Link>
        </div>
        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view this trademark.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <TrademarkDetail payload={payload} id={id} />
        )}
      </div>
    </>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <tr>
      <th>{label}</th>
      <td>{value}</td>
    </tr>
  )
}

async function TrademarkDetail({
  payload,
  id,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  id: string
}) {
  const trademark = await payload
    .findByID({ collection: 'trademarks', id, depth: 1, overrideAccess: true })
    .catch(() => null)
  if (!trademark) notFound()

  const image = trademark.image && typeof trademark.image === 'object' ? trademark.image : null
  const usptoUrl = trademark.serialNumber
    ? `https://tsdr.uspto.gov/#caseNumber=${trademark.serialNumber}&caseType=SERIAL_NO&searchType=statusSearch`
    : null

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <StatusBadge status={trademarkStatusPill(trademark)} />
      </div>
      <h1>{trademark.title}</h1>
      <p className="excerpt-meta">
        {trademark.owner}
        {trademark.class ? ` · Class ${trademark.class}` : null}
        {trademark.serialNumber ? ` · Serial ${trademark.serialNumber}` : null}
      </p>

      {image?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt={image.alt || trademark.title}
          style={{ maxWidth: 320, marginBottom: 16, border: '1px solid var(--nrc-border)', borderRadius: 8, padding: 12, background: '#fff' }}
        />
      )}

      <div className="card">
        <table>
          <tbody>
            <Fact label="Owner address" value={trademark.ownerAddress} />
            <Fact
              label="Style / Design"
              value={trademark.style || trademark.design ? `${trademark.style ?? '—'} / ${trademark.design ?? '—'}` : null}
            />
            <Fact label="Filed" value={trademark.filedDate ? formatDate(trademark.filedDate) : null} />
            <Fact label="Published" value={trademark.publishedDate ? formatDate(trademark.publishedDate) : null} />
            <Fact
              label="Registered"
              value={
                trademark.registeredDate
                  ? `${formatDate(trademark.registeredDate)}${trademark.registrationNumber ? ` (No. ${trademark.registrationNumber})` : ''}`
                  : null
              }
            />
            <Fact label="Cancelled" value={trademark.cancelledDate ? formatDate(trademark.cancelledDate) : null} />
            <Fact
              label="Renewed"
              value={
                trademark.renewedDate
                  ? `${formatDate(trademark.renewedDate)}${trademark.renewal?.owner ? ` — ${trademark.renewal.owner}` : ''}`
                  : null
              }
            />
          </tbody>
        </table>
        {usptoUrl && (
          <p style={{ marginTop: 16, marginBottom: 0 }}>
            <a href={usptoUrl} target="_blank" rel="noreferrer">
              View on USPTO →
            </a>
          </p>
        )}
      </div>
    </>
  )
}
