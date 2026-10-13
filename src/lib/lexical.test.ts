import { describe, expect, it } from 'vitest'

import { lexicalFromParagraphs, lexicalFromText, lexicalToPlainText } from './lexical'

describe('lexicalToPlainText', () => {
  it('extracts text from a single-paragraph document', () => {
    expect(lexicalToPlainText(lexicalFromText('Hello world'))).toBe('Hello world')
  })

  it('joins multiple paragraphs with a space', () => {
    expect(lexicalToPlainText(lexicalFromParagraphs(['First paragraph.', 'Second paragraph.']))).toBe(
      'First paragraph. Second paragraph.',
    )
  })

  it('round-trips through lexicalFromParagraphs for nested structure', () => {
    const doc = lexicalFromParagraphs(['Altria reports strong Q3 earnings', 'Shares rose 4% on the news'])
    expect(lexicalToPlainText(doc)).toBe('Altria reports strong Q3 earnings Shares rose 4% on the news')
  })

  it('returns an empty string for a document with no text', () => {
    expect(lexicalToPlainText(lexicalFromParagraphs([]))).toBe('')
  })

  it('returns an empty string for null/undefined input', () => {
    expect(lexicalToPlainText(null)).toBe('')
    expect(lexicalToPlainText(undefined)).toBe('')
  })

  it('collapses extra whitespace', () => {
    const doc = { root: { children: [{ children: [{ text: '  extra   spaces  ' }] }] } }
    expect(lexicalToPlainText(doc)).toBe('extra spaces')
  })
})
