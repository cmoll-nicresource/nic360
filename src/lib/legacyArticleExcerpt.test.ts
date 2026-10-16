import { describe, expect, it } from 'vitest'
import {
  canRepairLegacyArticleExcerpt,
  decodePgCopyText,
  legacyArticleExcerpt,
} from './legacyArticleExcerpt'
import { lexicalFromText } from './lexical'

const copy = (value: unknown) =>
  JSON.stringify(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\t', '\\t')
const paragraph = (text: string) => ({ type: 'paragraph', data: { text } })
describe('legacy news excerpt recovery', () => {
  it('imports the original short abstract instead of falling back to its headline', () => {
    const result = legacyArticleExcerpt({
      title: 'A headline',
      fullText: copy({ blocks: [] }),
      rawContent: '\\N',
      shortAbstract: copy({
        blocks: [paragraph('The complete excerpt.'), paragraph('Its second paragraph.')],
      }),
    })
    expect(result).toEqual({
      source: 'short_abstract',
      paragraphs: ['The complete excerpt.', 'Its second paragraph.'],
    })
  })
  it('prefers the curated excerpt over longer full article content', () => {
    expect(
      legacyArticleExcerpt({
        title: 'Title',
        shortAbstract: copy({ blocks: [paragraph('Curated excerpt')] }),
        content: copy({ blocks: [paragraph('Unabridged full article')] }),
      })?.paragraphs,
    ).toEqual(['Curated excerpt'])
  })
  it('decodes COPY and JSON escaping exactly once, preserving quotes, Unicode and backslashes', () => {
    const text = 'The "quoted" café &amp; <b>bold</b> report at C:\\news.'
    expect(
      legacyArticleExcerpt({ title: 'Title', shortAbstract: copy({ blocks: [paragraph(text)] }) })
        ?.paragraphs,
    ).toEqual(['The "quoted" café & bold report at C:\\news.'])
    expect(decodePgCopyText('\\N')).toBeNull()
    expect(decodePgCopyText('\\\\N')).toBe('\\N')
    expect(decodePgCopyText('First\\nSecond\\tvalue\\041')).toBe('First\nSecond\tvalue!')
  })
  it('uses valid later candidates when the abstract is empty, malformed or only a headline', () => {
    for (const shortAbstract of [
      '\\N',
      'not JSON',
      copy({ blocks: [] }),
      copy({ blocks: [paragraph('Title')] }),
    ])
      expect(
        legacyArticleExcerpt({
          title: 'Title',
          shortAbstract,
          content: copy({ blocks: [paragraph('Real content')] }),
        })?.source,
      ).toBe('content')
    expect(legacyArticleExcerpt({ title: 'Title', rawContent: 'Real teaser' })).toEqual({
      source: 'raw_content',
      paragraphs: ['Real teaser'],
    })
  })
  it('reports absent source text instead of treating a headline as a recovered excerpt', () => {
    expect(
      legacyArticleExcerpt({
        title: 'Title',
        shortAbstract: copy({ blocks: [paragraph('Title')] }),
        rawContent: 'Title',
      }),
    ).toBeNull()
  })
  it('protects genuine editor content while permitting the exact original fallback', () => {
    const old = { title: 'Headline', rawContent: 'Legacy teaser' }
    expect(canRepairLegacyArticleExcerpt(lexicalFromText('Headline'), 'Headline', old)).toBe(true)
    expect(canRepairLegacyArticleExcerpt(lexicalFromText('Legacy teaser'), 'Headline', old)).toBe(
      true,
    )
    expect(
      canRepairLegacyArticleExcerpt(
        lexicalFromText('Staff revised this excerpt.'),
        'Headline',
        old,
      ),
    ).toBe(false)
  })
})
