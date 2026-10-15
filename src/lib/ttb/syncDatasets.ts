import type { Payload } from 'payload'

import { buildCountryLookup, normalize } from '@/lib/datasetImport'
import type { Dataset } from '@/payload-types'

import type { Flow } from './columns'
import { tradeNumber } from './numeric'
import { writeDatasetRows } from '../writeDatasetRows'

const DATASET_SLUG: Record<Flow, string> = { import: 'us-imports', export: 'us-exports' }

type ColumnKeys = { commodity: string; country: string; year: string; value: string }

/** Finds each semantic field's column key by type, rather than hardcoding label text — "Importing Country" and "Exporting Country" differ between the two datasets, but both are the one `type: 'country'` column. */
function resolveColumnKeys(dataset: Dataset): ColumnKeys | null {
  const byType = (t: string) => dataset.columns.find((c) => c.type === t)?.key
  const commodity = byType('text')
  const country = byType('country')
  const year = byType('year')
  const value = byType('number')
  if (!commodity || !country || !year || !value) return null
  return { commodity, country, year, value }
}

export type AnnualTotalRow = { commodity: string; country: string; value: number }

/**
 * Shapes raw (commodity, country, value) aggregates into dataset-rows
 * `values` objects, resolving each country name to nic360's canonical iso2
 * through the same lookup the generic CSV importer uses (falls back to the
 * raw name when it isn't a recognized country — same graceful-degradation
 * as datasetImport.ts's coerceValue).
 */
export function buildDatasetRowValues(
  rows: AnnualTotalRow[],
  year: number,
  keys: ColumnKeys,
  countryLookup: Map<string, string>,
): Record<string, unknown>[] {
  return rows.map((r) => ({
    [keys.commodity]: r.commodity,
    [keys.country]: countryLookup.get(normalize(r.country)) ?? r.country,
    [keys.year]: year,
    [keys.value]: Math.round(tradeNumber(r.value, 'dataset value')),
  }))
}

const BASIS_SQL: Record<Flow, { table: string; valueCol: string; where: string }> = {
  import: { table: 'trade.import_fact', valueCol: 'con_val_yr', where: 'true' },
  export: { table: 'trade.export_fact', valueCol: 'all_val_yr', where: 'dom_or_for = 1' },
}

/**
 * Recomputes one year's annual (commodity, country) totals for a flow from
 * the ttb trade facts, and replaces that year's rows in the matching
 * US Imports/US Exports Dataset. Uses the latest loaded month's `_yr`
 * (year-to-date) column — already cumulative, so this is the one query that
 * gives the right annual total without re-summing every month by hand, on
 * the same reporting basis as the rest of the report (imports: consumption
 * figures; exports: domestic only — see ttb-trade/README.md's "Reporting
 * conventions").
 */
export async function syncDatasetForYear(
  payload: Payload,
  flow: Flow,
  year: number,
): Promise<{ rowCount: number; skipped: string | null }> {
  const { docs } = await payload.find({
    collection: 'datasets',
    where: { slug: { equals: DATASET_SLUG[flow] } },
    limit: 1,
    overrideAccess: true,
  })
  const dataset = docs[0]
  if (!dataset) return { rowCount: 0, skipped: `no "${DATASET_SLUG[flow]}" dataset found` }

  const keys = resolveColumnKeys(dataset)
  if (!keys)
    return {
      rowCount: 0,
      skipped: `"${dataset.title}" is missing a text/country/year/number column`,
    }

  const basis = BASIS_SQL[flow]
  const { docs: countries } = await payload.find({
    collection: 'countries',
    limit: 1000,
    overrideAccess: true,
  })
  const countryLookup = buildCountryLookup(countries)
  const result = await writeDatasetRows(payload, {
    datasetId: dataset.id,
    replace: { yearKey: keys.year, year },
    skipEmpty: true,
    rows: async (client) => {
      const { rows } = await client.query<{ commodity: string; country: string; value: string }>(
        `with latest as (select max(mo) as mo from ${basis.table} where yr = $1 and ${basis.where})
     select h.description as commodity, c.name as country, sum(f.${basis.valueCol}) as value
       from ${basis.table} f
       join ref.hts h on h.hts = f.hts
       join ref.country c on c.cty_code = f.cty_code
       cross join latest
      where f.yr = $1 and ${basis.where} and f.mo = latest.mo
      group by h.description, c.name
     having sum(f.${basis.valueCol}) is not null and sum(f.${basis.valueCol}) != 0`,
        [year],
      )
      return buildDatasetRowValues(
        rows.map((r) => ({
          commodity: r.commodity,
          country: r.country,
          value: tradeNumber(r.value, 'annual value'),
        })),
        year,
        keys,
        countryLookup,
      )
    },
  })
  return {
    rowCount: result.inserted,
    skipped: result.skippedEmpty ? `no ${flow} facts loaded for ${year}` : null,
  }
}
