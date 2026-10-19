import { describe, expect, it } from 'vitest'
import { journalKey, planResearchHistory } from './historyImport'

const row = {
  article_id: '2023-03-001', issue: '2023-03', journal: 'Example Journal',
  title: 'Research title', authors: 'Author One, Author Two', source_date: '2023-03-10',
  url: 'https://doi.org/10.1234/Example', title_url: '',
  abstract: 'Background Scientific text ≥5.\nResults Findings preserve α and β.',
}
const jsonl = (...rows: unknown[]) => rows.map(r => JSON.stringify(r)).join('\n')
describe('historical research import', () => {
  it('preserves Unicode, author order and complete abstract paragraphs with separate labels', () => {
    const plan = planResearchHistory('\uFEFF' + jsonl(row) + '\n')
    expect(plan.records[0].authors).toBe(row.authors)
    expect(plan.records[0].doiKey).toBe('https://doi.org/10.1234/example')
    expect(plan.records[0].body.root.children.map(p => p.children.map(n => n.text).join(''))).toEqual(['Background', 'Scientific text ≥5.', 'Results', 'Findings preserve α and β.'])
    expect(plan.records[0].publishedDate).toBe('2023-03-10T12:00:00.000Z')
  })
  it('coalesces repeated DOI occurrences and keeps their source identifiers', () => {
    const plan = planResearchHistory(jsonl(row, { ...row, article_id: '2024-03-002', issue: '2024-03', url: row.url.toLowerCase() }))
    expect(plan.records).toHaveLength(1)
    expect(plan.occurrences[row.article_id]).toEqual(['2023-03-001', '2024-03-002'])
  })
  it('splits explicit inline section labels while preserving sentence text', () => {
    const plan = planResearchHistory(jsonl({ ...row, abstract: 'Background: First sentence. Methods: Second sentence. Results: Third sentence.' }))
    expect(plan.records[0].body.root.children.map(p => p.children.map(n => n.text).join(''))).toEqual(['Background:', 'First sentence.', 'Methods:', 'Second sentence.', 'Results:', 'Third sentence.'])
  })
  it('rejects conflicting titles for one DOI instead of importing the wrong abstract', () => {
    expect(() => planResearchHistory(jsonl(row, { ...row, article_id: '2023-03-002', title: 'Different research' }))).toThrow('Conflicting DOI titles')
  })
  it('allows explicit evidence-backed replacement without duplicating the article', () => {
    const plan = planResearchHistory(jsonl(row, { ...row, article_id: '2023-03-002', title: 'Correct title' }), {
      [row.article_id]: { omitInFavorOf: '2023-03-002', evidence: 'Verified publisher DOI metadata' },
    })
    expect(plan.records[0].title).toBe('Correct title')
    expect(plan.occurrences['2023-03-002']).toContain(row.article_id)
  })
  it.each([{ source_date: '2023-02-30' }, { source_date: '' }, { authors: '' }, { abstract: '' }, { url: 'javascript:alert(1)' }, { title_url: 'https://user:secret@example.org/' }])('fails closed on incomplete or invalid source metadata %j', change => {
    expect(() => planResearchHistory(jsonl({ ...row, ...change }))).toThrow()
  })
  it('requires source IDs and valid correction references', () => {
    expect(() => planResearchHistory(jsonl(row, row))).toThrow('repeated article_id')
    expect(() => planResearchHistory(jsonl(row), { [row.article_id]: { omitInFavorOf: 'absent', evidence: 'Source' } })).toThrow('Missing replacement')
    expect(() => planResearchHistory('{broken}')).toThrow('line 1')
  })
  it('matches journal aliases without creating separate BMC or case variants', () => {
    expect(journalKey('Respiratory Research')).toBe(journalKey('Respiratory Research (BMC)'))
    expect(journalKey('Healthcare')).toBe(journalKey('HealthCare'))
    expect(planResearchHistory(jsonl({ ...row, journal: 'BMC Primary Care (formerly BMC Family Practice)' })).records[0].journal).toBe('BMC Primary Care')
  })
})
