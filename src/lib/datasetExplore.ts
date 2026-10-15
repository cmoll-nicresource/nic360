export type ExploreColumn = { key?: string | null; label: string; type: string }
export type DataRecord = Record<string, unknown>

export function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean')
    return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const cleaned =
    typeof value === 'string' ? value.trim().replace(/,/g, '').replace(/%$/, '') : value
  if (cleaned === '') return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

export function metricColumns(columns: ExploreColumn[]) {
  return columns.filter((c) => c.key && (c.type === 'number' || c.type === 'percent'))
}

/** Compare individual records. Never add percentages, duplicate years or distinct units together. */
export function comparisonBars(
  rows: DataRecord[],
  columns: ExploreColumn[],
  metric: string,
  limit = 12,
) {
  const dimensions = columns.filter(
    (c) => c.key && c.key !== metric && !['number', 'percent', 'link'].includes(c.type),
  )
  return rows
    .map((row, index) => ({
      label:
        dimensions
          .map((c) => String(row[c.key!] ?? ''))
          .filter(Boolean)
          .join(' · ') || `Record ${index + 1}`,
      value: numericValue(row[metric]),
      index,
    }))
    .filter((bar): bar is { label: string; value: number; index: number } => bar.value !== null)
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .slice(0, limit)
}

export function filterDataRows(
  rows: DataRecord[],
  columns: ExploreColumn[],
  country: string,
  year: string,
  query: string,
) {
  const countryKey = columns.find((c) => c.type === 'country')?.key
  const yearKey = columns.find((c) => c.type === 'year')?.key
  const term = query.trim().toLocaleLowerCase()
  return rows.filter(
    (row) =>
      (!country || !countryKey || String(row[countryKey]) === country) &&
      (!year || !yearKey || String(row[yearKey]) === year) &&
      (!term ||
        Object.values(row).some((value) =>
          String(value ?? '')
            .toLocaleLowerCase()
            .includes(term),
        )),
  )
}
