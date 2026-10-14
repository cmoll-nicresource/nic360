// Excel readers. Adapted from ttb-trade/src/read.ts: reads an in-memory
// Buffer (the uploaded file's bytes) rather than only a file path, since the
// web upload route never writes the file to disk. The large-workbook
// streaming reader (exceljs, for the one-time 90MB master history load) is
// not ported — that one-time historical load isn't part of this feature.
import * as XLSX from 'xlsx'

export type Row = Record<string, unknown>

function upperKeys(r: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(r)) out[k.trim().toUpperCase()] = v
  return out
}

/** Read the first sheet of an uploaded workbook (.xls, .xlsx) into objects keyed by header. */
export function readSheetBuffer(buffer: Buffer, sheet?: string): Row[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const name = sheet ?? wb.SheetNames[0]
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`no sheet named ${name}`)
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null, raw: true })
  if (rows.length === 0 && ws['!ref'] && XLSX.utils.decode_range(ws['!ref']).e.r > 0) {
    throw new Error(`sheet ${name} could not be read (too large for this reader)`)
  }
  return rows.map(upperKeys)
}
