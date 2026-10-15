import type pg from 'pg'
import { describe, expect, it, vi } from 'vitest'

import { loadChapterFigures, loadMonthlySeries, type Line } from './data'

const line: Line = {
  lineId: 1, chapterId: 'EXPORT_LEAF', sortOrder: 1, description: 'Tobacco',
  part1Desc: 'Tobacco', shortName: 'Tobacco', indent: 0, chartGroup: null,
  qtyDivisor: 1, isTotal: false, unit: 'KG',
}

function clientWith(rows: Record<string, unknown>[]) {
  const query = vi.fn().mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rows: [] })
  return { client: { query } as unknown as pg.ClientBase, query }
}

function row(country: number, year: number, measures: unknown[]) {
  const [q_mo, v_mo, c_mo, q_yr, v_yr, c_yr] = measures
  return { line_id: 1, cty_code: country, country: `Country ${country}`, yr: year, q_mo, v_mo, c_mo, q_yr, v_yr, c_yr }
}

describe('Postgres report aggregates', () => {
  it.each(['strings', 'numbers'] as const)('adds %s numerically across countries and years, preserving fractions', async (representation) => {
    const values = (items: string[]) => representation === 'strings' ? items : items.map(Number)
    const { client } = clientWith([
      row(1, 2026, values(['12.5', '100', '120', '50.5', '500', '600'])),
      row(2, 2026, values(['7.5', '200', '210', '49.5', '700', '800'])),
      row(1, 2025, values(['5', '80', '90', '25', '250', '300'])),
      row(2, 2025, [null, null, null, null, null, null]),
      row(3, 2026, ['0', '0', '0', '0', '0', '0']),
    ])
    const [result] = await loadChapterFigures(client, [line], 'export', 2026, 8)
    expect(result.total).toEqual({
      qtyMo: 20, valMo: 300, cifMo: 330, qtyYtd: 100, valYtd: 1200, cifYtd: 1400,
      qtyPrev: 25, valPrev: 250, cifPrev: 300, qtyPrevMo: 5, valPrevMo: 80,
    })
    expect(result.countries.map((c) => c.ctyCode)).toEqual([1, 2])
    for (const figures of [result.total, ...result.countries]) {
      for (const key of Object.keys(result.total)) {
        expect(typeof figures[key as keyof typeof result.total]).toBe('number')
      }
    }
  })

  it('normalizes chart-series values and fills missing months across a year boundary', async () => {
    const { client } = clientWith([
      { line_id: 1, yr: 2025, mo: 12, q: '12.5', v: '12345678901' },
      { line_id: 1, yr: 2026, mo: 2, q: null, v: null },
    ])
    const series = await loadMonthlySeries(client, [line], 'export', [2025, 12], [2026, 2])
    expect(series.get(1)).toEqual([
      { yr: 2025, mo: 12, qty: 12.5, val: 12345678901 },
      { yr: 2026, mo: 1, qty: 0, val: 0 },
      { yr: 2026, mo: 2, qty: 0, val: 0 },
    ])
  })

  it.each(['NaN', 'Infinity', '', '9007199254740992'])('rejects an invalid database aggregate (%j)', async (value) => {
    const { client } = clientWith([row(1, 2026, ['1', '2', '3', value, '5', '6'])])
    await expect(loadChapterFigures(client, [line], 'export', 2026, 8)).rejects.toThrow(/q_yr/)
  })

  it('rejects a total that exceeds the safe numeric range even when each country is valid', async () => {
    const { client } = clientWith([
      row(1, 2026, [0, 0, 0, Number.MAX_SAFE_INTEGER, 0, 0]),
      row(2, 2026, [0, 0, 0, 1, 0, 0]),
    ])
    await expect(loadChapterFigures(client, [line], 'export', 2026, 8)).rejects.toThrow(/qtyYtd/)
  })
})
