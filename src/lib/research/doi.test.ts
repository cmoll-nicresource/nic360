import { describe, expect, it } from 'vitest'
import { normalizeDoi } from './doi'
import { researchMonth, previousResearchMonth } from './period'
import { researchParagraphs } from './reportPdf'
describe('research metadata', () => {
  it.each([
    '10.1234/ABC.5',
    'doi: 10.1234/ABC.5',
    'http://dx.doi.org/10.1234/ABC.5?utm_source=test',
    'https://doi.org/10.1234/ABC.5#fragment',
  ])('normalizes %s without losing DOI case', (value) => {
    expect(normalizeDoi(value)).toBe('https://doi.org/10.1234/ABC.5')
  })
  it.each([
    'javascript:alert(1)',
    'https://evil.example/10.1234/example',
    'https://doi.org.evil.example/10.1234/example',
    '10.1234/<script>',
    '10.1234/with space',
    '10.1/example',
    'https://user:secret@doi.org/10.1234/a',
  ])('rejects invalid DOI destinations: %s', (value) =>
    expect(() => normalizeDoi(value)).toThrow(),
  )
  it('keeps a missing DOI missing', () =>
    expect(normalizeDoi('')).toBeUndefined())
  it('uses whole calendar months including leap days, never a rolling 30-day window', () => {
    expect(researchMonth('2024-02')).toEqual({
      from: '2024-02-01T00:00:00.000Z',
      until: '2024-03-01T00:00:00.000Z',
      label: 'February 2024',
    })
    expect(researchMonth('2026-12').until).toBe('2027-01-01T00:00:00.000Z')
    for (const value of ['2026-00', '2026-13', '2026-2', '', '0001-01'])
      expect(() => researchMonth(value)).toThrow()
  })
  it('retains paragraph boundaries and joins formatted inline text without inserting false spaces', () => {
    expect(
      researchParagraphs({
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ text: 'Anti' }, { text: 'oxidants' }],
            },
            { type: 'paragraph', children: [{ text: 'Second paragraph.' }] },
          ],
        },
      }),
    ).toEqual(['Antioxidants', 'Second paragraph.'])
  })
  it('defaults to the previous month in the staff timezone at UTC month boundaries', () => {
    expect(previousResearchMonth(new Date('2026-11-01T01:00:00Z'))).toBe(
      '2026-09',
    )
    expect(previousResearchMonth(new Date('2026-11-01T07:00:00Z'))).toBe(
      '2026-10',
    )
  })
})
