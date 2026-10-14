import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { after } from 'next/server'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { logPageView } from '@/lib/logPageView'
import { CloseIcon, MenuIcon } from '@/components/icons'
import { LogoutButton } from '@/components/LogoutButton'

const TRACKING_LINKS = [
  { href: '/articles', label: 'News' },
  { href: '/bills', label: 'Legislation' },
  { href: '/trademarks', label: 'Trademarks' },
]

const DATA_CATEGORIES = [
  { value: 'policy', label: 'Policy' },
  { value: 'markets', label: 'Markets' },
  { value: 'trade', label: 'Trade' },
] as const

const PUBLICATION_CATEGORIES = [
  { value: 'news', label: 'News' },
  { value: 'legislation', label: 'Legislation' },
  { value: 'trademarks', label: 'Trademarks' },
] as const

/** Shared top nav for every front-end page: brand mark, section links, and auth-aware actions on the right. */
export async function SiteNav() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const isReader = !!user && 'collection' in user && user.collection === 'users'

  // Every front-end page renders SiteNav directly (not via the shared
  // layout, which Next.js won't re-run on every client-side navigation), so
  // this fires once per actual page view. Deferred via after() so it never
  // adds latency to the page itself.
  const pathname = headers.get('x-pathname')
  if (pathname) {
    after(() => logPageView(payload, pathname, user))
  }

  const readerUser = isReader && user && 'collection' in user && user.collection === 'users' ? user : null
  const initials = readerUser
    ? `${(readerUser.firstName ?? '')[0] ?? ''}${(readerUser.lastName ?? '')[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  const sectionFor = (path: string): string | null => {
    if (path.startsWith('/articles') || path.startsWith('/bills') || path.startsWith('/trademarks')) return 'tracking'
    if (path.startsWith('/guides')) return 'guides'
    if (path.startsWith('/datasets')) return 'data'
    if (path.startsWith('/publications')) return 'publications'
    if (path.startsWith('/events')) return 'events'
    return null
  }
  const activeSection = pathname ? sectionFor(pathname) : null

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [{ docs: guides }, { docs: datasets }, { docs: publications }, { docs: events }] = await Promise.all([
    payload.find({ collection: 'guides', limit: 20, sort: 'createdAt', depth: 0, overrideAccess: true }),
    payload.find({ collection: 'datasets', limit: 50, sort: 'title', depth: 0, overrideAccess: true }),
    payload.find({ collection: 'publications', limit: 50, sort: 'title', depth: 0, overrideAccess: true }),
    payload.find({
      collection: 'events',
      where: { endDate: { greater_than_equal: thirtyDaysAgo.toISOString() } },
      limit: 20,
      sort: 'startsAt',
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const datasetsByCategory = Object.fromEntries(
    DATA_CATEGORIES.map((c) => [c.value, datasets.filter((d) => d.category === c.value)]),
  )
  const publicationsByCategory = Object.fromEntries(
    PUBLICATION_CATEGORIES.map((c) => [
      c.value,
      publications.filter((p) => p.category?.includes(c.value)),
    ]),
  )

  return (
    <nav className="topnav">
      <Link href="/" className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Nicotine360" />
      </Link>

      {/* CSS-only mobile menu: no client JS needed to toggle it — see the
          .nav-toggle-* rules in styles.css. Must come before .nav-links and
          .nav-right in the DOM so the :checked sibling selectors can reach them. */}
      <input type="checkbox" id="nav-toggle" className="nav-toggle-checkbox" />
      <label htmlFor="nav-toggle" className="nav-toggle-btn" aria-label="Menu">
        <MenuIcon className="nav-toggle-icon nav-toggle-icon-open" />
        <CloseIcon className="nav-toggle-icon nav-toggle-icon-close" />
      </label>

      <div className="nav-links">
        <div className="nav-dropdown" tabIndex={0}>
          <span className={`nav-dropdown-label${activeSection === 'tracking' ? ' active' : ''}`}>Tracking</span>
          <div className="nav-dropdown-menu">
            {TRACKING_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="nav-dropdown" tabIndex={0}>
          <span className={`nav-dropdown-label${activeSection === 'guides' ? ' active' : ''}`}>Guides</span>
          <div className="nav-dropdown-menu">
            {guides.map((g) => (
              <Link key={g.id} href={`/guides/${g.slug}`}>
                {g.title}
              </Link>
            ))}
          </div>
        </div>
        <div className="nav-dropdown" tabIndex={0}>
          <span className={`nav-dropdown-label${activeSection === 'data' ? ' active' : ''}`}>Data</span>
          <div className="nav-dropdown-menu wide">
            {DATA_CATEGORIES.map((c) => (
              <div key={c.value} className="nav-dropdown-group">
                <h4>{c.label}</h4>
                {datasetsByCategory[c.value].map((d) => (
                  <Link key={d.id} href={`/datasets/${d.slug}`}>
                    {d.title}
                  </Link>
                ))}
              </div>
            ))}
            <div className="nav-dropdown-group" style={{ borderLeft: '1px solid var(--nrc-border)', display: 'flex', alignItems: 'flex-end' }}>
              <Link href="/datasets" style={{ fontWeight: 600, color: 'var(--nrc-primary)' }}>
                View all data →
              </Link>
            </div>
          </div>
        </div>
        <div className="nav-dropdown" tabIndex={0}>
          <span className={`nav-dropdown-label${activeSection === 'publications' ? ' active' : ''}`}>Publications</span>
          <div className="nav-dropdown-menu wide">
            {PUBLICATION_CATEGORIES.map((c) => (
              <div key={c.value} className="nav-dropdown-group">
                <h4>{c.label}</h4>
                {publicationsByCategory[c.value].map((p) => (
                  <Link key={p.id} href={`/publications/${p.slug}`}>
                    {p.title}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="nav-dropdown" tabIndex={0}>
          <span className={`nav-dropdown-label${activeSection === 'events' ? ' active' : ''}`}>Events</span>
          <div className="nav-dropdown-menu">
            {events.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`}>
                {e.name}
              </Link>
            ))}
            {events.length === 0 && (
              <span style={{ padding: '8px 10px', fontSize: 14, color: 'var(--nrc-muted)' }}>No events scheduled</span>
            )}
          </div>
        </div>
      </div>
      <div className="nav-right">
        {isStaff && <Link href="/access-check">Access check</Link>}
        {isStaff && <Link href={payloadConfig.routes.admin}>Admin</Link>}
        {isStaff && <LogoutButton collection="staff" />}
        {!user && <Link href="/login">Log in</Link>}
        {!user && <Link href="/signup" className="btn">Sign up</Link>}
        {isReader && (
          <div className="nav-dropdown" tabIndex={0}>
            <span className="nav-avatar" aria-label="Account menu">
              {initials}
            </span>
            <div className="nav-dropdown-menu" style={{ left: 'auto', right: -12 }}>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/account">Account</Link>
              <div style={{ padding: '8px 10px' }}>
                <LogoutButton collection="users" />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
