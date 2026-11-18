import { describe, expect, it } from 'vitest'

import type { Publication, PublicationAd, PublicationIssue, SummaryStory } from '@/payload-types'
import { issueStories, renderIssueEmailHtml, renderStoryListBody } from './issueEmail'
import { adSlotCount, issueAdItemCount } from './publicationAds'

const publication = { id: 3, title: 'Daily Executive Summary', slug: 'daily-executive-summary', category: ['news'], frequency: 'daily' } as Publication
const story = (id: number, extra: Partial<SummaryStory> = {}) =>
  ({
    id,
    headline: `Story ${id} & more`,
    bodyHtml: `<p>Body of story ${id}.</p>`,
    publishedAt: '2026-11-18T16:07:13.000Z',
    sources: [{ name: 'Reuters', url: 'https://www.reuters.com/x?a=1&b=2' }, { name: 'Antara News Agency', url: null }],
    wordpress: { postId: 100 + id, url: `https://tobaccoreporter.com/story-${id}/` },
    ...extra,
  }) as SummaryStory
const issue = {
  id: 40,
  title: 'Daily Executive Summary - November 18, 2026',
  issueDate: '2026-11-18T12:00:00Z',
  format: 'story-list',
  stories: [story(1), story(2), story(3), story(4), story(5)],
} as PublicationIssue
const ads = [1, 2, 3].map((id) => ({ id, image: { url: `/ad${id}.png`, alt: `Ad ${id}` } })) as PublicationAd[]

describe('Daily Executive Summary story lists', () => {
  it('sizes ad slots from the story count: one before story 1, 3 and 5', () => {
    expect(issueAdItemCount(issue)).toBe(5)
    expect(adSlotCount(issueAdItemCount(issue))).toBe(3)
    const html = renderStoryListBody(issue, ads)
    const order = [...html.matchAll(/\/api\/ads\/(\d)\/click|Story (\d) &amp; more/g)].map((m) => (m[1] ? `ad${m[1]}` : `s${m[2]}`))
    expect(order).toEqual(['ad1', 's1', 's2', 'ad2', 's3', 's4', 'ad3', 's5'])
  })

  it('runs out of ads gracefully and keeps every story', () => {
    const html = renderStoryListBody(issue, ads.slice(0, 1))
    expect(html.match(/\/api\/ads\//g)).toHaveLength(1)
    expect(html.match(/<h2 /g)).toHaveLength(5)
  })

  it('renders sources, the Tobacco Reporter link and escaped text', () => {
    const html = renderStoryListBody(issue, [])
    expect(html).toContain('Source: <a href="https://www.reuters.com/x?a=1&amp;b=2"')
    expect(html).toContain('<div>Source: Antara News Agency</div>')
    expect(html).toContain('href="https://tobaccoreporter.com/story-1/"')
    expect(html).toContain('Story 1 &amp; more')
    expect(html).toContain('<p style="margin:0 0 12px;">Body of story 1.</p>')
  })

  it('re-sanitizes stored text and skips unsafe links and missing images', () => {
    const unsafe = { ...issue, stories: [story(9, { bodyHtml: '<p onclick="x()">Hi<script>alert(1)</script></p>', sources: [{ name: 'Bad', url: 'javascript:alert(1)' }], image: null })] } as PublicationIssue
    const html = renderStoryListBody(unsafe, [])
    expect(html).not.toMatch(/script|onclick|javascript:/i)
    expect(html).not.toContain('<img')
    expect(html).toContain('<div>Source: Bad</div>')
  })

  it('ignores unpopulated story ids', () => {
    expect(issueStories({ stories: [7, story(1)] })).toHaveLength(1)
    expect(issueStories({ stories: null })).toEqual([])
  })

  it('shows the story count in the email masthead', () => {
    const html = renderIssueEmailHtml(issue, publication, [])
    expect(html).toContain('5 stories')
    expect(html).not.toContain('sections')
  })
})

describe('weekly Executive Summary (story-digest) issues', () => {
  const weekly = {
    id: 41,
    title: 'Weekly Executive Summary - November 6, 2026',
    issueDate: '2026-11-06T12:00:00Z',
    format: 'story-digest',
    stories: [story(1), story(2), story(3)],
    file: { id: 9, url: '/api/publication-files/file/weekly.pdf' },
  } as PublicationIssue
  it('has one ad slot, for the advertiser after the PDF contents', () => {
    expect(adSlotCount(issueAdItemCount(weekly))).toBe(1)
  })
  it('emails like a PDF report: the ad and a download link, not the stories', () => {
    const html = renderIssueEmailHtml(weekly, { ...publication, title: 'Weekly Executive Summary' } as Publication, ads.slice(0, 1))
    expect(html).toContain('Download the full report (PDF)')
    expect(html).toContain('/api/publication-files/file/weekly.pdf')
    expect(html.match(/\/api\/ads\//g)).toHaveLength(1)
    expect(html).not.toContain('Story 1 &amp; more')
  })
})
