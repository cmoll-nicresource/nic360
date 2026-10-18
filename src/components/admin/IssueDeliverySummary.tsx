'use client'
import { useAuth, useDocumentInfo } from '@payloadcms/ui'
import Link from 'next/link'
import type { PublicationIssue } from '@/payload-types'

const metrics = [
  ['recipientCount', 'Recipients'], ['delivered', 'Delivered'], ['opens', 'Opens'],
  ['clicks', 'Clicks'], ['bounces', 'Bounces'], ['complaints', 'Complaints'],
] as const

export function IssueDeliverySummary() {
  const { id, savedDocumentData } = useDocumentInfo()
  const { user } = useAuth()
  const issue = savedDocumentData as PublicationIssue | undefined
  const status = issue?.email?.status || 'not sent'
  return <section className="nic-issue-delivery" aria-label="Delivery stats">
    <header><div><p className="nic-issue-delivery__eyebrow">Email performance</p><h2>Delivery stats</h2></div>
      <span className={'nic-issue-delivery__status nic-issue-delivery__status--' + status.replaceAll(' ', '-')}>
        {status === 'not sent' ? 'Not sent' : status === 'sending' ? 'Sending' : status === 'failed' ? 'Delivery failed' : 'Sent'}
      </span>
    </header>
    {!id ? <p>Delivery activity will appear here after this issue is saved and sent.</p> : <>
      <dl className="nic-issue-delivery__metrics">{metrics.map(([key, label]) => {
        const value = issue?.stats?.[key] ?? 0
        return <div key={key} className={(key === 'bounces' || key === 'complaints') && value > 0 ? 'nic-issue-delivery__metric--attention' : undefined}>
          <dt>{label}</dt><dd>{new Intl.NumberFormat('en-US').format(value)}</dd>
        </div>
      })}</dl>
      <p className="nic-issue-delivery__note">Counts are reported email events; opens and clicks are not unique users. Historical imported figures are retained. Reload to refresh.</p>
    </>}
    {user?.collection === 'staff' && (user.role === 'gatekeeper' || user.role === 'admin') && <Link href="/admin/analytics">View publication analytics</Link>}
  </section>
}
