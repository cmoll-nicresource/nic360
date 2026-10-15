import Link from 'next/link'
import type { Dataset } from '@/payload-types'
import { datasetPreview } from '@/lib/datasetPreview'
import { formatDate } from '@/lib/formatDate'
import { DataBars } from './DataBars'

export async function DatasetCard({ dataset }: { dataset: Dataset }) {
  const preview = await datasetPreview(dataset)
  return (
    <Link href={`/datasets/${dataset.slug}`} className="edition-dataset-card">
      <div className="edition-dataset-top">
        <span className="edition-eyebrow">{dataset.category}</span>
        <span aria-hidden="true">↗</span>
      </div>
      <h3>{dataset.title}</h3>
      <p className="muted">{dataset.description}</p>
      {preview && (
        <>
          <div className="edition-data-coverage">
            {preview.first && (
              <span>
                {preview.first === preview.last
                  ? preview.first
                  : `${preview.first}–${preview.last}`}
              </span>
            )}
            {preview.countries > 0 && <span>{preview.countries} countries</span>}
          </div>
          {!!preview.bars.length && (
            <div className="edition-data-preview">
              <DataBars bars={preview.bars} percent={preview.metric?.type === 'percent'} compact />
              <p>
                {preview.metric?.label} · first {preview.bars.length} numeric records
              </p>
            </div>
          )}
        </>
      )}
      <div className="edition-dataset-bottom">
        <span>
          {dataset.lastImport?.importedAt
            ? `Updated ${formatDate(dataset.lastImport.importedAt)}`
            : 'Reference dataset'}
        </span>
        <span>{preview ? 'Explore data →' : 'Premium →'}</span>
      </div>
    </Link>
  )
}
