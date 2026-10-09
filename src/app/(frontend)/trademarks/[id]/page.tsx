import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'

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
        <p>
          <Link href="/trademarks">&larr; All trademarks</Link>
        </p>
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

  return (
    <>
      <h1>{trademark.title}</h1>
      <p className="excerpt-meta">
        {trademark.owner}
        {trademark.class ? ` · Class ${trademark.class}` : null}
        {trademark.serialNumber ? ` · Serial ${trademark.serialNumber}` : null}
      </p>

      <div className="card">
        {image?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.alt || trademark.title} style={{ maxWidth: 240, marginBottom: 16 }} />
        )}
        <table>
          <tbody>
            <tr>
              <th>Owner address</th>
              <td>{trademark.ownerAddress || '—'}</td>
            </tr>
            <tr>
              <th>Style / Design</th>
              <td>
                {trademark.style ?? '—'} / {trademark.design ?? '—'}
              </td>
            </tr>
            <tr>
              <th>Filed</th>
              <td>{trademark.filedDate ? new Date(trademark.filedDate).toLocaleDateString() : '—'}</td>
            </tr>
            <tr>
              <th>Published</th>
              <td>{trademark.publishedDate ? new Date(trademark.publishedDate).toLocaleDateString() : '—'}</td>
            </tr>
            <tr>
              <th>Registered</th>
              <td>
                {trademark.registeredDate ? new Date(trademark.registeredDate).toLocaleDateString() : '—'}
                {trademark.registrationNumber ? ` (No. ${trademark.registrationNumber})` : null}
              </td>
            </tr>
            <tr>
              <th>Cancelled</th>
              <td>{trademark.cancelledDate ? new Date(trademark.cancelledDate).toLocaleDateString() : '—'}</td>
            </tr>
            <tr>
              <th>Renewed</th>
              <td>
                {trademark.renewedDate ? new Date(trademark.renewedDate).toLocaleDateString() : '—'}
                {trademark.renewal?.owner ? ` — ${trademark.renewal.owner}` : null}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
