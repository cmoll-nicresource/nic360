import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { DatasetGrid } from '@/components/DatasetGrid'
import { AccessPanel } from '@/components/frontend/Editorial'
import { frontendContext } from '@/lib/frontendContext'
import { datasetPreview } from '@/lib/datasetPreview'
import { formatDate } from '@/lib/formatDate'
export const dynamic = 'force-dynamic'
export default async function DatasetViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { payload, canReadData } = await frontendContext()
  const { docs } = await payload.find({
    collection: 'datasets',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: false,
  })
  const dataset = docs[0]
  if (!dataset) notFound()
  const preview = await datasetPreview(dataset)
  return (
    <>
      <SiteNav />
      <div className="page-wide">
        <div className="breadcrumbs">
          <Link href="/datasets">Data</Link>
          <span>/</span>
          <span>{dataset.title}</span>
        </div>
        <header className="edition-dataset-heading">
          <p className="edition-eyebrow">{dataset.category} / DATA EXPLORER</p>
          <h1>{dataset.title}</h1>
          <p className="edition-deck">{dataset.description}</p>
          <div className="edition-data-coverage">
            {preview?.first && (
              <span>
                Data coverage:{' '}
                {preview.first === preview.last
                  ? preview.first
                  : `${preview.first}–${preview.last}`}
              </span>
            )}
            {!!preview?.countries && <span>{preview.countries} countries</span>}
            {dataset.lastImport?.importedAt && (
              <span>Dataset updated {formatDate(dataset.lastImport.importedAt)}</span>
            )}
          </div>
        </header>
        {canReadData ? (
          <DatasetGrid datasetId={String(dataset.id)} />
        ) : (
          <AccessPanel
            premium
            title="Explore the numbers behind the story."
            description="Charts, complete tables, and CSV and Excel downloads are available with a Premium subscription."
          />
        )}
      </div>
    </>
  )
}
