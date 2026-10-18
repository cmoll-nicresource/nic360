import { currentEditions } from '@/lib/currentEditions'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { NoSubscriptionNotice } from '@/components/NoSubscriptionNotice'
import {
  AccessPanel,
  EventCard,
  IssueCard,
  NewsRow,
  SectionHeading,
} from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { formatDate } from '@/lib/formatDate'
import { StatusBadge } from '@/components/StatusBadge'
import { billStatusPill } from '@/lib/statusPill'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your briefing' }

export default async function DashboardPage() {
  const { payload, user, plan, canRead, canReadData } = await frontendContext()
  if (user?.collection !== 'users')
    return (
      <>
        <SiteNav />
        <div className="page-wide">
          <h1>Your industry briefing</h1>
          <AccessPanel title="Your daily industry briefing." />
        </div>
      </>
    )
  if (!canRead)
    return (
      <>
        <SiteNav />
        <div className="page-wide">
          <h1>Welcome, {user.firstName}</h1>
          <NoSubscriptionNotice payload={payload} />
        </div>
      </>
    )
  const published = { _status: { equals: 'published' as const } }
  const [news, issues, bills, datasets, events] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: published,
      sort: '-sourceDate',
      limit: 5,
      depth: 1,
      user,
      overrideAccess: false,
    }),
    currentEditions(),
    payload.find({
      collection: 'bills',
      where: published,
      sort: '-billDate',
      limit: 3,
      depth: 1,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'datasets',
      sort: '-lastImport.importedAt',
      limit: 3,
      depth: 0,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'events',
      where: { and: [published, { endDate: { greater_than_equal: new Date().toISOString() } }] },
      sort: 'startsAt',
      limit: 1,
      depth: 1,
      user,
      overrideAccess: false,
    }),
  ])
  const currentIssues = issues.issues
  const executive =
    currentIssues.find((issue) =>
      /executive|daily.*summary/i.test(
        typeof issue.publication === 'object' ? issue.publication.title : '',
      ),
    ) || currentIssues[0]
  const trade = currentIssues.find(
    (issue) =>
      typeof issue.publication === 'object' &&
      issue.publication.generator === 'monthly-trade-barometer',
  )
  const rest = currentIssues.filter((issue) => issue.id !== executive?.id).slice(0, 3)
  return (
    <>
      <SiteNav />
      <div className="page-wide edition-dashboard">
        <header className="edition-welcome">
          <div>
            <p className="edition-eyebrow">
              YOUR INDUSTRY BRIEFING / {formatDate(new Date().toISOString())}
            </p>
            <h1>Good to see you, {user.firstName}.</h1>
            <p>The latest reporting, policy developments, and intelligence in one place.</p>
          </div>
          <Link href="/account" className="edition-subscription">
            {plan === 'premium' ? 'Premium' : 'Base'} subscriber <span>Manage your preferences ↗</span>
          </Link>
        </header>
        <nav className="edition-shortcuts" aria-label="Explore intelligence">
          {[
            ['/articles', 'News'],
            ['/bills', 'Legislation'],
            ['/trademarks', 'Trademarks'],
            ['/datasets', 'Data'],
            ['/publications', 'Publications'],
            ['/guides', 'Guides'],
            ['/events', 'Events'],
          ].map(([href, label]) => (
            <Link key={href} href={href}>
              {label} ↗
            </Link>
          ))}
        </nav>
        <div className="edition-briefing-grid">
          <section>
            <SectionHeading
              eyebrow="START HERE"
              title="Your latest briefing"
              href="/publications"
            />
            {executive ? (
              <IssueCard issue={executive} />
            ) : (
              <div className="edition-empty">Your latest published briefings will appear here.</div>
            )}
          </section>
          <section className="edition-policy-panel">
            <SectionHeading eyebrow="POLICY WATCH" title="Latest legislation" href="/bills" />
            {bills.docs.length ? (
              bills.docs.map((bill) => (
                <Link href={`/bills/${bill.id}`} className="edition-policy-row" key={bill.id}>
                  <span className="edition-meta">
                    {bill.billNumber} · {formatDate(bill.billDate)}
                  </span>
                  <h3>{bill.title}</h3>
                  <StatusBadge status={billStatusPill(bill)} />
                </Link>
              ))
            ) : (
              <p className="muted">No published legislation yet.</p>
            )}
          </section>
        </div>
        <div className="edition-content-grid">
          <section>
            <SectionHeading eyebrow="THE NEWS DESK" title="Across the industry" href="/articles" />
            {news.docs.map((article) => (
              <NewsRow key={article.id} article={article} summary />
            ))}
          </section>
          <aside>
            <SectionHeading
              eyebrow="MARKETS & TRADE"
              title="New in intelligence"
              href="/datasets"
            />
            {trade && <IssueCard issue={trade} />}
            {datasets.docs.map((dataset) => (
              <Link href={`/datasets/${dataset.slug}`} className="edition-update" key={dataset.id}>
                <span className="edition-eyebrow">{dataset.category}</span>
                <h3>{dataset.title}</h3>
                <p className="edition-meta">
                  {dataset.lastImport?.importedAt
                    ? `Updated ${formatDate(dataset.lastImport.importedAt)}`
                    : 'Explore dataset'}
                  {!canReadData && ' · Premium'}
                </p>
              </Link>
            ))}
            {events.docs[0] && (
              <div className="edition-aside-event">
                <SectionHeading title="Next on the calendar" href="/events" />
                <EventCard event={events.docs[0]} />
              </div>
            )}
          </aside>
        </div>
        {!!rest.length && (
          <section className="edition-section">
            <SectionHeading
              eyebrow="THE READING ROOM"
              title="Latest editions"
              href="/publications"
            />
            <div className="edition-issue-grid">
              {rest.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
