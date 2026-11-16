/**
 * Parses a saved State Net "Session Calendars" page (Resources > Session
 * Calendars > Regular Sessions / Future Sessions / Special Sessions, saved
 * from the browser as HTML) into plain session records.
 *
 * State Net has no export, so the yearly process is: save the page, run
 * scripts/parseStateNetSessions.ts, review the JSON and the coverage report.
 * See docs/state-legislatures.md.
 *
 * The table cells carry data-label attributes ("State", "Adjourn Date", ...),
 * which is what this keys on, so cosmetic changes to State Net's styling
 * don't break it. Pure: no network, no database.
 */

export type StateNetDate = {
  /** YYYY-MM-DD, or null when State Net shows N/A or nothing. */
  date: string | null
  /** State Net "~": a projected date, not a confirmed one. */
  projected: boolean
  /** State Net "*": the session's actions are complete. */
  complete: boolean
  /** The cell exactly as State Net showed it, for review. */
  raw: string
}

export type StateNetDeadline = {
  /** "House", "Senate", or null when the cell gives one date for both. */
  chamber: string | null
  date: string | null
  raw: string
}

/**
 * The "Drafting Began" cell. On the Future and Special Sessions pages it reads
 * like "Drafting for 2027 began: ~Prefiling may begin: ~12/01/2026" or
 * "Drafting for 2027 began: ~Does not prefile"; on the Regular page it is N/A.
 */
export type StateNetDrafting = StateNetDate & {
  /** What the date means ("Prefiling may begin"), or the whole note when there is no date ("Does not prefile"). */
  label: string | null
  /** Non-date text after the label, e.g. "after election". */
  detail: string | null
}

export type StateNetSession = {
  /** Two-letter postal code, e.g. "AL"; "US" for Congress, "GU"/"VI" for territories. */
  state: string
  name: string
  kind: 'regular' | 'special' | 'none'
  /** e.g. "REGULAR SESSION -- ADJOURNED SINE DIE", "WILL MEET IN CURRENT YEAR" */
  status: string
  adjournedSineDie: boolean
  draftingBegan: StateNetDrafting
  introDeadlines: StateNetDeadline[]
  governorDeadline: StateNetDate
  adjournDate: StateNetDate
  /** Years bills carry over between, e.g. "25-26"; null for "NO". */
  carryover: string | null
  notes: string | null
  /** Special-session subject from a "RE: ..." note, e.g. "Congressional Maps". */
  subject: string | null
}

export type StateNetParseResult = {
  sessions: StateNetSession[]
  /** Column labels found in the table header, in order. */
  columns: string[]
  /** Rows that could not be read, with the reason. */
  problems: string[]
}

const EMPTY = new Set(['', 'N/A', 'NA', 'NONE', '-', '—'])

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

// Windows-1252 characters for bytes 0x80-0x9F (undefined bytes omitted).
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

/**
 * State Net sometimes serves UTF-8 text that was decoded as Windows-1252
 * ("â€“" for "–"). Reverse that when the whole string round-trips cleanly;
 * otherwise leave it alone.
 */
export function repairMojibake(text: string): string {
  if (!/[ÂÃâ][\u0080-¿Œ-™]/.test(text)) return text
  const bytes: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code < 0x100) bytes.push(code)
    else if (ch in CP1252) bytes.push(CP1252[ch])
    else return text
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  } catch {
    return text
  }
}

function cellText(html: string): string {
  return repairMojibake(decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')))
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function isEmpty(text: string): boolean {
  return EMPTY.has(text.trim().toUpperCase())
}

/** Accepts MM/DD/YYYY and YYYY-MM-DD; returns YYYY-MM-DD or null. */
export function toIsoDate(text: string): string | null {
  const t = text.trim()
  let y: number, m: number, d: number
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (us) [m, d, y] = [Number(us[1]), Number(us[2]), Number(us[3])]
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseStateNetDate(raw: string): StateNetDate {
  let text = raw.trim()
  let projected = false
  let complete = false
  // Markers can be combined and sit before the date.
  while (/^[*~]/.test(text)) {
    if (text[0] === '*') complete = true
    if (text[0] === '~') projected = true
    text = text.slice(1).trim()
  }
  return { date: isEmpty(text) ? null : toIsoDate(text), projected, complete, raw }
}

const TRAILING_DATE = /([*~]*)\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})$/

export function parseDraftingCell(raw: string): StateNetDrafting {
  const blank = { date: null, projected: false, complete: false, raw, label: null, detail: null }
  // "Drafting for 2027 began: ~" is State Net's template text on every row; the
  // "~" after it is not a projection marker.
  const text = raw.trim().replace(/^Drafting for \d{4} began:\s*[*~]*\s*/i, '').trim()
  if (isEmpty(text)) return blank
  const dated = text.match(TRAILING_DATE)
  if (dated) {
    const label = text.slice(0, dated.index).replace(/[:\s]+$/, '').trim() || null
    const date = parseStateNetDate(`${dated[1]}${dated[2]}`)
    return { ...date, raw, label, detail: null }
  }
  const colon = text.indexOf(':')
  if (colon === -1) return { ...blank, label: text }
  const detail = text.slice(colon + 1).replace(/^[\s*~]+/, '').trim()
  return { ...blank, label: text.slice(0, colon).trim(), detail: detail || null, projected: /:\s*~/.test(text) }
}

export function parseIntroDeadlines(raw: string): StateNetDeadline[] {
  if (isEmpty(raw)) return []
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !isEmpty(line))
    .map((line) => {
      const labelled = line.match(/^([A-Za-z ]+):\s*(.+)$/)
      const chamber = labelled ? labelled[1].trim() : null
      const value = labelled ? labelled[2] : line
      return { chamber, date: parseStateNetDate(value).date, raw: line }
    })
}

