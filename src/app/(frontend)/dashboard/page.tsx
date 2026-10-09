import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies, type ReaderPlan } from '@/access/readerPlan'
import { SiteNav } from '@/components/SiteNav'
import { NoSubscriptionNotice } from '@/components/NoSubscriptionNotice'

export const dynamic = 'force-dynamic'

type Product = {
  href: string
  icon: string
  title: string
  description: string
  requires: 'base' | 'premium'
}

const PRODUCTS: Product[] = [
  { href: '/articles', icon: '📰', title: 'Articles', description: 'News from across the industry.', requires: 'base' },
  { href: '/bills', icon: '🏛️', title: 'Bills', description: 'Legislation tracked via StateNet.', requires: 'base' },
  { href: '/trademarks', icon: '®️', title: 'Trademarks', description: 'Weekly USPTO filings.', requires: 'base' },
  { href: '/guides', icon: '📘', title: 'Guides', description: 'Reference guides and how-tos.', requires: 'base' },
  { href: '/publications', icon: '✉️', title: 'Publications', description: 'Newsletters and issues.', requires: 'base' },
  { href: '/datasets', icon: '📊', title: 'Data', description: 'Market, tax and trade datasets in AG Grid.', requires: 'premium' },
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
              const card = (
                <div className={`product-card ${unlocked ? '' : 'locked'}`}>
                  <div className="icon">{p.icon}</div>
                  <h3>{p.title}</h3>
                  <p>{unlocked ? p.description : `${p.description} Premium only.`}</p>
                </div>
              )
              return unlocked ? (
                <Link key={p.href} href={p.href} className="product-card" style={{ display: 'block' }}>
                  <div className="icon">{p.icon}</div>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                </Link>
              ) : (
                <div key={p.href}>{card}</div>
              )
            })}
            <Link href="/events" className="product-card">
              <div className="icon">🎟️</div>
              <h3>Events</h3>
              <p>Conferences and webinars — open to everyone, ticketed separately.</p>
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
