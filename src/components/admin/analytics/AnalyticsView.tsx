import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { Payload, PayloadRequest } from 'payload'
import React from 'react'

import { staffHasRole } from '@/access/staffRoles'
import { searchAdStats, summarizeAdStats } from '@/lib/adAnalytics'
import {
  getKnownPaths,
  getOverviewStats,
  getPageHistory,
  getSectionHistory,
  getUserHistory,
  visitorLabel,
} from '@/lib/analytics'
import { SECTIONS } from '@/lib/pageSections'
import { searchPublicationIssueStats, summarizePublicationStats } from '@/lib/publicationAnalytics'
import { AdminHistoryTable } from './AdminHistoryTable'
import { UserSearchPicker } from './UserSearchPicker'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'By user' },
  { key: 'pages', label: 'By page' },
  { key: 'sections', label: 'By section' },
  { key: 'publications', label: 'Publications' },
  { key: 'events', label: 'Events' },
  { key: 'ads', label: 'Ads' },
] as const

type Tab = (typeof TABS)[number]['key']

type Params = Record<string, string | string[] | undefined>

/** Custom admin view at /admin/analytics (registered via admin.components.views in payload.config.ts). Gatekeeper+ only. */
export function AnalyticsView({
  payload,
  user,
  searchParams,
}: {
  payload: Payload
  user?: PayloadRequest['user']
  searchParams?: Params
}) {
  if (!staffHasRole(user ?? null, 'gatekeeper')) {
    return (
      <Gutter>
        <h1>Analytics</h1>
        <p>Gatekeeper sign-in required.</p>
      </Gutter>
    )
  }

  const sp = searchParams ?? {}
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'overview'

  return (
    <Gutter className="nic-analytics">
      <h1>Analytics</h1>
      <p className="nic-analytics__muted">
        First-party reader traffic — no third-party analytics, and staff visits aren&apos;t tracked.
      </p>

      <div className="nic-analytics__tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/analytics?tab=${t.key}`}
            className={`nic-analytics__tab ${tab === t.key ? 'nic-analytics__tab--active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab payload={payload} />}
      {tab === 'users' && <UsersTab payload={payload} userId={firstParam(sp.userId)} />}
      {tab === 'pages' && <PagesTab payload={payload} path={firstParam(sp.path)} />}
      {tab === 'sections' && <SectionsTab payload={payload} section={firstParam(sp.section)} />}
      {tab === 'publications' && (
        <PublicationsTab
          payload={payload}
          publicationId={firstParam(sp.publicationId)}
          dateFrom={firstParam(sp.dateFrom)}
          dateTo={firstParam(sp.dateTo)}
          keyword={firstParam(sp.keyword)}
        />
      )}
      {tab === 'ads' && <AdsTab payload={payload} publicationId={firstParam(sp.publicationId)} />}
      {tab === 'events' && <EventsTab payload={payload} user={user ?? null} />}
    </Gutter>
  )
}

async function EventsTab({ payload, user }: { payload: Payload; user: PayloadRequest['user'] }) {
  const options = { user, overrideAccess: false as const }
  const events = await payload.find({ collection: 'events', sort: '-startsAt', depth: 0, limit: 24, draft: true, ...options })
  const rows = await Promise.all(events.docs.map(async event => {
    const [active, virtual] = await Promise.all([
      payload.count({ collection: 'event-registrations', where: { and: [{ event: { equals: event.id } }, { status: { equals: 'active' } }] }, ...options }),
      payload.count({ collection: 'event-registrations', where: { and: [{ event: { equals: event.id } }, { status: { equals: 'active' } }, { attendance: { equals: 'virtual' } }] }, ...options }),
    ])
    return { event, active: active.totalDocs, virtual: virtual.totalDocs }
  }))
  return <section className="nic-analytics__card">
    <h2>Event attendance</h2>
    <p>Active registrations, excluding pending and cancelled tickets. Open an event for attendance reports and livestream engagement.</p>
    <div className="nic-workspace__table-scroll"><table><thead><tr><th>Event</th><th>Active attendees</th><th>In person</th><th>Virtual</th></tr></thead><tbody>
      {rows.map(({ event, active, virtual }) => <tr key={event.id}><td><Link href={`/admin/events/${event.id}/manage`}>{event.name}</Link></td><td>{active}</td><td>{active - virtual}</td><td>{virtual}</td></tr>)}
    </tbody></table></div>
    {!rows.length && <p>No events yet.</p>}
    {events.hasNextPage && <p>Showing the latest 24 of {events.totalDocs} events.</p>}
    <Link href="/admin/events">Browse all events</Link>
  </section>
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

async function OverviewTab({ payload }: { payload: Payload }) {
  const stats = await getOverviewStats(payload)

  return (
    <>
      <div className="nic-analytics__stat-row">
        <div className="nic-analytics__card nic-analytics__stat">
          <div className="nic-analytics__muted">Total page views (all time)</div>
          <div className="nic-analytics__stat-value">{stats.totalViews}</div>
        </div>
        <div className="nic-analytics__card nic-analytics__stat">
          <div className="nic-analytics__muted">Views in the last 30 days</div>
          <div className="nic-analytics__stat-value">{stats.recentViews}</div>
        </div>
        <div className="nic-analytics__card nic-analytics__stat">
          <div className="nic-analytics__muted">Unique signed-in visitors (30 days)</div>
          <div className="nic-analytics__stat-value">{stats.uniqueVisitors}</div>
        </div>
      </div>

      <div className="nic-analytics__grid">
        <div className="nic-analytics__card">
          <h3>Top sections (30 days)</h3>
          {stats.topSections.length === 0 && <p className="nic-analytics__muted">No data yet.</p>}
          {stats.topSections.map((s) => (
            <RankRow
              key={s.key}
              href={`/admin/analytics?tab=sections&section=${s.key}`}
              label={SECTIONS.find((x) => x.key === s.key)?.label ?? s.key}
              count={s.count}
            />
          ))}
        </div>
        <div className="nic-analytics__card">
          <h3>Top pages (30 days)</h3>
          {stats.topPaths.length === 0 && <p className="nic-analytics__muted">No data yet.</p>}
          {stats.topPaths.map((p) => (
            <RankRow key={p.path} href={`/admin/analytics?tab=pages&path=${encodeURIComponent(p.path)}`} label={p.path} count={p.count} />
          ))}
        </div>
        <div className="nic-analytics__card">
          <h3>Most active readers (30 days)</h3>
          {stats.topUsers.length === 0 && <p className="nic-analytics__muted">No data yet.</p>}
          {stats.topUsers.map((u) => (
            <RankRow
              key={u.visitor.id}
              href={`/admin/analytics?tab=users&userId=${u.visitor.id}`}
              label={visitorLabel(u.visitor)}
              count={u.count}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function RankRow({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link href={href} className="nic-analytics__rank-row">
      <span className="nic-analytics__rank-label">{label}</span>
      <span className="nic-analytics__pill">{count}</span>
    </Link>
  )
}

async function UsersTab({ payload, userId }: { payload: Payload; userId?: string }) {
  const selectedId = userId ? Number(userId) : undefined
  const selected = selectedId
    ? await payload
        .findByID({ collection: 'users', id: selectedId, depth: 0, overrideAccess: true })
        .catch(() => null)
    : null
  const history = selectedId ? await getUserHistory(payload, selectedId) : []

  return (
    <div className="nic-analytics__card">
      <UserSearchPicker initialLabel={selected ? visitorLabel(selected) : undefined} />

      {selectedId && !selected && <p className="nic-analytics__muted">That reader couldn&apos;t be found.</p>}
      {selected && (
        <>
          <h3>
            {visitorLabel(selected)}
            <span className="nic-analytics__muted"> — {history.length} page view(s)</span>
          </h3>
          <AdminHistoryTable entries={history} showVisitor={false} />
        </>
      )}
    </div>
  )
}

async function PagesTab({ payload, path }: { payload: Payload; path?: string }) {
  const knownPaths = await getKnownPaths(payload)
  const history = path ? await getPageHistory(payload, path) : []

  return (
    <div className="nic-analytics__card">
      <form method="GET" className="nic-analytics__picker">
        <input type="hidden" name="tab" value="pages" />
        <select name="path" defaultValue={path ?? ''}>
          <option value="" disabled>
            Choose a page…
          </option>
          {knownPaths.map((p) => (
            <option key={p.path} value={p.path}>
              {p.path} ({p.count})
            </option>
          ))}
        </select>
        <button type="submit">View visitors</button>
      </form>

      {path && (
        <>
          <h3>
            {path}
            <span className="nic-analytics__muted"> — {history.length} page view(s)</span>
          </h3>
          <AdminHistoryTable entries={history} showPath={false} />
        </>
      )}
    </div>
  )
}

async function SectionsTab({ payload, section }: { payload: Payload; section?: string }) {
  const known = SECTIONS.some((s) => s.key === section) ? (section as (typeof SECTIONS)[number]['key']) : undefined
  const history = known ? await getSectionHistory(payload, known) : []

  return (
    <div className="nic-analytics__card">
      <form method="GET" className="nic-analytics__picker">
        <input type="hidden" name="tab" value="sections" />
        <select name="section" defaultValue={known ?? ''}>
          <option value="" disabled>
            Choose a section…
          </option>
          {SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit">View history</button>
      </form>

      {known && (
        <>
          <h3>
            {SECTIONS.find((s) => s.key === known)?.label}
            <span className="nic-analytics__muted"> — {history.length} page view(s)</span>
          </h3>
          <AdminHistoryTable entries={history} />
        </>
      )}
    </div>
  )
}

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`
}

async function PublicationsTab({
  payload,
  publicationId,
  dateFrom,
  dateTo,
  keyword,
}: {
  payload: Payload
  publicationId?: string
  dateFrom?: string
  dateTo?: string
  keyword?: string
}) {
  const { docs: publications } = await payload.find({
    collection: 'publications',
    limit: 200,
    sort: 'title',
    depth: 0,
    overrideAccess: true,
  })

  const hasSearched = Boolean(publicationId || dateFrom || dateTo || keyword)
  const rows = hasSearched
    ? await searchPublicationIssueStats(payload, {
        publicationId: publicationId ? Number(publicationId) : undefined,
        dateFrom,
        dateTo,
        keyword,
      })
    : []
  const totals = summarizePublicationStats(rows)

  return (
    <div className="nic-analytics__card">
      <p className="nic-analytics__muted">
        Clicks and opens per issue, plus totals and averages across whatever this search matches — e.g. pick
        &ldquo;Daily Executive Summary&rdquo; to see its last several sends at a glance, instead of hunting through
        campaign names.
      </p>
      <form method="GET" className="nic-analytics__picker" style={{ flexWrap: 'wrap' }}>
        <input type="hidden" name="tab" value="publications" />
        <select name="publicationId" defaultValue={publicationId ?? ''}>
          <option value="">All publications</option>
          {publications.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <input type="search" name="keyword" defaultValue={keyword ?? ''} placeholder="Title contains…" />
        <input type="date" name="dateFrom" defaultValue={dateFrom ?? ''} aria-label="From" />
        <input type="date" name="dateTo" defaultValue={dateTo ?? ''} aria-label="To" />
        <button type="submit">Search</button>
      </form>

      {!hasSearched && <p className="nic-analytics__muted">Choose a publication, date range or title keyword to search issues.</p>}

      {hasSearched && (
        <>
          <div className="nic-analytics__stat-row" style={{ marginTop: 16 }}>
            <div className="nic-analytics__card nic-analytics__stat">
              <div className="nic-analytics__muted">Issues matched</div>
              <div className="nic-analytics__stat-value">{totals.count}</div>
            </div>
            <div className="nic-analytics__card nic-analytics__stat">
              <div className="nic-analytics__muted">Total recipients</div>
              <div className="nic-analytics__stat-value">{totals.totalRecipients}</div>
            </div>
            <div className="nic-analytics__card nic-analytics__stat">
              <div className="nic-analytics__muted">Total opens / clicks</div>
              <div className="nic-analytics__stat-value">
                {totals.totalOpens} / {totals.totalClicks}
              </div>
            </div>
            <div className="nic-analytics__card nic-analytics__stat">
              <div className="nic-analytics__muted">Average open rate / click rate</div>
              <div className="nic-analytics__stat-value">
                {pct(totals.avgOpenRate)} / {pct(totals.avgClickRate)}
              </div>
            </div>
          </div>

          {rows.length === 0 && <p className="nic-analytics__muted">No sent issues match this search.</p>}
          {rows.length > 0 && (
            <table className="nic-analytics__table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Publication</th>
                  <th>Date</th>
                  <th>Recipients</th>
                  <th>Opens</th>
                  <th>Clicks</th>
                  <th>Open rate</th>
                  <th>Click rate</th>
                  <th>Bounces</th>
                  <th>Complaints</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.publicationTitle}</td>
                    <td>{new Date(r.issueDate).toLocaleDateString()}</td>
                    <td>{r.recipientCount}</td>
                    <td>{r.opens}</td>
                    <td>{r.clicks}</td>
                    <td>{pct(r.openRate)}</td>
                    <td>{pct(r.clickRate)}</td>
                    <td>{r.bounces}</td>
                    <td>{r.complaints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

async function AdsTab({ payload, publicationId }: { payload: Payload; publicationId?: string }) {
  const { docs: publications } = await payload.find({
    collection: 'publications',
    limit: 200,
    sort: 'title',
    depth: 0,
    overrideAccess: true,
  })

  const rows = await searchAdStats(payload, { publicationId: publicationId ? Number(publicationId) : undefined })
  const totals = summarizeAdStats(rows)

  return (
    <div className="nic-analytics__card">
      <p className="nic-analytics__muted">
        &ldquo;Impressions&rdquo; counts issue sends this ad was placed in, not reader-level opens — Mailchimp
        doesn&rsquo;t give us a per-recipient delivery count the way SES does, so both providers are counted the
        same way here: once per send.
      </p>
      <form method="GET" className="nic-analytics__picker">
        <input type="hidden" name="tab" value="ads" />
        <select name="publicationId" defaultValue={publicationId ?? ''}>
          <option value="">All publications</option>
          {publications.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button type="submit">Filter</button>
      </form>

      <div className="nic-analytics__stat-row" style={{ marginTop: 16 }}>
        <div className="nic-analytics__card nic-analytics__stat">
          <div className="nic-analytics__muted">Ads matched</div>
          <div className="nic-analytics__stat-value">{totals.count}</div>
        </div>
        <div className="nic-analytics__card nic-analytics__stat">
          <div className="nic-analytics__muted">Total impressions</div>
          <div className="nic-analytics__stat-value">{totals.totalImpressions}</div>
        </div>
        <div className="nic-analytics__card nic-analytics__stat">
          <div className="nic-analytics__muted">Total clicks</div>
          <div className="nic-analytics__stat-value">{totals.totalClicks}</div>
        </div>
        <div className="nic-analytics__card nic-analytics__stat">
          <div className="nic-analytics__muted">Click-through rate</div>
          <div className="nic-analytics__stat-value">{pct(totals.avgCtr)}</div>
        </div>
      </div>

      {rows.length === 0 && <p className="nic-analytics__muted">No ads match this search.</p>}
      {rows.length > 0 && (
        <table className="nic-analytics__table">
          <thead>
            <tr>
              <th>Advertiser</th>
              <th>Publication</th>
              <th>Rank</th>
              <th>Campaign window</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <th>CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.advertiser}</td>
                <td>{r.publicationTitle}</td>
                <td>{r.rank}</td>
                <td>
                  {new Date(r.startDate).toLocaleDateString()} &ndash; {new Date(r.endDate).toLocaleDateString()}
                </td>
                <td>{r.impressions}</td>
                <td>{r.clicks}</td>
                <td>{pct(r.ctr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
