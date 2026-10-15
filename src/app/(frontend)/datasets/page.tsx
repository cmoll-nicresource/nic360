import { SiteNav } from '@/components/SiteNav'
import { DatasetCard } from '@/components/frontend/DatasetCard'
import { SectionHeading } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Data',
  description: 'Explore market, tax and trade intelligence.',
}
const categories = [
  {
    value: 'policy',
    title: 'Policy & taxation',
    description: 'Compare the rules and rates shaping the industry.',
  },
  {
    value: 'markets',
    title: 'Markets & consumption',
    description: 'Understand market share, production and demand.',
  },
  {
    value: 'trade',
    title: 'International trade',
    description: 'Follow imports, exports and the movement of goods.',
  },
]
export default async function DatasetsPage() {
  const { payload, canReadData } = await frontendContext()
  const { docs } = await payload.find({
    collection: 'datasets',
    limit: 100,
    sort: 'title',
    depth: 0,
    overrideAccess: false,
  })
  return (
    <>
      <SiteNav />
      <header className="header-band">
        <div className="header-band-inner">
          <div>
            <p className="edition-eyebrow">THE DATA DESK</p>
            <h1>Evidence behind the industry.</h1>
            <p>
              Explore market, tax and trade data. Compare records, filter by geography and year, and
              take the figures with you.
            </p>
          </div>
          <span className="header-band-meta">
            {docs.length} datasets ·{' '}
            {canReadData ? 'Your Premium access is active' : 'Premium intelligence'}
          </span>
        </div>
      </header>
      <div className="page-wide">
        <nav className="edition-shortcuts" aria-label="Data categories">
          {categories.map((c) => (
            <a key={c.value} href={`#${c.value}`}>
              {c.title} ↓
            </a>
          ))}
        </nav>
        {categories.map((category) => (
          <section key={category.value} id={category.value} className="edition-section">
            <SectionHeading eyebrow={category.value} title={category.title}>
              <p className="muted">{category.description}</p>
            </SectionHeading>
            <div className="edition-dataset-grid">
              {docs
                .filter((d) => d.category === category.value)
                .map((dataset) => (
                  <DatasetCard key={dataset.id} dataset={dataset} />
                ))}
            </div>
          </section>
        ))}
        {!docs.length && (
          <p className="muted">New datasets will appear here as they become available.</p>
        )}
      </div>
    </>
  )
}
