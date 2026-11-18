import { describe, expect, it } from 'vitest'

import { collectWeekStoryIds, digestProblems, groupByHeading, htmlToPdfBlocks, orderByHeading, weekRange } from './digest'

describe('the week an Executive Summary covers', () => {
  it('is the seven calendar days ending on the issue date', () => {
    expect(weekRange('2026-11-06T12:00:00.000Z')).toEqual({
      from: '2026-10-31T00:00:00.000Z',
      to: '2026-11-07T00:00:00.000Z',
      firstDay: '2026-10-31',
      lastDay: '2026-11-06',
    })
    // Across the end of daylight saving time and a month boundary.
    expect(weekRange('2026-11-02T12:00:00Z').firstDay).toBe('2026-10-27')
    expect(() => weekRange('not a date')).toThrow('valid issue date')
  })

  it('collects daily stories oldest issue first, in running order, once each', () => {
    expect(
      collectWeekStoryIds([
        { issueDate: '2026-11-05T12:00:00Z', stories: [{ id: 7 }, 3] },
        { issueDate: '2026-11-02T12:00:00Z', stories: [1, 2, 3] },
        { issueDate: '2026-11-04T12:00:00Z', stories: null },
      ]),
    ).toEqual([1, 2, 3, 7])
  })
})

describe('grouping under the weekly headings', () => {
  const headings = [
    { id: 10, title: 'GTNF' },
    { id: 11, title: 'Society & Politics' },
    { id: 12, title: 'Cigars' },
  ]
  const stories = [
    { id: 1, heading: 12 },
    { id: 2, heading: 11 },
    { id: 3, heading: null },
    { id: 4, heading: 12 },
    { id: 5, heading: 99 }, // heading since deleted
  ]
  const headingOf = (s: { heading: number | null }) => s.heading

  it('follows heading order, keeps story order within a heading, and puts unfiled stories first', () => {
    expect(groupByHeading(stories, headingOf, headings).map((g) => [g.heading?.title ?? null, g.stories.map((s) => s.id)])).toEqual([
      [null, [3, 5]],
      ['Society & Politics', [2]],
      ['Cigars', [1, 4]],
    ])
    expect(orderByHeading(stories, headingOf, headings).map((s) => s.id)).toEqual([3, 5, 2, 1, 4])
  })

  it('blocks the PDF until every story has a heading', () => {
    expect(digestProblems([{ headline: 'A', heading: 11 }], headings)).toEqual([])
    expect(digestProblems([], headings)[0]).toMatch(/Add stories first/)
    expect(digestProblems([{ headline: 'A', heading: null }, { headline: 'B', heading: 99 }], headings)).toEqual([
      '2 stories have no weekly heading: "A", "B"',
    ])
  })
})

describe('story HTML for the PDF', () => {
  it('keeps paragraphs, emphasis, links, lists and line breaks', () => {
    const blocks = htmlToPdfBlocks(
      '<p>Shares of <strong>Japan Tobacco</strong> fell, said <a href="https://www.reuters.com/x?a=1&amp;b=2">Reuters</a>&#8217;s <em>report</em>.</p>\n<ul><li>Health warnings</li><li>Flavour <strong>limits</strong></li></ul><ol><li>One</li><li>Two</li></ol><p>Line one<br />line two</p><h3>Next steps</h3><blockquote><p>Quoted</p></blockquote>',
    )
    expect(blocks).toEqual([
      {
        kind: 'paragraph',
        runs: [
          { text: 'Shares of ' },
          { text: 'Japan Tobacco', bold: true },
          { text: ' fell, said ' },
          { text: 'Reuters', href: 'https://www.reuters.com/x?a=1&b=2' },
          { text: '’s ' },
          { text: 'report', italic: true },
          { text: '.' },
        ],
      },
      { kind: 'item', marker: '•', depth: 0, runs: [{ text: 'Health warnings' }] },
      { kind: 'item', marker: '•', depth: 0, runs: [{ text: 'Flavour ' }, { text: 'limits', bold: true }] },
      { kind: 'item', marker: '1.', depth: 0, runs: [{ text: 'One' }] },
      { kind: 'item', marker: '2.', depth: 0, runs: [{ text: 'Two' }] },
      { kind: 'paragraph', runs: [{ text: 'Line one\nline two' }] },
      { kind: 'heading', runs: [{ text: 'Next steps' }] },
      { kind: 'quote', runs: [{ text: 'Quoted' }] },
    ])
  })

  it('keeps loose text, drops empty blocks and unsafe links', () => {
    expect(htmlToPdfBlocks('Loose text <p> </p><p><a href="javascript:alert(1)">x</a></p><p></p>')).toEqual([
      { kind: 'paragraph', runs: [{ text: 'Loose text' }] },
      { kind: 'paragraph', runs: [{ text: 'x' }] },
    ])
    expect(htmlToPdfBlocks('')).toEqual([])
  })
})
