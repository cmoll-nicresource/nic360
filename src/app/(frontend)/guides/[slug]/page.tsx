import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { AccessPanel, GuideCover } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { formatDate } from '@/lib/formatDate'
export const dynamic = 'force-dynamic'
export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { payload, user, canRead, plan, isStaff } = await frontendContext()
  if (!canRead)
    return (
      <>
        <SiteNav />
        <div className="page-wide">
          <h1>Reference guides</h1>
          <AccessPanel title="Your reference library awaits." premium />
        </div>
      </>
    )
  const { docs } = await payload.find({
    collection: 'guides',
    where: {
      and: [
        { slug: { equals: slug } },
        { _status: { equals: 'published' } },
        ...(!isStaff && plan !== 'premium' ? [{ requiresPremium: { equals: false } }] : []),
      ],
    },
    limit: 1,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const guide = docs[0]
  if (!guide) notFound()
  const file = typeof guide.file === 'object' ? guide.file : null
  const size = file?.filesize ? `${(file.filesize / 1024 / 1024).toFixed(1)} MB` : null
  return (
    <>
      <SiteNav />
      <div className="page-wide">
        <div className="breadcrumbs">
          <Link href="/guides">Guides</Link>
          <span>/</span>
          <span>{guide.title}</span>
        </div>
        <div className="edition-guide-detail">
          <GuideCover guide={guide} />
          <div>
            <p className="edition-eyebrow">
              NICOTINE360 / {guide.requiresPremium ? 'PREMIUM REFERENCE' : 'SUBSCRIBER REFERENCE'}
            </p>
            <h1>{guide.title}</h1>
            <p className="edition-deck">{guide.description}</p>
            <dl className="edition-facts">
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(guide.updatedAt)}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>PDF{size ? ` · ${size}` : ''}</dd>
              </div>
            </dl>
            {file?.url ? (
              <a className="btn" href={file.url} target="_blank" rel="noreferrer">
                Download guide{size ? ` (${size})` : ''} ↓
              </a>
            ) : (
              <p className="muted">
                This guide’s download is being updated. Please check back soon.
              </p>
            )}
            <p className="edition-download-note">
              For questions about this reference,{' '}
              <a href="mailto:membership@nicotine360.org">contact our team</a>.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
