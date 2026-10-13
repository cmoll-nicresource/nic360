import { describe, expect, it } from 'vitest'

import { parseCsv, suggestMapping } from './datasetImport'
import type { Dataset } from '@/payload-types'

describe('parseCsv', () => {
  it('parses headers and rows', () => {
    const csv = 'Company,Country,Year,Market Share\nAltria,US,2025,42.1\nBAT,UK,2025,18.3\n'
    const { headers, rows } = parseCsv(csv)
    expect(headers).toEqual(['Company', 'Country', 'Year', 'Market Share'])
    expect(rows).toEqual([
      { Company: 'Altria', Country: 'US', Year: '2025', 'Market Share': '42.1' },
      { Company: 'BAT', Country: 'UK', Year: '2025', 'Market Share': '18.3' },
    ])
  })

  it('trims whitespace from headers', () => {
    const csv = ' Company , Country \nAltria,US\n'
    const { headers } = parseCsv(csv)
    expect(headers).toEqual(['Company', 'Country'])
  })

  it('skips empty lines', () => {
    const csv = 'Company,Country\nAltria,US\n\n\nBAT,UK\n'
    const { rows } = parseCsv(csv)
    expect(rows).toHaveLength(2)
  })

  it('returns no headers for empty input', () => {
    const { headers, rows } = parseCsv('')
    expect(headers).toEqual([])
    expect(rows).toEqual([])
  })
})

describe('suggestMapping', () => {
  const columns: Dataset['columns'] = [
    { label: 'Company', key: 'company', type: 'text' },
    { label: 'Market Share', key: 'market_share', type: 'percent' },
    { label: 'Country', key: 'country', type: 'country' },
  ]

  it('matches a header to a column by exact label', () => {
    const mapping = suggestMapping(['Company', 'Market Share', 'Country'], columns)
    expect(mapping).toEqual({ Company: 'company', 'Market Share': 'market_share', Country: 'country' })
  })

  it('matches regardless of case, spacing and punctuation', () => {
    const mapping = suggestMapping(['company', 'market-share', 'COUNTRY'], columns)
    expect(mapping).toEqual({ company: 'company', 'market-share': 'market_share', COUNTRY: 'country' })
  })

  it('matches a header against a column key directly, not just its label', () => {
    const mapping = suggestMapping(['market_share'], columns)
    expect(mapping.market_share).toBe('market_share')
  })

  it('maps an unrecognized header to null rather than guessing', () => {
    const mapping = suggestMapping(['Some Unrelated Column'], columns)
    expect(mapping['Some Unrelated Column']).toBeNull()
  })
})
