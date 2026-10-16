import { describe, expect, it } from 'vitest'
import type { Article, Bill, Publication, PublicationAd, PublicationIssue } from '@/payload-types'
import { lexicalFromParagraphs } from './lexical'
import { renderExcerptListBody, renderIssueEmailHtml } from './issueEmail'
import { editionItem, publicationHttpUrl } from './publicationEdition'
import { newsletterPlainText } from './ses/plainText'

const publication = {
  id: 1,
  title: 'US News Clippings',
  slug: 'us-news',
  category: ['news'],
  frequency: 'weekly',
  description: 'A summary of key US industry news',
} as Publication
const article = {
  id: 11,
  title: 'A headline & context',
  source: { id: 8, name: 'Reuters' },
  sourceUrl: 'https://example.com/story?a=1&b=2',
  sourceDate: '2026-10-09T00:00:00Z',
  locations: [{ id: 1, name: 'United States' }],
  primarySubject: { id: 2, name: 'SOCIETY & POLITICS' },
  excerpt: lexicalFromParagraphs([
    'First paragraph with the actual news excerpt.',
    'Final paragraph must not disappear.',
  ]),
} as unknown as Article
const bill = {
  id: 12,
  title: 'Regulates Sale of Electronic Nicotine Delivery Systems (PA25-H.1434)',
  billNumber: 'PA25-H.1434',
  billDate: '2026-10-13T00:00:00Z',
  locations: [{ id: 2, name: 'Pennsylvania' }],
  committee: 'Senate Committee on Judiciary',
  statusText: 'To Senate',
  latestText: 'Amended',
  latestActivity: 'Referred to Committee',
  billUrl: { url: 'https://example.com/bill' },
  abstract: lexicalFromParagraphs([
    'Addresses the sale of electronic nicotine delivery systems.',
    'Amendment replaces the licensing terminology.',
  ]),
  actions: [
    { date: '2026-10-05', action: 'PASSED House' },
    { date: '2026-10-13', action: 'Referred to Judiciary', actor: 'Senate' },
  ],
} as unknown as Bill
const issue = {
  id: 30,
  title: 'US News Clippings - October 9, 2026',
  issueDate: '2026-10-09T00:00:00Z',
  format: 'excerpt-list',
  email: { subject: 'Inbox subject override', previewText: 'The week in context' },
  sections: [
    { heading: 'SOCIETY & POLITICS', items: [{ relationTo: 'articles', value: article }] },
    { heading: 'Legislation', items: [{ relationTo: 'bills', value: bill }] },
  ],
} as PublicationIssue

