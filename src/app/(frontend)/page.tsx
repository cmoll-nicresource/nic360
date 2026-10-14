import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { CHANNELS } from '@/config/channels'
import { SiteNav } from '@/components/SiteNav'
import { formatDate } from '@/lib/formatDate'
import {
  AnnouncementIcon,
  DashboardIcon,
  DocumentationIcon,
  LawIcon,
  ScheduleIcon,
  StampIcon,
} from '@/components/brandIcons'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const isReader = !!user && 'collection' in user && user.collection === 'users'

  // Logged-in readers have no use for the marketing homepage — straight to
  // the dashboard, which already has live counts and "new since your last
  // visit" instead of a repeated sales pitch.
  if (isReader) redirect('/dashboard')

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [{ docs: upcomingEvents }, { docs: guides }, articleCount, billCount, trademarkCount, datasetCount] =
    await Promise.all([
      payload.find({
        collection: 'events',
        where: { endDate: { greater_than_equal: thirtyDaysAgo.toISOString() } },
        sort: 'startsAt',
        limit: 3,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'guides',
        sort: 'title',
        limit: 3,
        depth: 0,
        overrideAccess: true,
      }),
      payload.count({ collection: 'articles', overrideAccess: true }).then((r) => r.totalDocs),
      payload.count({ collection: 'bills', overrideAccess: true }).then((r) => r.totalDocs),
      payload.count({ collection: 'trademarks', overrideAccess: true }).then((r) => r.totalDocs),
      payload.count({ collection: 'datasets', overrideAccess: true }).then((r) => r.totalDocs),
    ])
  const [latestArticle] = (
    await payload.find({ collection: 'articles', sort: '-sourceDate', limit: 1, depth: 0, overrideAccess: true })
  ).docs

  return (
    <>
      <SiteNav />
      <div className="hero">
        <div className="hero-grid">
          <div className="hero-inner">
            <p className="eyebrow">Trade intelligence</p>
            <h1>News and intelligence for the nicotine and tobacco industry.</h1>
            <p className="hero-sub">
              Articles, legislation, trademarks, market data and events — in one place, curated for
              your company&apos;s subscription.
            </p>
            <div className="hero-actions">
              {isReader && (
                <Link href="/dashboard" className="btn">
                  Go to your dashboard →
                </Link>
              )}
              {isStaff && (
                <Link href={payloadConfig.routes.admin} className="btn">
                  Go to admin →
                </Link>
              )}
              {!user && (
                <>
                  <Link href="/signup" className="btn btn-accent">
                    Create an account
                  </Link>
                  <Link href="/articles" className="btn btn-secondary">
                    Browse articles
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hero-image">
            {/* Placeholder for a real product screenshot (dashboard + a dataset
                chart, framed in a browser mockup) — see docs/nicotine360-design-review.md. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://placehold.co/1120x840/16365a/9fb8cf?text=Product+screenshot%0A(dashboard+%2B+dataset+chart)"
              alt=""
              role="presentation"
            />
          </div>
        </div>
      </div>

      <div className="page" style={{ maxWidth: 'var(--page-wide)' }}>
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <div className="stat-box">
            <div className="stat-box-value tnum">{articleCount.toLocaleString()}</div>
            <div className="stat-box-label">Articles indexed</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-value tnum">{billCount.toLocaleString()}</div>
            <div className="stat-box-label">Bills tracked</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-value tnum">{trademarkCount.toLocaleString()}</div>
            <div className="stat-box-label">Trademark filings</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-value tnum">{datasetCount.toLocaleString()}</div>
            <div className="stat-box-label">Market &amp; trade datasets</div>
          </div>
        </div>

        <div className="product-grid">
          <Link href="/articles" className="product-card">
            <div className="icon">
              <AnnouncementIcon />
            </div>
            <h3>News</h3>
            <p>{latestArticle ? `Latest: ${latestArticle.title}` : 'Daily news from across the industry.'}</p>
          </Link>
          <Link href="/bills" className="product-card">
            <div className="icon">
              <LawIcon />
            </div>
            <h3>Legislation</h3>
            <p>Legislation tracked via StateNet, {billCount.toLocaleString()} bills and counting.</p>
          </Link>
          <Link href="/trademarks" className="product-card">
            <div className="icon">
              <StampIcon />
            </div>
            <h3>Trademarks</h3>
            <p>Weekly USPTO filings, renewals and cancellations.</p>
          </Link>
          <Link href="/datasets" className="product-card">
            <div className="icon">
              <DashboardIcon />
            </div>
            <h3>Data</h3>
            <p>Market, tax and trade datasets, researched by our analysts.</p>
          </Link>
          <Link href="/guides" className="product-card">
            <div className="icon">
              <DocumentationIcon />
            </div>
            <h3>Guides</h3>
            <p>In-depth reference guides to tax, trade and regulation.</p>
          </Link>
          <Link href="/events" className="product-card">
            <div className="icon">
              <ScheduleIcon />
            </div>
            <h3>Events</h3>
            <p>Conferences and webinars across our channels.</p>
          </Link>
        </div>
      </div>

      {(upcomingEvents.length > 0 || guides.length > 0) && (
        <div className="page">
          {upcomingEvents.length > 0 && (
            <div className="teaser-section">
              <div className="teaser-section-header">
                <h2>Upcoming events</h2>
                <Link href="/events">View all events →</Link>
              </div>
              <div className="teaser-grid">
                {upcomingEvents.map((e) => (
                  <Link key={e.id} href={`/events/${e.id}`} className="teaser-card event-teaser-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://placehold.co/480x240/${CHANNELS[e.channel].brandColor.replace('#', '')}/ffffff?text=${encodeURIComponent(CHANNELS[e.channel].name)}`}
                      alt=""
                      role="presentation"
                      className="event-teaser-image"
                    />
                    <div style={{ padding: 16 }}>
                      <span className="badge" style={{ background: `${CHANNELS[e.channel].brandColor}1a`, color: CHANNELS[e.channel].brandColor }}>
                        {CHANNELS[e.channel].name}
                      </span>
                      <h3>{e.name}</h3>
                      <p className="muted">
                        {formatDate(e.startsAt)}
                        {e.venue?.address ? ` · ${e.venue.address}` : ''}
                      </p>
                      <span className="btn btn-secondary" style={{ marginTop: 8 }}>
                        Get tickets
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {guides.length > 0 && (
            <div className="teaser-section">
              <div className="teaser-section-header">
                <h2>Reference guides</h2>
                <Link href="/guides">View all guides →</Link>
              </div>
              <div className="teaser-grid">
                {guides.map((g) => (
                  <Link key={g.id} href={`/guides/${g.slug}`} className="teaser-card">
                    <h3>{g.title}</h3>
                    {g.description && <p className="muted">{g.description}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="plans-section">
        <div className="page">
          <h2>Two ways to subscribe</h2>
          <p className="muted">
            Sign up with your work email — if your company already subscribes, you&rsquo;re in automatically, with
            no per-seat setup.
          </p>
          <div className="plans-grid">
            <div className="plan-card">
              <span className="badge badge-base">Base</span>
              <h3>News, legislation &amp; trademarks</h3>
              <ul>
                <li>Full articles, bills and trademark filings</li>
                <li>Reference guides and how-tos</li>
                <li>All publications and newsletters</li>
              </ul>
              <a href="mailto:membership@nicotine360.org" className="btn btn-secondary" style={{ marginTop: 16 }}>
                Talk to us
              </a>
            </div>
            <div className="plan-card plan-card-premium">
              <span className="badge badge-premium">Premium</span>
              <h3>Everything in Base, plus data</h3>
              <ul>
                <li>Market, tax and trade datasets</li>
                <li>Interactive tables with CSV and Excel export</li>
                <li>Everything included in Base</li>
              </ul>
              <a href="mailto:membership@nicotine360.org" className="btn btn-accent" style={{ marginTop: 16 }}>
                Talk to us
              </a>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 16 }}>
            Events are ticketed separately and open to anyone, with or without a subscription.{' '}
            <Link href="/events">See upcoming events</Link>. Setting up access for your company?{' '}
            <a href="mailto:membership@nicotine360.org">Talk to us</a>.
          </p>
        </div>
      </div>

      {!user && (
        <div className="closing-cta">
          <div className="hero-inner">
            <h2>Ready to get started?</h2>
            <p className="hero-sub">Create your account, or check whether your company already has a subscription.</p>
            <div className="hero-actions">
              <Link href="/signup" className="btn btn-accent">
                Create an account
              </Link>
              <Link href="/login" className="btn btn-secondary">
                Log in
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
