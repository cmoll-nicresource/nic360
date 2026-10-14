import { describe, expect, it } from 'vitest'

import { buildCountryNameLookup, resolveCountryColumns } from './countryLookup'

describe('buildCountryNameLookup', () => {
  it('maps iso2 to name', () => {
    const lookup = buildCountryNameLookup([
      { iso2: 'US', name: 'United States' },
      { iso2: 'GB', name: 'United Kingdom' },
    ])
    expect(lookup.get('US')).toBe('United States')
    expect(lookup.get('GB')).toBe('United Kingdom')
  })
})

describe('resolveCountryColumns', () => {
  const nameByIso2 = buildCountryNameLookup([
    { iso2: 'US', name: 'United States' },
    { iso2: 'DE', name: 'Germany' },
  ])

  it('resolves country columns from iso2 to the full name', () => {
    const columns = [
      { key: 'country', type: 'country' },
      { key: 'share', type: 'percent' },
    ]
    const rows = [{ country: 'US', share: 42 }, { country: 'DE', share: 18 }]
    expect(resolveCountryColumns(columns, rows, nameByIso2)).toEqual([
      { country: 'United States', share: 42 },
      { country: 'Germany', share: 18 },
    ])
  })

  it('leaves an unrecognized code as-is (unmatched import value kept as free text)', () => {
    const columns = [{ key: 'country', type: 'country' }]
    const rows = [{ country: 'Atlantis' }]
    expect(resolveCountryColumns(columns, rows, nameByIso2)).toEqual([{ country: 'Atlantis' }])
  })

  it('does nothing when there are no country columns', () => {
    const columns = [{ key: 'share', type: 'percent' }]
    const rows = [{ share: 42 }]
    expect(resolveCountryColumns(columns, rows, nameByIso2)).toEqual([{ share: 42 }])
  })

  it('leaves null/non-string values untouched', () => {
    const columns = [{ key: 'country', type: 'country' }]
    const rows = [{ country: null }]
    expect(resolveCountryColumns(columns, rows, nameByIso2)).toEqual([{ country: null }])
  })

  it('does not mutate the input rows', () => {
    const columns = [{ key: 'country', type: 'country' }]
    const rows = [{ country: 'US' }]
    resolveCountryColumns(columns, rows, nameByIso2)
    expect(rows).toEqual([{ country: 'US' }])
  })
})
