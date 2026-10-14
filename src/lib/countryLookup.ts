type CountryLike = { iso2: string; name: string }
type ColumnLike = { key?: string | null; type: string }

export function buildCountryNameLookup(countries: CountryLike[]): Map<string, string> {
  return new Map(countries.map((c) => [c.iso2, c.name]))
}

/**
 * Dataset rows store a 'country' column as a bare ISO2 code (see
 * datasetImport.ts — it's resolved against the Countries taxonomy on import,
 * but only the code is kept, for a stable, compact join key). Readers
 * shouldn't see that code, though: this resolves each 'country' column back
 * to the real country name from the taxonomy for display/export, falling
 * back to whatever's stored when it isn't a recognized code (an unmatched
 * import value that was kept as free text rather than dropped).
 */
export function resolveCountryColumns(
  columns: ColumnLike[],
  rows: Record<string, unknown>[],
  nameByIso2: Map<string, string>,
): Record<string, unknown>[] {
  const countryKeys = columns.filter((c) => c.type === 'country' && c.key).map((c) => c.key as string)
  if (countryKeys.length === 0) return rows

  return rows.map((row) => {
    const next = { ...row }
    for (const key of countryKeys) {
      const value = next[key]
      if (typeof value === 'string') {
        next[key] = nameByIso2.get(value) ?? value
      }
    }
    return next
  })
}
