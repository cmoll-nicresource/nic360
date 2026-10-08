import Papa from 'papaparse'
import type { Payload } from 'payload'

import type { Country, Dataset } from '@/payload-types'

export type ParsedSpreadsheet = {
  headers: string[]
  rows: Record<string, string>[]
}

/** Only CSV is supported — see README for why (xlsx's npm package is stale/known-vulnerable). */
export function parseCsv(fileContents: string): ParsedSpreadsheet {
  const result = Papa.parse<Record<string, string>>(fileContents, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const headers = result.meta.fields ?? []
  return { headers, rows: result.data }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Best-effort header -> column key mapping, by comparing normalized header text to each column's label or key. */
export function suggestMapping(
  headers: string[],
  columns: Dataset['columns'],
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}
  for (const header of headers) {
    const normalizedHeader = normalize(header)
    const match = columns.find(
      (col) => normalize(col.label) === normalizedHeader || normalize(col.key ?? '') === normalizedHeader,
    )
    mapping[header] = match?.key ?? null
  }
  return mapping
}

type CountryLookup = Map<string, string> // normalized name/alias/iso -> iso2

function buildCountryLookup(countries: Country[]): CountryLookup {
  const lookup: CountryLookup = new Map()
  for (const c of countries) {
    lookup.set(normalize(c.name), c.iso2)
    lookup.set(normalize(c.iso2), c.iso2)
    lookup.set(normalize(c.iso3), c.iso2)
    for (const a of c.aliases ?? []) {
      lookup.set(normalize(a.alias), c.iso2)
    }
  }
  return lookup
}

function coerceValue(
  raw: string,
  type: Dataset['columns'][number]['type'],
  countryLookup: CountryLookup,
): { value: unknown; unmatchedCountry?: string } {
  const trimmed = raw?.trim() ?? ''
  if (trimmed === '') return { value: null }

  switch (type) {
    case 'number':
    case 'year': {
      const n = Number(trimmed.replace(/,/g, ''))
      return { value: Number.isNaN(n) ? trimmed : n }
    }
    case 'percent': {
      const n = Number(trimmed.replace(/[%,]/g, ''))
      return { value: Number.isNaN(n) ? trimmed : n }
    }
    case 'date': {
      const d = new Date(trimmed)
      return { value: Number.isNaN(d.getTime()) ? trimmed : d.toISOString() }
    }
    case 'country': {
      const iso2 = countryLookup.get(normalize(trimmed))
      return iso2 ? { value: iso2 } : { value: trimmed, unmatchedCountry: trimmed }
    }
    case 'text':
    case 'link':
    default:
      return { value: trimmed }
  }
}

export type CommitImportResult = {
  rowCount: number
  unmatchedCountries: string[]
}

export async function commitImport({
  payload,
  dataset,
  parsed,
  mapping,
  replace,
  fileId,
}: {
  payload: Payload
  dataset: Dataset
  parsed: ParsedSpreadsheet
  mapping: Record<string, string | null>
  replace: boolean
  fileId?: number
}): Promise<CommitImportResult> {
  const { docs: countries } = await payload.find({
    collection: 'countries',
    limit: 1000,
    overrideAccess: true,
  })
  const countryLookup = buildCountryLookup(countries)
  const columnsByKey = new Map(dataset.columns.map((c) => [c.key, c]))

  const unmatchedCountries = new Set<string>()
  const rowsToInsert: Record<string, unknown>[] = []

  for (const sourceRow of parsed.rows) {
    const values: Record<string, unknown> = {}
    for (const [header, columnKey] of Object.entries(mapping)) {
      if (!columnKey) continue
      const column = columnsByKey.get(columnKey)
      if (!column) continue
      const { value, unmatchedCountry } = coerceValue(sourceRow[header] ?? '', column.type, countryLookup)
      values[columnKey] = value
      if (unmatchedCountry) unmatchedCountries.add(unmatchedCountry)
    }
    rowsToInsert.push(values)
  }

  if (replace) {
    await payload.delete({
      collection: 'dataset-rows',
      where: { dataset: { equals: dataset.id } },
      overrideAccess: true,
    })
  }

  // A production-scale import (thousands of rows) should bulk-insert directly
  // through the database adapter; the Local API loop below is simple and fine
  // at prototype/sample-file scale.
  for (const values of rowsToInsert) {
    await payload.create({
      collection: 'dataset-rows',
      data: { dataset: dataset.id, values },
      overrideAccess: true,
    })
  }

  await payload.update({
    collection: 'datasets',
    id: dataset.id,
    data: {
      lastImport: {
        file: fileId,
        mapping,
        importedAt: new Date().toISOString(),
        rowCount: rowsToInsert.length,
      },
    },
    overrideAccess: true,
  })

  return { rowCount: rowsToInsert.length, unmatchedCountries: [...unmatchedCountries] }
}