describe('publication edition content', () => {
  it('retains full news excerpts, source attribution, location and dates in HTML and plain text', () => {
    const html = renderIssueEmailHtml(issue, publication, []),
      text = newsletterPlainText(html)
    for (const value of [
      'First paragraph with the actual news excerpt.',
      'Final paragraph must not disappear.',
      'Reuters',
      'United States',
      'Oct 9, 2026',
    ])
      expect(text).toContain(value)
    expect(html).toContain('https://example.com/story?a=1&amp;b=2')
    expect(html).toContain('/articles/11')
    expect(html).toContain('<title>Inbox subject override</title>')
    expect(html).toContain('>US News Clippings</h1>')
    expect(html).toContain('/publications/us-news/issues/30')
    expect(html).toContain('alt="Nicotine360"')
  })
  it('preserves the daily legislative fields and abstract without a weekly history block', () => {
    const html = renderIssueEmailHtml(
      {
        ...issue,
        sections: [{ heading: 'Pennsylvania', items: [{ relationTo: 'bills', value: bill }] }],
      },
      { ...publication, frequency: 'daily', category: ['legislation'] },
      [],
    )
    for (const value of [
      'Senate Committee on Judiciary',
      'To Senate',
      'Amended',
      'Referred to Committee',
      'Amendment replaces the licensing terminology.',
      'Latest text',
      'Latest activity',
    ])
      expect(html).toContain(value)
    expect(html).not.toContain('Recent activity')
    expect(html.match(/PA25-H\.1434/g)).toHaveLength(1)
    expect(html).toContain('href="https://example.com/bill"')
  })
  it('sorts weekly activity newest first without mutating records and links to the full history', () => {
    const actions = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      action: `Activity ${i + 1}`,
    }))
    const item = editionItem({ relationTo: 'bills', value: { ...bill, actions } }, publication)!
    expect(item.actions.map((a) => a.action)).toEqual([
      'Activity 7',
      'Activity 6',
      'Activity 5',
      'Activity 4',
      'Activity 3',
    ])
    expect(actions[0].action).toBe('Activity 1')
    const html = renderExcerptListBody(
      {
        ...issue,
        sections: [
          { heading: 'Policy', items: [{ relationTo: 'bills', value: { ...bill, actions } }] },
        ],
      },
      publication,
      [],
    )
    expect(html).toContain('View all activity')
    expect(html).toContain('Recent activity')
    expect(html.indexOf('Activity 7')).toBeLessThan(html.indexOf('Activity 6'))
  })
  it('uses stable unique section anchors even for repeated or punctuated headings', () => {
    const html = renderIssueEmailHtml(
      {
        ...issue,
        sections: [
          { heading: 'Tax & policy', items: [] },
          { heading: 'Tax & policy', items: [] },
        ],
      },
      publication,
      [],
    )
    for (const anchor of ['edition-section-1', 'edition-section-2']) {
      expect(html).toContain(`href="#${anchor}"`)
      expect(html).toContain(`id="${anchor}"`)
    }
    expect(html).toContain('Tax &amp; policy')
  })
  it('escapes metadata and rejects executable source URLs while tolerating sparse migrated records', () => {
    const html = renderIssueEmailHtml(
      {
        ...issue,
        sections: [
          {
            heading: 'News',
            items: [
              {
                relationTo: 'articles',
                value: {
                  ...article,
                  title: '<script>bad</script>',
                  sourceUrl: 'javascript:alert(1)',
                  source: null,
                  locations: null,
                  sourceDate: null,
                },
              },
            ],
          },
        ],
      },
      publication,
      [],
    )
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('Invalid Date')
    expect(publicationHttpUrl('https://user:password@example.com')).toBeNull()
    expect(publicationHttpUrl('/relative')).toBeNull()
    expect(editionItem({ relationTo: 'articles', value: 11 }, publication)).toBeNull()
  })
  it('keeps the flattened ad schedule across sections and preserves story order', () => {
    const ads = [
      { id: 1, image: { url: '/ad1.png', alt: 'Ad one' } },
      { id: 2, image: { url: '/ad2.png', alt: 'Ad two' } },
    ] as PublicationAd[]
    const html = renderExcerptListBody(
      {
        ...issue,
        sections: [
          issue.sections![0],
          {
            heading: 'More',
            items: [
              { relationTo: 'articles', value: { ...article, id: 13, title: 'Second story' } },
              { relationTo: 'articles', value: { ...article, id: 14, title: 'Third story' } },
            ],
          },
        ],
      },
      publication,
      ads,
    )
    expect(html.indexOf('/api/ads/1/click')).toBeLessThan(html.indexOf('/articles/11'))
    expect(html.indexOf('/api/ads/2/click')).toBeGreaterThan(html.indexOf('/articles/13'))
    expect(html.indexOf('/api/ads/2/click')).toBeLessThan(html.indexOf('/articles/14'))
  })
  it('leaves custom HTML unwrapped and keeps protected PDF downloads functional', () => {
    const custom = renderIssueEmailHtml(
      { ...issue, format: 'custom-html', body: '<h1>Staff design</h1>' },
      publication,
      [],
    )
    expect(custom).toContain('<h1>Staff design</h1>')
    expect(custom).not.toContain('alt="Nicotine360"')
    const pdf = renderIssueEmailHtml(
      {
        ...issue,
        format: 'pdf-report',
        file: { id: 2, url: '/api/publication-files/file/report.pdf' } as PublicationIssue['file'],
      },
      publication,
      [],
    )
    expect(pdf).toContain('/api/publication-files/file/report.pdf')
    expect(pdf).toContain('Download the full report (PDF)')
  })
  it('omits a web-edition link until a draft has an ID', () => {
    expect(
      renderIssueEmailHtml(
        { ...issue, id: undefined } as unknown as PublicationIssue,
        publication,
        [],
      ),
    ).not.toContain('View web edition')
  })
})
