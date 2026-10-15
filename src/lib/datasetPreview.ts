import type { Dataset } from '@/payload-types'
import { frontendContext } from './frontendContext'
import { comparisonBars, metricColumns } from './datasetExplore'
import { buildCountryNameLookup, resolveCountryColumns } from './countryLookup'

/** Premium-only record previews and coverage. Do not call raw data queries before authorization. */
export async function datasetPreview(dataset: Dataset) {
  const { payload, user, canReadData } = await frontendContext()
  if (!canReadData) return null
  const year = dataset.columns.find((c) => c.type === 'year')?.key || null
  const country = dataset.columns.find((c) => c.type === 'country')?.key || null
  const metric = metricColumns(dataset.columns)[0]
  const [result, sample, countries] = await Promise.all([
    payload.db.pool.query<{ first: string | null; last: string | null; countries: string }>(
      `select min(case when "values" ->> $2 ~ '^[0-9]{4}$' then "values" ->> $2 end) as first,
              max(case when "values" ->> $2 ~ '^[0-9]{4}$' then "values" ->> $2 end) as last,
              count(distinct nullif("values" ->> $3, '')) as countries
         from dataset_rows where dataset_id = $1`,
      [dataset.id, year, country],
    ),
    payload.find({
      collection: 'dataset-rows',
      where: { dataset: { equals: dataset.id } },
      sort: 'id',
      limit: 5,
      depth: 0,
      user,
      overrideAccess: false,
    }),
    payload.find({ collection: 'countries', limit: 1000, depth: 0, overrideAccess: true }),
  ])
  const values = resolveCountryColumns(
    dataset.columns,
    sample.docs.map((d) => d.values as Record<string, unknown>),
    buildCountryNameLookup(countries.docs),
  )
  const stats = result.rows[0]
  return {
    first: stats.first,
    last: stats.last,
    countries: Number(stats.countries),
    metric,
    bars: metric?.key ? comparisonBars(values, dataset.columns, metric.key, 5) : [],
  }
}
