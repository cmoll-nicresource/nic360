import { describe, expect, it } from 'vitest'
import { comparisonBars, filterDataRows, metricColumns, numericValue } from './datasetExplore'
const columns = [
  { key: 'country', label: 'Country', type: 'country' },
  { key: 'year', label: 'Year', type: 'year' },
  { key: 'brand', label: 'Brand', type: 'text' },
  { key: 'share', label: 'Market share (%)', type: 'percent' },
]
const rows = [
  { country: 'USA', year: 2025, brand: 'A', share: 20 },
  { country: 'USA', year: 2025, brand: 'B', share: 30 },
  { country: 'Canada', year: 2024, brand: 'A', share: 0 },
]
describe('dataset record exploration', () => {
  it('retains zero and negative figures, while rejecting missing and invalid numeric cells', () => {
    expect([0, -4, '1,234.5', '12%'].map(numericValue)).toEqual([0, -4, 1234.5, 12])
    for (const value of [null, undefined, '', ' ', true, [], {}, Infinity, 'unknown'])
      expect(numericValue(value)).toBeNull()
  })
  it('does not treat a year as a measure', () =>
    expect(metricColumns(columns).map((c) => c.key)).toEqual(['share']))
  it('compares records independently rather than summing percentages for a country', () => {
    const bars = comparisonBars(rows, columns, 'share')
    expect(bars.map((b) => b.value)).toEqual([30, 20, 0])
    expect(bars.map((b) => b.label)).toEqual([
      'USA · 2025 · B',
      'USA · 2025 · A',
      'Canada · 2024 · A',
    ])
    expect(rows[0].share).toBe(20)
  })
  it('applies geography, year and free text together, without dropping zero rows', () => {
    expect(filterDataRows(rows, columns, 'USA', '2025', 'b')).toEqual([rows[1]])
    expect(filterDataRows(rows, columns, 'Canada', '', '')).toEqual([rows[2]])
    expect(filterDataRows(rows, columns, '', '', 'missing')).toEqual([])
    expect(filterDataRows(rows, columns, '', '', '')).toEqual(rows)
  })
  it('limits chart records without truncating the underlying table data', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...rows[0], share: i }))
    expect(comparisonBars(many, columns, 'share')).toHaveLength(12)
    expect(many).toHaveLength(20)
  })
})
