import { createHash } from 'node:crypto'

export interface Trq {
  periodLabel: string
  quotaYear: string
  rows: { country: string; imported: number; quota: number }[]
  source?: { url: string; releaseDate: string; retrievedAt: string; sha256: string; quotaId: string; quotaPeriod: string; effectiveBegin: string; effectiveEnd: string; excluded: string[] }
}
export interface PdfText { text: string; x: number; y: number }
const DAY = 86400000
const iso = (date: Date) => date.toISOString().slice(0, 10)
const displayDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

/** Use the publication day's US Eastern calendar date, independent of server TZ. */
export function cbpCandidateDates(now = new Date()): string[] {
  const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/New_York' }).format(now)
  const end = new Date(`${today}T00:00:00Z`).getTime()
  if (!Number.isFinite(end)) throw new Error('Invalid CBP lookup date')
  // Every calendar day: Monday is usual, but holiday releases may move.
  return Array.from({ length: 14 }, (_, i) => iso(new Date(end - i * DAY)))
}

export function cbpReportUrl(date: string): string {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || iso(new Date(`${date}T00:00:00Z`)) !== date) throw new Error('Invalid CBP release date')
  return `https://www.cbp.gov/sites/default/files/${date.slice(0, 7)}/${date.slice(2, 4)}_${date.slice(5, 7)}${date.slice(8, 10)}_commodity_status_report.pdf`
}

function sourceDate(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!m) throw new Error(`Invalid CBP quota date: ${value}`)
  const date = `${m[3]}-${m[1]}-${m[2]}`
  if (iso(new Date(`${date}T00:00:00Z`)) !== date) throw new Error('Invalid CBP quota date')
  return date
}

function measure(value: string, dashIsZero = false): number {
  if (value === '-' && dashIsZero) return 0
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)) throw new Error(`Invalid CBP quantity: ${value}`)
  const n = Number(value.replaceAll(',', ''))
  if (!Number.isFinite(n) || n > Number.MAX_SAFE_INTEGER) throw new Error('CBP quantity outside supported range')
  return n
}

const EXPECTED = ['ARGENTINA', 'BRAZIL', 'CANADA', 'CHILE', 'GUATEMALA', 'ISRAEL', 'MALAWI', 'MEXICO', 'PHILIPPINES', 'THAILAND', 'UNITED KINGDOM', 'ZIMBABWE', 'EUROC', 'OTHR']
const EXCLUDED = ['CANADA', 'ISRAEL', 'MEXICO']

/** Read columns by their PDF header positions, never by whitespace alone. */
export function parseTobaccoRows(pages: PdfText[][], releaseDate: string): Omit<Trq, 'source'> & { quotaId: string; quotaPeriod: string; effectiveBegin: string; effectiveEnd: string; excluded: string[] } {
  const header = pages[0] ?? []
  if (!header.some(t => t.text === 'Commodity Status Report') || !header.some(t => t.text === displayDate(releaseDate))) throw new Error('CBP report title/date does not match its URL')
  const labels = ['Quota/License ID', 'Quota/License Commodity', 'Country Name', 'Region Code', 'Quota Period', 'Effective Begin Date', 'Effective End Date', 'Access', 'Maximum', 'e UOM Code', 'Allocated', 'Filled', 'Code', 'Status Date']
  const starts = labels.map(label => {
    const matches = header.filter(t => t.text === label)
    if (matches.length !== 1) throw new Error(`CBP table header changed: ${label}`)
    return matches[0].x
  })
  if (starts.some((x, i) => i > 0 && x <= starts[i - 1])) throw new Error('CBP table columns are out of order')
  const records: string[][] = []
  for (const page of pages) {
    for (const anchor of page.filter(t => t.x >= starts[0] - 1 && t.x < starts[1] - 1 && /^24[A-Z0-9]+$/.test(t.text))) {
      const line = page.filter(t => t.text.trim() && Math.abs(t.y - anchor.y) < 1).sort((a, b) => a.x - b.x)
      const cells = starts.map((x, i) => line.filter(t => t.x >= x - 1 && (i === starts.length - 1 || t.x < starts[i + 1] - 1)).map(t => t.text).join(' ').trim())
      if (cells[1] === 'Tobacco') records.push(cells)
    }
  }
  if (records.length !== EXPECTED.length) throw new Error(`Expected ${EXPECTED.length} CBP tobacco rows; found ${records.length}`)
  const seen = new Set<string>(), rows: Trq['rows'] = [], excluded: string[] = []
  const [, , , , quotaPeriod, rawBegin, rawEnd] = records[0]
  const quotaId = records[0][0], effectiveBegin = sourceDate(rawBegin), effectiveEnd = sourceDate(rawEnd)
  if (!/^\d{6}$/.test(quotaPeriod) || effectiveBegin > releaseDate || effectiveEnd < releaseDate) throw new Error('CBP quota period does not cover the release date')
  for (const r of records) {
    if (r[0] !== quotaId || r[4] !== quotaPeriod || r[5] !== rawBegin || r[6] !== rawEnd || r[9] !== 'KG') throw new Error('Inconsistent CBP tobacco quota IDs, periods or units')
    const key = r[2] === '-' ? r[3] : r[2]
    if (!EXPECTED.includes(key) || seen.has(key) || (r[2] !== '-' && r[3] !== '-')) throw new Error(`Unexpected or duplicate CBP tobacco country/region: ${key}`)
    seen.add(key)
    if (EXCLUDED.includes(key)) {
      if (r[12] !== 'EXCL' || r[8] !== '-' || r[10] !== '-') throw new Error(`CBP exclusion changed for ${key}`)
      excluded.push(key)
      continue
    }
    if (!['OPEN', 'FILL', 'POTF', 'BAND', 'CLOS'].includes(r[12])) throw new Error(`Unrecognized CBP tobacco status: ${r[12]}`)
    const quota = measure(r[8]), imported = measure(r[10], true)
    if (quota <= 0 || !/^\d+(?:\.\d+)?%$/.test(r[11]) || Math.abs(imported / quota * 100 - Number(r[11].slice(0, -1))) > 0.015) throw new Error(`CBP tobacco quota/percentage mismatch: ${key}`)
    const country = key === 'OTHR' ? 'Others' : key === 'EUROC' ? 'European Union (EUROC)' : key.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    rows.push({ country, quota, imported })
  }
  return { periodLabel: `${displayDate(effectiveBegin)} through ${displayDate(releaseDate)} (CBP release date)`,
    quotaYear: `${effectiveBegin.slice(0, 4)}/${effectiveEnd.slice(0, 4)}`, rows, quotaId, quotaPeriod, effectiveBegin, effectiveEnd, excluded }
}

