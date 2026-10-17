import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { AccessPanel } from '@/components/frontend/Editorial'
import { LegislationNav } from '@/components/frontend/LegislationNav'
import { frontendContext } from '@/lib/frontendContext'
import { stateNetITracUrl } from '@/lib/stateNetITrac'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'StateNet iTrac | Legislation',
  description: 'Access the StateNet iTrac legislative portal through Nicotine360.',
}

export default async function StateNetITracPage() {
  const { canRead } = await frontendContext()
  const portalUrl = canRead ? stateNetITracUrl() : null
  return (
    <>
      <SiteNav />
      <header className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="edition-eyebrow">LEGISLATION</p>
            <h1>StateNet iTrac</h1>
            <p>Explore the StateNet legislative portal within Nicotine360.</p>
          </div>
        </div>
      </header>
      <div className="page-wide">
        <LegislationNav active="itrac" />
        {!canRead ? (
          <AccessPanel title="Legislative intelligence for your team."
            description="Sign in with a Base or Premium subscription to access the StateNet iTrac portal." />
        ) : portalUrl ? (
          <section className="itrac-portal" aria-label="StateNet iTrac portal">
            <div className="itrac-portal-toolbar">
              <h2>Legislative portal</h2>
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="edition-text-link">
                Open portal in a new tab ↗
              </a>
            </div>
            <iframe src={portalUrl} title="StateNet iTrac legislative portal" loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </section>
        ) : (
          <div className="edition-empty">
            <h2>The legislative portal is currently unavailable.</h2>
            <p>You can continue exploring tracked legislation in the bill library.</p>
            <Link href="/bills" className="edition-text-link">Browse the bill library ↗</Link>
          </div>
        )}
      </div>
    </>
  )
}
