import { describe, expect, it } from 'vitest'

import { normalise } from './normalise'

const source = {
  COMMODITY: '2401100000', CTY_CODE: '1220', DISTRICT: '10', DOM_OR_FOR: '1',
  STAT_MONTH: '8', YEAR: '2026', ALL_QY1_MO: '10', ALL_QY1_YR: '80',
  ALL_VAL_MO: '100', ALL_VAL_YR: '800',
  CARDS_MO: '0', CARDS_YR: '0', ALL_QY2_MO: '0', ALL_QY2_YR: '0',
  VES_WGT_MO: '0', VES_WGT_YR: '0', VES_VAL_MO: '0', VES_VAL_YR: '0',
  AIR_WGT_MO: '0', AIR_WGT_YR: '0', AIR_VAL_MO: '0', AIR_VAL_YR: '0',
}

describe('Census trade normalization', () => {
  it('deduplicates identical rows before adding distinct records with the same key numerically', () => {
    const other = { ...source, ALL_QY1_MO: '20', ALL_QY1_YR: '90', ALL_VAL_MO: '200', ALL_VAL_YR: '900' }
    const result = normalise([source, source, other], 'export')
    expect(result.facts).toHaveLength(1)
    expect(result.facts[0]).toMatchObject({
      hts: 2401100000, yr: 2026, mo: 8, all_qy1_mo: 30, all_qy1_yr: 170,
      all_val_mo: 300, all_val_yr: 1700,
    })
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'duplicate_row', rowCount: 1 }),
      expect.objectContaining({ kind: 'conflicting_key_summed', rowCount: 2 }),
    ]))
  })

  it.each(['NaN', 'Infinity', '9007199254740992', '12,345'])('rejects an invalid source measure (%j)', (value) => {
    expect(() => normalise([{ ...source, ALL_VAL_YR: value }], 'export')).toThrow(/ALL_VAL_YR/)
  })

  it('rejects a merged sum outside the safe numeric range', () => {
    const first = { ...source, ALL_VAL_YR: String(Number.MAX_SAFE_INTEGER) }
    expect(() => normalise([first, { ...source, ALL_VAL_YR: '1' }], 'export')).toThrow(/merged all_val_yr/)
  })

  it('rejects unsafe keys instead of silently rounding them', () => {
    expect(() => normalise([{ ...source, COMMODITY: '9007199254740993' }], 'export')).toThrow(/COMMODITY/)
  })
})
