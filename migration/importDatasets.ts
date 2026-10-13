/**
 * Migrates real historical data into the 11 already-seeded Datasets that
 * have a matching old `data_collections` entry (of 14 old collections, 3 —
 * "Public policy updates", "USA Cigarette brands", "USA Product
 * Trademarks" — have zero rows and are skipped). All 14 are marked
 * status='Draft' in the old site, but that just meant "not promoted to a
 * public nav item" — the row data itself (68,316 rows total) is real,
 * substantial reference data, not abandoned test content. This is in
 * fact where the seed script's own sample-size comment ("e.g. 3,559")
 * came from.
 *
 * Reuses the real import pipeline (`commitImport` from
 * src/lib/datasetImport.ts — the same code the staff upload wizard calls)
 * rather than writing a parallel insert path, with `replace: true` so this
 * swaps out whatever sample/placeholder rows a dataset already has.
 *
 * The old and new column sets don't always match 1:1 (the old data often
 * has more columns than the new schema kept) — each mapping below picks
 * the best-fitting old column per new one and drops the rest. Two notable
 * imperfect fits: International Import Tariff's "CIF Value" (new, a $
 * number) comes from the old "Cost Insurance Freight (% of customs import
 * value)" (a percentage) for lack of a real $ column; USA State Tax's
 * "Year" is left unmapped entirely rather than stuffing the old "Current
 * Rate Since" full date into a Year column.
 *
 * Usage: npx tsx migration/importDatasets.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import zlib from 'zlib'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { commitImport, type ParsedSpreadsheet } from '../src/lib/datasetImport'

const DUMP_PATH = path.join(process.cwd(), 'old-db', 'truecms.sql.gz')

async function streamTable(tableName: string, onRow: (fields: string[]) => void): Promise<void> {
  const copyPrefix = `COPY public.${tableName} (`
  let inBlock = false
  const rl = readline.createInterface({
    input: fs.createReadStream(DUMP_PATH).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    if (!inBlock) {
      if (line.startsWith(copyPrefix)) inBlock = true
      continue
    }
    if (line === '\\.') break
    onRow(line.split('\t'))
  }
  rl.close()
}

const COLLECTION_MAP: Record<string, { slug: string; headerToKey: Record<string, string> }> = {
  '1': {
    slug: 'international-import-tariff',
    headerToKey: {
      Country: 'country',
      'Product Type': 'product',
      'Ad Valorem (% of customs import value)': 'tariff_rate',
      'Cost Insurance Freight (% of CIF import value)': 'cif_value',
    },
  },
  '2': {
    slug: 'international-tax-rates',
    headerToKey: { Country: 'country', 'Taxed At': 'tax_type', Tax: 'rate', Year: 'year' },
  },
  '3': {
    slug: 'usa-state-tax-on-cigarettes',
    headerToKey: { State: 'state', 'Rate (cents per pack of 20)': 'rate' },
  },
  '4': {
    slug: 'international-production-consumption-tobacco-leaf',
    headerToKey: {
      Country: 'country',
      Year: 'year',
      'Production DW (MT)': 'production_mt',
      'Consumption (MT)': 'consumption_mt',
    },
  },
  '5': {
    slug: 'cigarette-market-share-by-brand',
    headerToKey: { Brand: 'brand', Country: 'country', Year: 'year', 'Market Share (%)': 'market_share' },
  },
  '6': {
    slug: 'cigarette-market-share-by-company',
    headerToKey: { Company: 'company', Country: 'country', Year: 'year', 'Market Share (%)': 'market_share' },
  },
  '7': {
    slug: 'international-production-consumption-cigarettes',
    headerToKey: {
      Country: 'country',
      Year: 'year',
      'Total Production': 'production_bn_sticks',
      'Total Consumption': 'consumption_bn_sticks',
    },
  },
  '8': {
    slug: 'forecast-international-production-consumption-cigarettes',
    headerToKey: {
      Country: 'country',
      Year: 'year',
      Production: 'forecast_production_bn_sticks',
      'Total Consumption': 'forecast_consumption_bn_sticks',
    },
  },
  '9': {
    slug: 'international-smoking-demographics',
    headerToKey: {
      Country: 'country',
      Year: 'year',
      'Total Smoking Rate (%)': 'smoking_rate',
      'Male Smoking Rate (%)': 'male_rate',
      'Female Smoking Rate (%)': 'female_rate',
    },
  },
  '10': {
    slug: 'us-imports',
    headerToKey: { Commodity: 'commodity', Country: 'exporting_country', Year: 'year', 'General CIF Value': 'value_usd' },
  },
  '11': {
    slug: 'us-exports',
    headerToKey: { Commodity: 'commodity', Country: 'importing_country', Year: 'year', 'Value (US$)': 'value_usd' },
  },
}

async function main() {
  console.log('Reading old datasets (rows) table, grouped by data_collection_id...')
  const rowsByCollectionId = new Map<string, Record<string, string | null>[]>()
  await streamTable('datasets', (f) => {
    const [, collectionId, dataJson] = f
    if (!COLLECTION_MAP[collectionId]) return
    let data: Record<string, string | null>
    try {
      data = JSON.parse(dataJson)
    } catch {
      return
    }
    const list = rowsByCollectionId.get(collectionId) ?? []
    list.push(data)
    rowsByCollectionId.set(collectionId, list)
  })

  const payload = await getPayload({ config })

  for (const [collectionId, { slug, headerToKey }] of Object.entries(COLLECTION_MAP)) {
    const rawRows = rowsByCollectionId.get(collectionId) ?? []
    console.log(`\n[${collectionId}] ${slug}: ${rawRows.length} rows`)
    if (rawRows.length === 0) continue

    const { docs } = await payload.find({ collection: 'datasets', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true })
    const dataset = docs[0]
    if (!dataset) {
      console.error(`  no Dataset found for slug "${slug}" — skipping`)
      continue
    }

    const headers = Object.keys(headerToKey)
    const parsed: ParsedSpreadsheet = {
      headers,
      rows: rawRows.map((r) => Object.fromEntries(headers.map((h) => [h, r[h] ?? ''])) as Record<string, string>),
    }

    const result = await commitImport({ payload, dataset, parsed, mapping: headerToKey, replace: true })
    console.log(`  imported ${result.rowCount} rows${result.unmatchedCountries.length ? `, ${result.unmatchedCountries.length} unmatched countries (e.g. ${result.unmatchedCountries.slice(0, 5).join(', ')})` : ''}`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
