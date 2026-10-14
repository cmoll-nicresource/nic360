// Census column layouts for each trade flow. Ported verbatim from ttb-trade/src/columns.ts.
export type Flow = 'import' | 'export'

const pairs = (names: string[]) => names.flatMap((n) => [`${n}_mo`, `${n}_yr`])

export interface FlowSpec {
  /** Source (Census) column -> database column, for key columns. */
  rename: Record<string, string>
  key: string[]
  measures: string[]
  /** Postgres array type for each key column, used in bulk inserts. */
  keyTypes: Record<string, string>
  /** Descriptive source columns used to fill reference tables. */
  descColumns: string[]
}

export const SPEC: Record<Flow, FlowSpec> = {
  import: {
    rename: {
      COMMODITY: 'hts', CTY_CODE: 'cty_code', CTY_SUBCO: 'cty_subco', DIST_ENTRY: 'dist_entry',
      DIST_UNLAD: 'dist_unlad', RATE_PROV: 'rate_prov', STAT_MONTH: 'mo', YEAR: 'yr',
    },
    key: ['yr', 'mo', 'hts', 'cty_code', 'cty_subco', 'dist_entry', 'dist_unlad', 'rate_prov'],
    keyTypes: {
      yr: 'smallint', mo: 'smallint', hts: 'bigint', cty_code: 'integer', cty_subco: 'text',
      dist_entry: 'integer', dist_unlad: 'integer', rate_prov: 'integer',
    },
    measures: pairs([
      'cards', 'con_qy1', 'con_qy2', 'con_val', 'dut_val', 'cal_dut', 'con_cha', 'con_cif',
      'gen_qy1', 'gen_qy2', 'gen_val', 'gen_cha', 'gen_cif',
      'ves_val', 'ves_wgt', 'ves_cha', 'air_val', 'air_wgt', 'air_cha',
    ]),
    descColumns: ['COMM_DESC', 'UNIT_QY1', 'UNIT_QY2', 'CTY_DESC', 'D_E_DESC', 'D_U_DESC'],
  },
  export: {
    rename: {
      COMMODITY: 'hts', CTY_CODE: 'cty_code', DISTRICT: 'district', DOM_OR_FOR: 'dom_or_for',
      STAT_MONTH: 'mo', YEAR: 'yr',
    },
    key: ['yr', 'mo', 'dom_or_for', 'hts', 'cty_code', 'district'],
    keyTypes: {
      yr: 'smallint', mo: 'smallint', dom_or_for: 'smallint', hts: 'bigint', cty_code: 'integer', district: 'integer',
    },
    measures: pairs(['cards', 'all_qy1', 'all_qy2', 'all_val', 'ves_wgt', 'ves_val', 'air_wgt', 'air_val']),
    descColumns: ['COMM_DESC', 'UNIT_QY1', 'UNIT_QY2', 'CTY_DESC', 'DIST_DESC'],
  },
}

/** Measures a source file may legitimately lack; stored as null rather than zero. */
export const OPTIONAL_MEASURES = new Set(['con_cif_mo', 'con_cif_yr'])
