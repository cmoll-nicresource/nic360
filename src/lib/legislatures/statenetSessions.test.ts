import { describe, expect, it } from 'vitest'

import {
  coverageReport,
  inferCalendarYear,
  parseDraftingCell,
  parseIntroDeadlines,
  parseStateNetDate,
  parseStateNetSessionsHtml,
  repairMojibake,
  toIsoDate,
} from './statenetSessions'

// Rows copied from a saved State Net "Regular Sessions" page (November 2026),
// trimmed to the markup the parser relies on.
const td = (label: string, value: string) => `<td data-label="${label}" style="padding: 10px;">${value}</td>`
const row = (cells: Record<string, string>) => `<tr>${Object.entries(cells).map(([k, v]) => td(k, v)).join('')}</tr>`
const page = `<html><body><main><table class="SessionCalendars__Table"><thead><tr>
<th style="text-align: left;">State</th><th>Session</th><th>Status</th><th>Drafting Began</th><th>Intro Deadline(s)</th>
<th>Governor Deadline</th><th>Adjourn Date</th><th>Carryover</th><th>Notes</th></tr></thead><tbody>
${row({ State: 'AL', Session: '2026 Regular Session', Status: 'REGULAR SESSION -- ADJOURNED SINE DIE', 'Drafting Began': 'N/A', 'Intro Deadline(s)': 'N/A', 'Governor Deadline': '*04/19/2026', 'Adjourn Date': '04/09/2026', Carryover: 'NO', Notes: 'N/A' })}
${row({ State: 'AZ', Session: '57th Legislature - Second Regular Session', Status: 'REGULAR SESSION -- ADJOURNED SINE DIE', 'Drafting Began': 'N/A', 'Intro Deadline(s)': 'House: 02/09/2026\nSenate: 02/02/2026', 'Governor Deadline': '*06/22/2026', 'Adjourn Date': '06/13/2026', Carryover: 'NO', Notes: 'N/A' })}
${row({ State: 'AR', Session: 'First Extraordinary Session of the 94th General Assembly', Status: 'SPECIAL SESSION -- ADJOURNED SINE DIE', 'Drafting Began': 'N/A', 'Intro Deadline(s)': '', 'Governor Deadline': '*05/06/2026', 'Adjourn Date': '05/06/2026', Carryover: 'NO', Notes: 'N/A' })}
${row({ State: 'LA', Session: '2026 Regular Legislative Session', Status: 'REGULAR SESSION -- ADJOURNED SINE DIE', 'Drafting Began': 'N/A', 'Intro Deadline(s)': '2026-03-31', 'Governor Deadline': '*06/18/2026', 'Adjourn Date': '06/01/2026', Carryover: 'NO', Notes: 'N/A' })}
${row({ State: 'MT', Session: 'NO REGULAR 2026 SESSION', Status: 'Regular Session', 'Drafting Began': 'N/A', 'Intro Deadline(s)': 'N/A', 'Governor Deadline': 'N/A', 'Adjourn Date': 'N/A', Carryover: 'NO', Notes: 'N/A' })}
${row({ State: 'NJ', Session: '222nd Legislature', Status: 'REGULAR SESSION -- ADJOURNED SINE DIE', 'Drafting Began': 'N/A', 'Intro Deadline(s)': 'N/A', 'Governor Deadline': '02/24/2027', 'Adjourn Date': '~01/10/2027', Carryover: '26-27', Notes: 'N/A' })}
${row({ State: 'NC', Session: '2026 General Assembly - First Extra Session', Status: 'SPECIAL SESSION -- ADJOURNED SINE DIE', 'Drafting Began': 'N/A', 'Intro Deadline(s)': 'N/A', 'Governor Deadline': '*10/09/2026', 'Adjourn Date': '10/07/2026', Carryover: '25-26', Notes: 'Budget &amp; maps' })}
</tbody></table></main></body></html>`

