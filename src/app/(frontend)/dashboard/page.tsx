import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies, type ReaderPlan } from '@/access/readerPlan'
import { SiteNav } from '@/components/SiteNav'
import { NoSubscriptionNotice } from '@/components/NoSubscriptionNotice'
import {
  AnnouncementIcon,
  DashboardIcon,
  DocumentationIcon,
  JournalIcon,
  LawIcon,
  ScheduleIcon,
  StampIcon,
} from '@/components/brandIcons'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard' }

type Product = {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  requires: 'base' | 'premium'
  collection?: 'articles' | 'bills' | 'trademarks'
}

const PRODUCTS: Product[] = [
  { href: '/articles', icon: AnnouncementIcon, title: 'News', description: 'News from across the industry.', requires: 'base', collection: 'articles' },
  { href: '/bills', icon: LawIcon, title: 'Legislation', description: 'Legislation tracked via StateNet.', requires: 'base', collection: 'bills' },
  { href: '/trademarks', icon: StampIcon, title: 'Trademarks', description: 'Weekly USPTO filings.', requires: 'base', collection: 'trademarks' },
  { href: '/guides', icon: DocumentationIcon, title: 'Guides', description: 'Reference guides and how-tos.', requires: 'base' },
  { href: '/publications', icon: JournalIcon, title: 'Publications', description: 'Newsletters and issues.', requires: 'base' },
  { href: '/datasets', icon: DashboardIcon, title: 'Data', description: 'Market, tax and trade datasets you can filter and download.', requires: 'premium' },
]

export default async function DashboardPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!user || !('collection' in user) || user.collection !== 'users') {
    return (
      <>
        <SiteNav />
        <div className="page">
          <h1>Dashboard</h1>
          <p>
            You need to be signed in as a reader. <Link href="/signup">Create an account</Link> or{' '}
            <Link href="/account">sign in</Link>.
          </p>
        </div>
      </>
    )
  }

  const fullUser = await payload.findByID({ collection: 'users', id: user.id, depth: 1, overrideAccess: true })
  const plan = await getReaderPlan(fullUser, payload)
  const tierLabel: Record<ReaderPlan, string> = { none: 'No subscription', base: 'Base', premium: 'Premium' }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const newCounts: Partial<Record<'articles' | 'bills' | 'trademarks', number>> = {}
  if (plan !== 'none') {
    const results = await Promise.all(
      (['articles', 'bills', 'trademarks'] as const).map((c) =>
        payload.count({
          collection: c,
          where: { createdAt: { greater_than_equal: sevenDaysAgo.toISOString() } },
          overrideAccess: true,
        }),
      ),
    )
    newCounts.articles = results[0].totalDocs
    newCounts.bills = results[1].totalDocs
    newCounts.trademarks = results[2].totalDocs
  }

  return (
    <>
      <SiteNav />
      <div className="page-wide">
        <div className="dashboard-header">
          <div>
            <h1>Welcome back, {fullUser.firstName}</h1>
            <p className="muted">
              Plan: <span className={`badge badge-${plan}`}>{tierLabel[plan]}</span>
            </p>
          </div>
        </div>

        {plan === 'none' ? (
          <NoSubscriptionNotice payload={payload} />
        ) : (
          <div className="product-grid">
            {PRODUCTS.map((p) => {
              const unlocked = planSatisfies(plan, p.requires)
              const Icon = p.icon
              const newCount = p.collection ? newCounts[p.collection] : undefined
              const inner = (
                <>
                  <div className="icon">
                    <Icon />
                  </div>
                  <h3>{p.title}</h3>
                  <p>{unlocked ? p.description : `${p.description} Premium only.`}</p>
                  {unlocked && newCount ? (
                    <p className="muted tnum" style={{ marginTop: 4, fontWeight: 600, color: 'var(--nrc-teal)' }}>
                      {newCount} new this week
                    </p>
                  ) : null}
                </>
              )
              return unlocked ? (
                <Link key={p.href} href={p.href} className="product-card">
                  {inner}
                </Link>
              ) : (
                <div key={p.href} className="product-card locked">
                  {inner}
                </div>
              )
            })}
            <Link href="/events" className="product-card">
              <div className="icon">
                <ScheduleIcon />
              </div>
              <h3>Events</h3>
              <p>Conferences and webinars — open to everyone, ticketed separately.</p>
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