function kindOf(name: string, status: string): StateNetSession['kind'] {
  if (/^NO\s+REGULAR\b/i.test(name)) return 'none'
  if (/SPECIAL|EXTRAORDINARY|EXTRA SESSION/i.test(`${status} ${name}`)) return 'special'
  return 'regular'
}

export function parseStateNetSessionsHtml(html: string): StateNetParseResult {
  const problems: string[] = []
  const table = html.match(/<table[^>]*SessionCalendars__Table[\s\S]*?<\/table>/i)?.[0]
    ?? html.match(/<table[\s\S]*?<\/table>/i)?.[0]
  if (!table) return { sessions: [], columns: [], problems: ['No table found in the saved page.'] }

  const columns = [...(table.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((m) => cellText(m[1]))

  const body = table.match(/<tbody[\s\S]*?<\/tbody>/i)?.[0] ?? table
  const sessions: StateNetSession[] = []
  for (const [index, row] of [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].entries()) {
    const cells = new Map<string, string>()
    for (const m of row[1].matchAll(/<td[^>]*data-label="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)) {
      cells.set(decodeEntities(m[1]).trim(), cellText(m[2]))
    }
    if (cells.size === 0) continue
    const get = (label: string) => cells.get(label) ?? ''
    const state = get('State').toUpperCase()
    if (!/^[A-Z]{2}$/.test(state)) {
      problems.push(`Row ${index + 1}: unreadable state "${get('State')}".`)
      continue
    }
    const name = get('Session')
    const status = get('Status')
    const notes = get('Notes')
    const carry = get('Carryover')
    sessions.push({
      state,
      name,
      kind: kindOf(name, status),
      status,
      adjournedSineDie: /SINE DIE/i.test(status),
      draftingBegan: parseDraftingCell(get('Drafting Began')),
      introDeadlines: parseIntroDeadlines(get('Intro Deadline(s)')),
      governorDeadline: parseStateNetDate(get('Governor Deadline')),
      adjournDate: parseStateNetDate(get('Adjourn Date')),
      carryover: isEmpty(carry) || /^NO$/i.test(carry.trim()) ? null : carry.trim(),
      notes: isEmpty(notes) ? null : notes,
      subject: notes.match(/^RE:\s*(.+)$/i)?.[1].trim() ?? null,
    })
  }
  return { sessions, columns, problems }
}

/** 50 states, DC, PR and Congress: the jurisdictions a complete calendar should cover. */
export const EXPECTED_JURISDICTIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
  'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
  'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'US',
] as const

/**
 * The calendar year a page covers, taken as the most common year named in its
 * session names ("2027 Regular Session", "2027-28 Regular Session"). Pages
 * don't state it anywhere else reliably. Null when no name carries a year.
 */
export function inferCalendarYear(sessions: StateNetSession[]): number | null {
  const counts = new Map<number, number>()
  for (const s of sessions) {
    if (s.kind === 'none') continue
    const year = s.name.match(/\b(20\d{2})\b/)?.[1]
    if (year) counts.set(Number(year), (counts.get(Number(year)) ?? 0) + 1)
  }
  let best: number | null = null
  for (const [year, n] of counts) if (best === null || n > counts.get(best)! || (n === counts.get(best)! && year > best)) best = year
  return best
}

export type CoverageReport = {
  /** The year the page appears to cover (see inferCalendarYear), or the one passed in. */
  year: number | null
  jurisdictions: number
  missing: string[]
  /** Jurisdictions on the page that we don't track (e.g. GU, VI). */
  extra: string[]
  /** Dates in the table that could not be read as dates. */
  unreadableDates: string[]
  projectedAdjournments: string[]
  /** Rows that contradict each other or the page's year; these need a human look. */
  conflicts: string[]
}

export function coverageReport(sessions: StateNetSession[], options: { year?: number | null } = {}): CoverageReport {
  const year = options.year ?? inferCalendarYear(sessions)
  const present = new Set(sessions.map((s) => s.state))
  const expected = new Set<string>(EXPECTED_JURISDICTIONS)
  const unreadableDates: string[] = []
  const conflicts: string[] = []
  for (const s of sessions) {
    const check = (label: string, d: StateNetDate) => {
      if (d.date === null && !isEmpty(d.raw.replace(/[*~]/g, ''))) unreadableDates.push(`${s.state} ${label}: "${d.raw}"`)
    }
    // A drafting cell with a label but no date ("Does not prefile") is a note, not an unreadable date.
    if (s.draftingBegan.label === null) check('drafting began', s.draftingBegan)
    check('governor deadline', s.governorDeadline)
    check('adjourn date', s.adjournDate)
    for (const dl of s.introDeadlines) if (dl.date === null) unreadableDates.push(`${s.state} intro deadline: "${dl.raw}"`)

    if (s.kind === 'none') {
      const named = Number(s.name.match(/\b(20\d{2})\b/)?.[1])
      if (year && named && named !== year) {
        conflicts.push(`${s.state}: "${s.name}" is left over from ${named} on a ${year} page; check whether ${s.state} meets in ${year}.`)
      }
      if (sessions.some((o) => o.state === s.state && o.kind !== 'none')) {
        conflicts.push(`${s.state}: has both "${s.name}" and a session row.`)
      }
    }
  }
  return {
    year,
    jurisdictions: present.size,
    missing: EXPECTED_JURISDICTIONS.filter((code) => !present.has(code)),
    extra: [...present].filter((code) => !expected.has(code)).sort(),
    unreadableDates,
    projectedAdjournments: sessions.filter((s) => s.adjournDate.projected).map((s) => `${s.state} ${s.name}`),
    conflicts,
  }
}
