import { describe, expect, it } from 'vitest'

import { buildDatasetRowValues } from './syncDatasets'

const KEYS = { commodity: 'commodity', country: 'importing_country', year: 'year', value: 'value_usd' }

describe('buildDatasetRowValues', () => {
  it('shapes rows and resolves country names to iso2', () => {
    const lookup = new Map([['zimbabwe', 'ZW'], ['unitedkingdom', 'GB']])
    const rows = [
      { commodity: 'CIGARS NOT FLAVORED', country: 'Zimbabwe', value: 27071.4 },
      { commodity: 'CIGARS NOT FLAVORED', country: 'United Kingdom', value: 500 },
    ]
    expect(buildDatasetRowValues(rows, 2026, KEYS, lookup)).toEqual([
      { commodity: 'CIGARS NOT FLAVORED', importing_country: 'ZW', year: 2026, value_usd: 27071 },
      { commodity: 'CIGARS NOT FLAVORED', importing_country: 'GB', year: 2026, value_usd: 500 },
    ])
  })

  it('falls back to the raw country text when it is not a recognized country', () => {
    const lookup = new Map<string, string>()
    const rows = [{ commodity: 'X', country: 'Atlantis', value: 10 }]
    expect(buildDatasetRowValues(rows, 2026, KEYS, lookup)).toEqual([
      { commodity: 'X', importing_country: 'Atlantis', year: 2026, value_usd: 10 },
    ])
  })

  it('rounds the value to a whole number', () => {
    const rows = [{ commodity: 'X', country: 'Atlantis', value: 10.6 }]
    expect(buildDatasetRowValues(rows, 2026, KEYS, new Map())[0].value_usd).toBe(11)
  })

  it('returns an empty array for no rows', () => {
    expect(buildDatasetRowValues([], 2026, KEYS, new Map())).toEqual([])
  })
})