export async function parseCbpPdf(bytes: Uint8Array, releaseDate: string): Promise<Trq> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, stopAtErrors: true })
  try {
    const doc = await task.promise
    if (doc.numPages > 40) throw new Error('CBP report exceeds supported page count')
    const pages: PdfText[][] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent()
      pages.push(content.items.flatMap(t => 'str' in t && t.str.trim() ? [{ text: t.str.trim(), x: t.transform[4], y: t.transform[5] }] : []))
    }
    const { quotaId, quotaPeriod, effectiveBegin, effectiveEnd, excluded, ...result } = parseTobaccoRows(pages, releaseDate)
    return { ...result, source: { url: cbpReportUrl(releaseDate), releaseDate, retrievedAt: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'), quotaId, quotaPeriod, effectiveBegin, effectiveEnd, excluded } }
  } finally {
    await task.destroy()
  }
}

const MAX_BYTES = 5_000_000
async function readPdf(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('CBP PDF exceeds size limit') }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('CBP PDF body is empty')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) throw new Error('CBP PDF exceeds size limit')
      chunks.push(value)
    }
  } finally { await reader.cancel() }
  const data = Buffer.concat(chunks)
  if (data.subarray(0, 5).toString() !== '%PDF-') throw new Error('CBP response is not a PDF')
  return data
}

/** Bounded date lookup supports holiday shifts, month/year rollover and unpublished weeks. */
export async function fetchLatestTrq(now = new Date(), fetcher: typeof fetch = fetch, parse = parseCbpPdf): Promise<Trq> {
  const dates = cbpCandidateDates(now)
  // Small batches keep latency bounded without hitting CBP with fourteen requests at once.
  const deadline = Date.now() + 25000
  for (let i = 0; i < dates.length; i += 3) {
    const batch = dates.slice(i, i + 3)
    const results = await Promise.allSettled(batch.map(async date => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error('CBP release lookup timed out')
      const response = await fetcher(cbpReportUrl(date), { cache: 'no-store', signal: AbortSignal.timeout(Math.min(5000, remaining)), redirect: 'error' })
      if ([404, 410].includes(response.status)) { await response.body?.cancel(); return null }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`CBP request failed (${response.status}) for ${date}`) }
      return readPdf(response)
    }))
    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      // Do not silently substitute an older release when a newer request is blocked,
      // times out, or returns an invalid PDF. Report a reviewable source failure.
      if (result.status === 'rejected') throw result.reason
      if (result.value) return parse(result.value, batch[j])
    }
  }
  throw new Error('No CBP commodity status PDF found in the last 14 days')
}