describe('State Net session calendar parsing', () => {
  const result = parseStateNetSessionsHtml(page)

  it('reads every row and the header columns', () => {
    expect(result.problems).toEqual([])
    expect(result.columns).toContain('Adjourn Date')
    expect(result.sessions.map((s) => s.state)).toEqual(['AL', 'AZ', 'AR', 'LA', 'MT', 'NJ', 'NC'])
  })

  it('separates the complete (*) and projected (~) markers from the date', () => {
    const al = result.sessions[0]
    expect(al.governorDeadline).toMatchObject({ date: '2026-04-19', complete: true, projected: false })
    expect(al.adjournDate).toMatchObject({ date: '2026-04-09', complete: false })
    const nj = result.sessions.find((s) => s.state === 'NJ')!
    expect(nj.adjournDate).toMatchObject({ date: '2027-01-10', projected: true })
    expect(nj.carryover).toBe('26-27')
  })

  it('reads per-chamber and mixed-format intro deadlines', () => {
    expect(result.sessions[1].introDeadlines).toEqual([
      { chamber: 'House', date: '2026-02-09', raw: 'House: 02/09/2026' },
      { chamber: 'Senate', date: '2026-02-02', raw: 'Senate: 02/02/2026' },
    ])
    expect(result.sessions.find((s) => s.state === 'LA')!.introDeadlines).toEqual([
      { chamber: null, date: '2026-03-31', raw: '2026-03-31' },
    ])
    expect(result.sessions[0].introDeadlines).toEqual([])
  })

  it('classifies regular, special and no-session rows', () => {
    const kinds = Object.fromEntries(result.sessions.map((s) => [`${s.state} ${s.name}`, s.kind]))
    expect(kinds['AL 2026 Regular Session']).toBe('regular')
    expect(kinds['AR First Extraordinary Session of the 94th General Assembly']).toBe('special')
    expect(kinds['NC 2026 General Assembly - First Extra Session']).toBe('special')
    expect(kinds['MT NO REGULAR 2026 SESSION']).toBe('none')
    expect(result.sessions.find((s) => s.state === 'MT')!.adjournDate.date).toBeNull()
  })

  it('decodes entities and drops N/A notes', () => {
    expect(result.sessions.find((s) => s.state === 'NC')!.notes).toBe('Budget & maps')
    expect(result.sessions[0].notes).toBeNull()
  })

  it('reports missing jurisdictions and projected dates', () => {
    const report = coverageReport(result.sessions)
    expect(report.jurisdictions).toBe(7)
    expect(report.missing).toContain('CA')
    expect(report.missing).not.toContain('AL')
    expect(report.projectedAdjournments).toEqual(['NJ 222nd Legislature'])
    expect(report.unreadableDates).toEqual([])
  })

  it('flags dates it cannot read instead of guessing', () => {
    expect(parseStateNetDate('Spring 2026').date).toBeNull()
    expect(toIsoDate('02/30/2026')).toBeNull()
    expect(toIsoDate('2026-2-3')).toBe('2026-02-03')
    const bad = parseStateNetSessionsHtml(page.replace('06/13/2026', 'TBD late June'))
    expect(coverageReport(bad.sessions).unreadableDates).toEqual(['AZ adjourn date: "TBD late June"'])
    expect(parseIntroDeadlines('N/A')).toEqual([])
  })

  it('reads the drafting cell from the Future and Special Sessions pages', () => {
    expect(parseDraftingCell('Drafting for 2027 began: ~Prefiling may begin: ~12/01/2026')).toMatchObject({
      label: 'Prefiling may begin', date: '2026-12-01', projected: true, detail: null,
    })
    // The "~" after State Net's template prefix is not a projection marker.
    expect(parseDraftingCell('Drafting for 2027 began: ~Prefiling may begin: 01/08/2027')).toMatchObject({
      label: 'Prefiling may begin', date: '2027-01-08', projected: false,
    })
    expect(parseDraftingCell('Drafting for 2027 began: ~Prefiling may begin ~12/01/2026')).toMatchObject({
      label: 'Prefiling may begin', date: '2026-12-01', projected: true,
    })
    expect(parseDraftingCell('Drafting for 2027 began: ~Drafting for 2027 began: 09/03/2026')).toMatchObject({
      label: 'Drafting for 2027 began', date: '2026-09-03',
    })
    expect(parseDraftingCell('Drafting for 2027 began: ~Prefiling may being: ~after election')).toMatchObject({
      label: 'Prefiling may being', detail: 'after election', date: null, projected: true,
    })
    expect(parseDraftingCell('Drafting for 2027 began: ~Does not prefile')).toMatchObject({ label: 'Does not prefile', date: null })
    expect(parseDraftingCell('N/A')).toMatchObject({ label: null, date: null })
  })

  it('repairs UTF-8 text that State Net served as Windows-1252', () => {
    expect(repairMojibake('127th General Assembly â€“ 1st Regular Session')).toBe('127th General Assembly – 1st Regular Session')
    expect(repairMojibake('Plain – already fine')).toBe('Plain – already fine')
    expect(repairMojibake('Crème brûlée')).toBe('Crème brûlée')
  })

  it('pulls the special-session subject out of "RE:" notes', () => {
    const special = parseStateNetSessionsHtml(page.replace('Budget &amp; maps', 'RE: Congressional Maps'))
    expect(special.sessions.find((s) => s.state === 'NC')!.subject).toBe('Congressional Maps')
    expect(result.sessions.find((s) => s.state === 'NC')!.subject).toBeNull()
  })

  it('flags stale "no session" rows, contradictions and untracked jurisdictions on a future-year page', () => {
    const future = `<table><tbody>
${row({ State: 'AK', Session: '35th Legislature - First Regular Session', Status: 'WILL MEET IN CURRENT YEAR', 'Adjourn Date': '~05/18/2027' })}
${row({ State: 'AL', Session: '2027 Regular Session', Status: 'WILL MEET IN CURRENT YEAR', 'Adjourn Date': '~05/18/2027' })}
${row({ State: 'CA', Session: '2027-28 Regular Session', Status: 'WILL MEET IN CURRENT YEAR', 'Adjourn Date': '~09/10/2027' })}
${row({ State: 'ND', Session: 'NO REGULAR 2026 SESSION', Status: 'WILL MEET IN CURRENT YEAR', 'Adjourn Date': 'N/A' })}
${row({ State: 'NV', Session: 'NO REGULAR 2026 SESSION', Status: 'WILL MEET IN CURRENT YEAR', 'Adjourn Date': 'N/A' })}
${row({ State: 'NV', Session: '84th Regular Session', Status: 'WILL MEET IN CURRENT YEAR', 'Adjourn Date': '~06/01/2027' })}
${row({ State: 'GU', Session: '39th Guam Legislature - First Regular Session', Status: 'WILL MEET IN CURRENT YEAR', 'Adjourn Date': '~12/31/2027' })}
</tbody></table>`
    const parsed = parseStateNetSessionsHtml(future)
    expect(inferCalendarYear(parsed.sessions)).toBe(2027)
    const report = coverageReport(parsed.sessions)
    expect(report.year).toBe(2027)
    expect(report.extra).toEqual(['GU'])
    expect(report.conflicts).toEqual([
      'ND: "NO REGULAR 2026 SESSION" is left over from 2026 on a 2027 page; check whether ND meets in 2027.',
      'NV: "NO REGULAR 2026 SESSION" is left over from 2026 on a 2027 page; check whether NV meets in 2027.',
      'NV: has both "NO REGULAR 2026 SESSION" and a session row.',
    ])
    // The 2026 page's own "no session" rows are not conflicts.
    expect(coverageReport(result.sessions).conflicts).toEqual([])
  })

  it('reports a page with no table rather than returning nothing silently', () => {
    expect(parseStateNetSessionsHtml('<html></html>').problems).toEqual(['No table found in the saved page.'])
  })
})
