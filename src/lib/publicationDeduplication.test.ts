import { describe, expect, it } from 'vitest'
import { lexicalFromText } from './lexical'
import { uniquePublicationExcerpts } from './publicationDeduplication'

const article = (id: number, extra = {}) => ({
  id, collection: 'articles' as const, title: 'A news story',
  sourceUrl: 'https://publisher.example/story', excerpt: lexicalFromText('The full excerpt.'),
  ...extra,
})

describe('edition excerpt deduplication', () => {
  it('keeps one migrated story despite different IDs, dates or taxonomy, in stable input order', () => {
    expect(uniquePublicationExcerpts([
      article(5, { sourceDate: '2026-10-08', primarySubject: 1 }),
      article(8, { sourceDate: '2026-10-09', primarySubject: 2 }),
      article(9), article(10),
    ]).map((item) => item.id)).toEqual([5])
  })
  it('keeps independent stories and revisions with the same title', () => {
    const items = [article(1), article(2, { sourceUrl: 'https://other.example/story' }),
      article(3, { excerpt: lexicalFromText('A materially different excerpt.') }),
      article(4, { title: 'A different headline' })]
    expect(uniquePublicationExcerpts(items)).toEqual(items)
  })
  it('does not infer duplicates from empty excerpts, missing/invalid URLs or a headline alone', () => {
    for (const extra of [{ sourceUrl: null }, { sourceUrl: 'javascript:alert(1)' }, { excerpt: null },
      { excerpt: lexicalFromText('') }, { sourceUrl: 'https://user:secret@example.com/story' }])
      expect(uniquePublicationExcerpts([article(1, extra), article(2, extra)])).toHaveLength(2)
  })
  it('removes repeated record IDs across pages and repeated excerpt types, without conflating collections', () => {
    const bill = { id: 1, collection: 'bills' as const }
    const trademark = { id: 1, collection: 'trademarks' as const }
    expect(uniquePublicationExcerpts([article(1), article(1), bill, bill, trademark]))
      .toEqual([article(1), bill, trademark])
  })
  it('compares rich text independently of JSON object key order and leaves the input untouched', () => {
    const original = article(1), copy = article(2)
    const serialized = JSON.stringify(original)
    copy.excerpt.root = Object.fromEntries(Object.entries(copy.excerpt.root).reverse()) as typeof copy.excerpt.root
    expect(uniquePublicationExcerpts([original, copy])).toEqual([original])
    expect(JSON.stringify(original)).toBe(serialized)
  })
})
