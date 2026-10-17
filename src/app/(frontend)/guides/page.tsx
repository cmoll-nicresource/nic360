import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { AccessPanel, GuideCover } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { formatDate } from '@/lib/formatDate'
import { EditorialPhoto } from '@/components/frontend/EditorialPhoto'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Guides',
  description: 'Essential references for tax, trade and regulation.',
}
export default async function GuidesPage() {
  const { payload, user, canRead, plan, isStaff } = await frontendContext()
  const guides = canRead
    ? await payload.find({
        collection: 'guides',
        limit: 100,
        sort: 'title',
        depth: 1,
        user,
        overrideAccess: false,
        where: {
          and: [
            { _status: { equals: 'published' } },
            ...(!isStaff && plan !== 'premium' ? [{ requiresPremium: { equals: false } }] : []),
          ],
        },
      })
    : null
  return (
    <>
      <SiteNav />
      <header className="header-band header-band--photographic">
        <div className="header-band-inner">
          <div>
            <p className="edition-eyebrow">THE REFERENCE SHELF</p>
            <h1>Guides</h1>
            <p>In-depth guides to the tax, trade and regulatory frameworks shaping your work.</p>
          </div>
          {guides && (
            <span className="header-band-meta">
              {guides.totalDocs} guides available with your access
            </span>
          )}
          <EditorialPhoto
            photo="field"
            className="editorial-header-photo"
            decorative
            eager
            sizes="(max-width: 700px) 100vw, 360px"
          />
        </div>
      </header>
      <div className="page-wide">
        {!canRead ? (
          <AccessPanel
            title="A reference library for your industry."
            description="Sign in to browse the guides included in your company’s subscription. Most guides require Premium."
            premium
          />
        ) : (
          <div className="edition-guide-grid">
            {guides?.docs.map((guide) => (
              <Link className="edition-guide-card" key={guide.id} href={`/guides/${guide.slug}`}>
                <GuideCover guide={guide} />
                <div>
                  <span className="edition-eyebrow">
                    {guide.requiresPremium ? 'Premium reference' : 'Member reference'}
                  </span>
                  <h2>{guide.title}</h2>
                  <p className="muted">{guide.description}</p>
                  <p className="edition-meta">Updated {formatDate(guide.updatedAt)}</p>
                  <span className="edition-text-link">Explore guide & download ↗</span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {canRead && !guides?.docs.length && (
          <div className="edition-empty">
            No guides are available with your current access.{' '}
            <a href="mailto:membership@nicotine360.org">Contact membership</a> to explore Premium.
          </div>
        )}
      </div>
    </>
  )
}
