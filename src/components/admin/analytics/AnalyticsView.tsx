import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { Payload, PayloadRequest } from 'payload'
import React from 'react'

import { staffHasRole } from '@/access/staffRoles'
import { searchAdStats, summarizeAdStats } from '@/lib/adAnalytics'
import { getKnownPaths, visitorLabel } from '@/lib/analytics'
import { analyticsRange, getTrafficTrends, getRegistrationTrends, publicationTrends, type AnalyticsRange } from '@/lib/analyticsTrends'
import { SECTIONS } from '@/lib/pageSections'
import { searchPublicationIssueStats, summarizePublicationStats } from '@/lib/publicationAnalytics'
import { AdminHistoryTable } from './AdminHistoryTable'
import { UserSearchPicker } from './UserSearchPicker'
import { TrendChart } from './TrendChart'
import { RankingChart } from './RankingChart'

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
  let range: AnalyticsRange
  try { range = analyticsRange(firstParam(sp.dateFrom), firstParam(sp.dateTo), firstParam(sp.grain)) }
  catch { return <Gutter><h1>Analytics</h1><p role="alert">Choose valid dates in order, covering no more than 366 days.</p><Link href={`/admin/analytics?tab=${tab}`}>Reset dates</Link></Gutter> }
  const rangeQuery = new URLSearchParams({dateFrom:range.from,dateTo:range.to,grain:range.grain}).toString()
  const context = {payload,user:user ?? null,range}

  return (
    <Gutter className="nic-analytics">
      <h1>Analytics</h1>
      <p className="nic-analytics__muted">
        First-party user traffic — no third-party analytics, and staff visits aren&apos;t tracked.
      </p>

      <div className="nic-analytics__tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/analytics?tab=${t.key}&${rangeQuery}`}
            className={`nic-analytics__tab ${tab === t.key ? 'nic-analytics__tab--active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab !== 'ads' && <form method="GET" className="nic-analytics__picker nic-analytics__range">
        <input type="hidden" name="tab" value={tab}/>
        {['userId','path','section','publicationId','keyword','eventId'].map(key=>firstParam(sp[key])?<input key={key} type="hidden" name={key} value={firstParam(sp[key])}/>:null)}
        <label>From<input type="date" name="dateFrom" defaultValue={range.from} required/></label>
        <label>Through<input type="date" name="dateTo" defaultValue={range.to} required/></label>
        <label>Group by<select name="grain" defaultValue={range.grain}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
        <button type="submit">Update charts</button>
        <p className="nic-analytics__muted">Traffic and registration dates use Eastern time. Publications use the saved issue date. Weeks start Monday; edge periods may be partial.</p>
      </form>}

      {tab === 'overview' && <OverviewTab {...context} />}
      {tab === 'users' && <UsersTab {...context} userId={firstParam(sp.userId)} />}
      {tab === 'pages' && <PagesTab {...context} path={firstParam(sp.path)} />}
      {tab === 'sections' && <SectionsTab {...context} section={firstParam(sp.section)} />}
      {tab === 'publications' && (
        <PublicationsTab
          payload={payload}
          range={range}
          publicationId={firstParam(sp.publicationId)}
          dateFrom={range.from}
          dateTo={range.to}
          keyword={firstParam(sp.keyword)}
        />
      )}
      {tab === 'ads' && <AdsTab payload={payload} publicationId={firstParam(sp.publicationId)} />}
      {tab === 'events' && <EventsTab {...context} eventId={firstParam(sp.eventId)} />}
    </Gutter>
  )
}

async function EventsTab({ payload, user, range, eventId }: ViewContext & {eventId?:string}) {
  const options = { user, overrideAccess: false as const }
  const events = await payload.find({ collection: 'events', sort: '-startsAt', depth: 0, limit: 24, draft: true, ...options })
  const rows = await Promise.all(events.docs.map(async event => {
    const [active, virtual] = await Promise.all([
      payload.count({ collection: 'event-registrations', where: { and: [{ event: { equals: event.id } }, { status: { equals: 'active' } }] }, ...options }),
      payload.count({ collection: 'event-registrations', where: { and: [{ event: { equals: event.id } }, { status: { equals: 'active' } }, { attendance: { equals: 'virtual' } }] }, ...options }),
    ])
    return { event, active: active.totalDocs, virtual: virtual.totalDocs }
  }))
  const selectedId = eventId && /^\d+$/.test(eventId) && Number.isSafeInteger(Number(eventId)) && Number(eventId)>0 ? Number(eventId) : undefined
  const points = await getRegistrationTrends(payload,user,range,selectedId)
  return <><form method="GET" className="nic-analytics__picker"><RangeFields range={range}/><input type="hidden" name="tab" value="events"/><label>Event<select name="eventId" defaultValue={selectedId??''}><option value="">All events</option>{events.docs.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}</select></label><button type="submit">Show registrations</button></form>
    <TrendChart title="Event registrations over time" description="Currently active tickets, grouped by their original registration date. Pending and cancelled tickets are excluded; this is not a historical attendance or payment ledger." points={points} labels={['In person','Virtual']} grain={range.grain}/>
    <section className="nic-analytics__card">
    <h2>Event attendance</h2>
    <p>Current all-time totals, excluding pending and cancelled tickets. Open an event for attendance reports and livestream engagement.</p>
    <div className="nic-workspace__table-scroll"><table><thead><tr><th>Event</th><th>Active attendees</th><th>In person</th><th>Virtual</th></tr></thead><tbody>
      {rows.map(({ event, active, virtual }) => <tr key={event.id}><td><Link href={`/admin/events/${event.id}/manage`}>{event.name}</Link></td><td>{active}</td><td>{active - virtual}</td><td>{virtual}</td></tr>)}
    </tbody></table></div>
    {!rows.length && <p>No events yet.</p>}
    {events.hasNextPage && <p>Showing the latest 24 of {events.totalDocs} events.</p>}
    <Link href="/admin/events">Browse all events</Link>
  </section></>
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

type ViewContext = { payload:Payload; user:PayloadRequest['user']; range:AnalyticsRange }

function RangeFields({range}:{range:AnalyticsRange}) {
  return <><input type="hidden" name="dateFrom" value={range.from}/><input type="hidden" name="dateTo" value={range.to}/><input type="hidden" name="grain" value={range.grain}/></>
}

function TrafficPanel({report,range,title='Site activity over time'}:{report:Awaited<ReturnType<typeof getTrafficTrends>>;range:AnalyticsRange;title?:string}) {
  const days=(Date.parse(range.to)-Date.parse(range.from))/86400000+1
  return <>
    <div className="nic-analytics__stat-row">
      {[['Page views',report.views.toLocaleString('en-US')],['Distinct signed-in users',report.visitors.toLocaleString('en-US')],['Average views per day',(report.views/days).toLocaleString('en-US',{maximumFractionDigits:1})]].map(([label,value])=><div key={label} className="nic-analytics__card nic-analytics__stat"><div className="nic-analytics__muted">{label} · selected dates</div><div className="nic-analytics__stat-value">{value}</div></div>)}
    </div>
    <TrendChart title={title} description="Page views include signed-out visits. Users are counted once per period when signed in; period user counts must not be added together to get a range total. Staff visits are excluded." points={report.points} labels={['Page views','Signed-in users']} grain={range.grain}/>
  </>
}

async function OverviewTab({payload,user,range}:ViewContext) {
  const report=await getTrafficTrends(payload,user,range)
  const query=new URLSearchParams({dateFrom:range.from,dateTo:range.to,grain:range.grain}).toString()
  return <><TrafficPanel report={report} range={range}/><div className="nic-analytics__grid">
    <RankingChart title="Views by section" rows={report.sections.map(row=>({label:SECTIONS.find(section=>section.key===row.key)?.label??row.key,count:row.count,href:'/admin/analytics?tab=sections&section='+row.key+'&'+query}))}/>
    <RankingChart title="Most visited pages" rows={report.paths.map(row=>({label:row.path,count:row.count,href:'/admin/analytics?tab=pages&path='+encodeURIComponent(row.path)+'&'+query}))}/>
    <RankingChart title="Most active signed-in users" rows={report.users.map(row=>({label:visitorLabel(row.visitor),count:row.count,href:'/admin/analytics?tab=users&userId='+row.visitor.id+'&'+query}))}/>
  </div></>
}

function RecentHistory({report,showVisitor=true,showPath=true}:{report:Awaited<ReturnType<typeof getTrafficTrends>>;showVisitor?:boolean;showPath?:boolean}) {
  return <div className="nic-analytics__card"><h3>Recent visits in this date range</h3><p className="nic-analytics__muted">Showing {report.history.length.toLocaleString('en-US')} of {report.views.toLocaleString('en-US')} visits; the table shows at most 1,000. Charts include every matching visit.</p><AdminHistoryTable entries={report.history} showVisitor={showVisitor} showPath={showPath}/></div>
}

async function UsersTab({payload,user,range,userId}:ViewContext & {userId?:string}) {
  const selectedId=userId && /^\d+$/.test(userId)&&Number.isSafeInteger(Number(userId))&&Number(userId)>0?Number(userId):undefined
  const selected=selectedId ? await payload.findByID({collection:'users',id:selectedId,depth:0,overrideAccess:true}).catch(()=>null):null
  const rangeQuery=new URLSearchParams({dateFrom:range.from,dateTo:range.to,grain:range.grain}).toString()
  const report=await getTrafficTrends(payload,user,range,selected?{userId:selected.id}:{})
  return <><div className="nic-analytics__card"><h2>{selected?visitorLabel(selected):'User activity'}</h2><UserSearchPicker initialLabel={selected?visitorLabel(selected):undefined} rangeQuery={rangeQuery}/>{userId&&!selected&&<p role="alert">That user could not be found. Showing overall activity.</p>}</div><TrafficPanel report={report} range={range} title={selected?'Selected user activity over time':'User activity over time'}/>{selected&&<RecentHistory report={report} showVisitor={false}/>}</>
}

async function PagesTab({payload,user,range,path}:ViewContext & {path?:string}) {
  const [knownPaths,report]=await Promise.all([getKnownPaths(payload),getTrafficTrends(payload,user,range,path?{path}:{})])
  return <><form method="GET" className="nic-analytics__picker"><input type="hidden" name="tab" value="pages"/><RangeFields range={range}/><label>Page<select name="path" defaultValue={path??''}><option value="">All pages</option>{path&&!knownPaths.some(row=>row.path===path)&&<option value={path}>{path}</option>}{knownPaths.map(row=><option key={row.path} value={row.path}>{row.path}</option>)}</select></label><button type="submit">Show page activity</button></form><TrafficPanel report={report} range={range} title={path?'Selected page activity over time':'Page views over time'}/>{path&&<p className="nic-analytics__muted">Page: {path}</p>}{path?<RecentHistory report={report} showPath={false}/>:<RankingChart title="Most visited pages" rows={report.paths.map(row=>({label:row.path,count:row.count}))}/>}</>
}

async function SectionsTab({payload,user,range,section}:ViewContext & {section?:string}) {
  const known=SECTIONS.find(row=>row.key===section)
  const report=await getTrafficTrends(payload,user,range,known?{section:known.key}:{})
  return <><form method="GET" className="nic-analytics__picker"><input type="hidden" name="tab" value="sections"/><RangeFields range={range}/><label>Section<select name="section" defaultValue={known?.key??''}><option value="">All sections</option>{SECTIONS.map(row=><option key={row.key} value={row.key}>{row.label}</option>)}</select></label><button type="submit">Show section activity</button></form><TrafficPanel report={report} range={range} title={known?known.label+' activity over time':'Section activity over time'}/>{known?<RecentHistory report={report}/>:<RankingChart title="Views by section" rows={report.sections.map(row=>({label:SECTIONS.find(section=>section.key===row.key)?.label??row.key,count:row.count}))}/>}</>
}

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`
}

async function PublicationsTab({
  payload,
  range,
  publicationId,
  dateFrom,
  dateTo,
  keyword,
}: {
  payload: Payload
  range: AnalyticsRange
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
  const trends = publicationTrends(rows,range)

  return (
    <div className="nic-analytics__card">
      <p className="nic-analytics__muted">
        Clicks and opens per issue, plus totals and averages across whatever this search matches — e.g. pick
        &ldquo;Daily Executive Summary&rdquo; to see its last several sends at a glance, instead of hunting through
        campaign names.
      </p>
      <form method="GET" className="nic-analytics__picker" style={{ flexWrap: 'wrap' }}>
        <input type="hidden" name="tab" value="publications" />
        <input type="hidden" name="grain" value={range.grain}/>
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
          <TrendChart title="Publication engagement by issue date" description="Cumulative recipients, opens and clicks for sent issues, grouped by issue date—not when each open or click occurred. Historical and current-provider tracking may differ." points={trends.counts} labels={['Recipients','Opens','Clicks']} grain={range.grain}/>
          <TrendChart title="Publication engagement rates" description="Opens and clicks divided by total recipients in each issue-date period, weighted by audience size. Periods without recipients have no rate. Automated email opens can affect reported engagement." points={trends.rates} labels={['Open rate','Click rate']} grain={range.grain} percent/>
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
            <div className="nic-workspace__table-scroll"><table className="nic-analytics__table">
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
            </table></div>
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
      <h2>Advertising · all-time campaign totals</h2>
      <p className="nic-analytics__muted">
        &ldquo;Impressions&rdquo; counts issue sends this ad was placed in, not user-level opens — Mailchimp
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
      <RankingChart title="Top ads by clicks" rows={rows.slice().sort((a,b)=>b.clicks-a.clicks).slice(0,15).map(row=>({label:`${row.advertiser} · ${row.publicationTitle}`,count:row.clicks}))}/>
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
