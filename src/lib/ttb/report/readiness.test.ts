import { describe, expect, it } from 'vitest'
import type { Inputs } from './chapters'
import type { Report } from './model'
import { reportDocument } from './pdf'
import { assertReportInputs, assertReportReady, generationDate } from './readiness'

const inputs: Inputs = {
  usTrade: { exports: { month: 100, prevMonth: 90, ytd: 800, prevYtd: 700 }, imports: { month: 150, prevMonth: 140, ytd: 1000, prevYtd: 900 } },
  trq: { periodLabel: 'September 13 through October 13, 2026', quotaYear: '2026/2027', rows: [{ country: 'Brazil', quota: 80200000, imported: 736386 }] },
}
const report = (): Report => ({ title: 'Trade report', subtitle: 'August 2026', notes: [], chapters: [{ partNo: 1, title: 'Balance of trade', sections: [{ landscape: false, header: 'Balance of trade', blocks: [{ kind: 'para', text: 'Completed report text.' }, { kind: 'table', table: { title: 'Totals', widths: [1], header: [{ cells: [{ text: 'Value' }] }], rows: [{ cells: [{ text: '$100' }] }] } }] }] }] })

describe('complete report generation', () => {
  it('uses the US Eastern generation date, including near UTC midnight', () => {
    expect(generationDate(new Date('2026-10-16T02:00:00Z'))).toBe('October 15, 2026')
    expect(generationDate(new Date('2026-01-01T02:00:00Z'))).toBe('December 31, 2025')
  })

  it('accepts complete inputs and a finished report', () => {
    expect(() => assertReportInputs(inputs, 2026, 8)).not.toThrow()
    expect(() => assertReportReady(report())).not.toThrow()
  })

  it('rejects missing source figures, incomplete manual data and invalid quantities', () => {
    expect(() => assertReportInputs({}, 2026, 8)).toThrow(/required/)
    expect(() => assertReportInputs({ ...inputs, trq: undefined }, 2026, 8)).toThrow(/required/)
    expect(() => assertReportInputs({ ...inputs, trq: { ...inputs.trq!, rows: [] } }, 2026, 8)).toThrow(/incomplete/)
    expect(() => assertReportInputs({ ...inputs, trq: { ...inputs.trq!, rows: [{ country: 'Test', quota: 0, imported: 0 }] } }, 2026, 8)).toThrow(/positive/)
    expect(() => assertReportInputs({ ...inputs, usTrade: { ...inputs.usTrade!, exports: { ...inputs.usTrade!.exports, month: NaN } } }, 2026, 8)).toThrow(/Invalid report input/)
  })

  it('rejects mismatched periods and unreconciled external balances', () => {
    expect(() => assertReportInputs({ ...inputs, usTrade: { ...inputs.usTrade!, source: { period: '2026-07', retrievedAt: '2026-10-15', series: [] } } }, 2026, 8)).toThrow(/month/)
    expect(() => assertReportInputs({ ...inputs, usTrade: { ...inputs.usTrade!, balance: { month: -999, prevMonth: -50, ytd: -200, prevYtd: -200 } } }, 2026, 8)).toThrow(/reconcile/)
  })

  it.each(['[[lead-in]]', '[[release date', 'broken marker]]', 'NaN', 'Infinity'])('refuses unfinished text before rendering: %s', text => {
    const fixture = report()
    fixture.chapters[0].sections[0].blocks[0] = { kind: 'para', text }
    expect(() => reportDocument(fixture)).toThrow(/unfinished or invalid/)
  })

  it('checks table cells and rejects unresolved data notes too', () => {
    const fixture = report()
    const block = fixture.chapters[0].sections[0].blocks[1]
    if (block.kind !== 'table') throw new Error('Fixture error')
    block.table.rows[0].cells[0].text = '[[missing figures]]'
    expect(() => assertReportReady(fixture)).toThrow(/unfinished/)
    const warned = report()
    warned.notes = ['No prior-year imports loaded']
    expect(() => reportDocument(warned)).toThrow(/needs attention/)
  })
})
