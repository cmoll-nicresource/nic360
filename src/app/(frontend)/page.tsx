import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { EventCard, NewsRow, SectionHeading } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { formatDate } from '@/lib/formatDate'
import { EditorialPhoto } from '@/components/frontend/EditorialPhoto'
export const dynamic = 'force-dynamic'
export default async function HomePage() {
  const { payload, user, isStaff } = await frontendContext()
  if (user?.collection === 'users') redirect('/dashboard')
  const published = { _status: { equals: 'published' as const } }
  const [news, bills, datasets, events, articlesCount, billsCount, trademarksCount, researchCount] =
    await Promise.all([
      payload.find({
        collection: 'articles',
        where: published,
        sort: '-sourceDate',
        limit: 4,
        depth: 1,
        user,
        overrideAccess: false,
      }),
      payload.find({
        collection: 'bills',
        where: published,
        sort: '-billDate',
        limit: 2,
        depth: 0,
        user,
        overrideAccess: false,
      }),
      payload.find({
        collection: 'datasets',
        sort: '-lastImport.importedAt',
        limit: 3,
        depth: 0,
        overrideAccess: false,
      }),
      payload.find({
        collection: 'events',
        where: { and: [published, { endDate: { greater_than_equal: new Date().toISOString() } }] },
        sort: 'startsAt',
        limit: 2,
        depth: 1,
        overrideAccess: false,
      }),
      payload.count({ collection: 'articles', where: published, overrideAccess: false }),
      payload.count({ collection: 'bills', where: published, overrideAccess: false }),
      payload.count({ collection: 'trademarks', where: published, overrideAccess: true }),
      payload.count({ collection: 'research', where: published, overrideAccess: false }),
    ])
  return (
    <>
      <SiteNav />
      <header className="edition-home-hero">
        <div className="edition-home-hero-inner">
          <div>
            <p className="edition-eyebrow">NICOTINE360 / INDUSTRY INTELLIGENCE</p>
            <h1>
              Clarity in a<br />
              changing industry.
            </h1>
            <p className="edition-hero-deck">
              The reporting, policy intelligence and market data you need to see what’s
              happening—and what comes next.
            </p>
            <div className="edition-actions">
              <Link href={isStaff ? '/admin' : '/signup'} className="btn btn-access">
                {isStaff ? 'Open staff workspace' : 'Get access'}
              </Link>
              <Link href="/articles" className="edition-hero-link">
                Explore the latest news ↗
              </Link>
            </div>
            <p className="edition-hero-note">
              Independent industry intelligence from the Nicotine Resource Consortium.
            </p>
          </div>
          <div className="edition-product-window">
            <div className="edition-product-brief">
              <p className="edition-eyebrow">ON THE NEWS DESK</p>
              {news.docs[0] ? (
                <Link href={`/articles/${news.docs[0].id}`}>
                  <span className="edition-meta">
                    {formatDate(news.docs[0].sourceDate || news.docs[0].createdAt)}
                  </span>
                  <h2>{news.docs[0].title}</h2>
                  <span className="edition-text-link">Explore the reporting ↗</span>
                </Link>
              ) : (
                <h2>Follow the stories shaping your market.</h2>
              )}
            </div>
            <div className="edition-product-bottom">
              <div>
                <p className="edition-eyebrow">POLICY WATCH</p>
                {bills.docs[0] ? (
                  <Link href={`/bills/${bills.docs[0].id}`}>
                    <span className="edition-meta">{bills.docs[0].billNumber}</span>
                    <h3>{bills.docs[0].title}</h3>
                  </Link>
                ) : (
                  <h3>Track legislation across markets.</h3>
                )}
              </div>
              <div>
                <p className="edition-eyebrow">THE DATA DESK</p>
                {datasets.docs[0] ? (
                  <Link href={`/datasets/${datasets.docs[0].slug}`}>
                    <h3>{datasets.docs[0].title}</h3>
                    <span className="edition-meta">{datasets.docs[0].lastImport?.importedAt
                      ? `Updated ${formatDate(datasets.docs[0].lastImport.importedAt)}`
                      : 'Charts · Tables · Downloads'}</span>
                  </Link>
                ) : (
                  <h3>Market, tax & trade data.</h3>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="edition-proof-strip">
        <div>
          {[
            [articlesCount.totalDocs, 'articles indexed'],
            [billsCount.totalDocs, 'bills tracked'],
            [trademarksCount.totalDocs, 'trademark filings'],
            [researchCount.totalDocs, 'research papers indexed'],
          ].map(([count, label]) => (
            <p key={label}>
              <strong>{Number(count).toLocaleString()}</strong>
              <span>{label}</span>
            </p>
          ))}
        </div>
      </div>
      <div className="page-wide">
        <div className="edition-content-grid edition-home-news">
          <section>
            <SectionHeading
              eyebrow="FROM THE NEWS DESK"
              title="The industry, in focus."
              href="/articles"
              action="All news"
            />
            {news.docs.map((article) => (
              <NewsRow article={article} key={article.id} />
            ))}
          </section>
          <aside className="edition-home-policy">
            <EditorialPhoto
              photo="capitol"
              className="editorial-policy-photo"
              decorative
              sizes="(max-width: 900px) 100vw, 400px"
            />
            <SectionHeading eyebrow="POLICY & REGULATION" title="On the agenda" href="/bills" />
            {bills.docs.map((bill) => (
              <Link href={`/bills/${bill.id}`} className="edition-policy-row" key={bill.id}>
                <span className="edition-meta">
                  {bill.billNumber} · {formatDate(bill.billDate)}
                </span>
                <h3>{bill.title}</h3>
              </Link>
            ))}
            <Link href="/trademarks" className="edition-text-link">
              Explore trademark intelligence ↗
            </Link>
          </aside>
        </div>
        <section className="edition-section">
          <SectionHeading
            eyebrow="RESEARCH & ANALYSIS"
            title="Go beyond the headline."
            href="/datasets"
            action="Explore all data"
          >
            <p className="muted">
              From market share to international trade, put the figures in context.
            </p>
          </SectionHeading>
          <EditorialPhoto
            photo="port"
            className="editorial-trade-panorama"
            sizes="(max-width: 1200px) 100vw, 1152px"
          />
          <div className="edition-home-data-grid">
            {datasets.docs.map((dataset) => (
              <Link
                href={`/datasets/${dataset.slug}`}
                className="edition-home-data"
                key={dataset.id}
              >
                <span className="edition-eyebrow">{dataset.category}</span>
                <h3>{dataset.title}</h3>
                <p>{dataset.description}</p>
                <span className="edition-text-link">Explore dataset ↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="edition-section">
          <SectionHeading eyebrow="DAILY · WEEKLY · MONTHLY" title="Publications"
            href="/publications" action="All publications">
            <p className="muted">Recurring briefings and reports, with the latest edition and past issues in one place.</p>
          </SectionHeading>
          <div className="edition-publication-topics">
            {[
              ['news', 'News & analysis', 'Industry news clippings and specialist reporting.'],
              ['legislation', 'Legislative reporting', 'Daily snapshots and weekly reports on legislative activity.'],
              ['trademarks', 'Trademark reports', 'Weekly filings and monthly trademark activity.'],
            ].map(([anchor, title, description]) => (
              <Link key={anchor} href={`/publications#${anchor}`}>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="edition-text-link">Explore editions ↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="edition-reference-band">
          <EditorialPhoto
            photo="barn"
            className="editorial-reference-photo"
            sizes="(max-width: 600px) 100vw, 420px"
          />
          <div>
            <p className="edition-eyebrow">REFERENCE GUIDES</p>
            <h2>Keep the essentials close.</h2>
            <p>
              In-depth references to the tax, trade and regulatory frameworks shaping your work.
              Browse each guide and download the resources you need.
            </p>
            <div className="edition-actions">
              <Link href="/guides" className="btn btn-secondary">
                Explore guides ↗
              </Link>
            </div>
          </div>
        </section>
        {!!events.docs.length && (
          <section className="edition-section">
            <SectionHeading
              eyebrow="CONVERSATIONS & CONNECTIONS"
              title="Meet the industry."
              href="/events"
              action="All events"
            />
            <div className="edition-event-grid">
              {events.docs.map((event) => (
                <EventCard event={event} key={event.id} />
              ))}
            </div>
          </section>
        )}
        <section className="edition-section edition-plans" id="membership">
          <SectionHeading
            eyebrow="COMPANY-WIDE INTELLIGENCE"
            title="The right access for your team."
          >
            <p className="muted">
              Use your work email. If your company subscribes, your access follows you.
            </p>
          </SectionHeading>
          <div className="edition-plan-grid">
            <div>
              <span className="edition-eyebrow">BASE</span>
              <h3>Stay informed.</h3>
              <p>
                News excerpts, legislative intelligence, trademark filings and the publication
                library.
              </p>
              <ul>
                <li>Daily and specialist briefings</li>
                <li>News, legislation & trademark archives</li>
                <li>Selected reference guides</li>
              </ul>
              <a href="mailto:membership@nicotine360.org" className="btn btn-secondary">
                Discuss Base access
              </a>
            </div>
            <div>
              <span className="edition-eyebrow">PREMIUM</span>
              <h3>See the whole picture.</h3>
              <p>Everything in Base, with the data and references to take your research further.</p>
              <ul>
                <li>Market, tax & trade datasets</li>
                <li>Interactive charts and complete tables</li>
                <li>CSV, Excel and Premium reference guides</li>
              </ul>
              <a href="mailto:membership@nicotine360.org" className="btn btn-accent">
                Discuss Premium access
              </a>
            </div>
          </div>
          <p className="edition-meta">Events are open to everyone and ticketed separately.</p>
        </section>
      </div>
    </>
  )
}
