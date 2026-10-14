import { describe, expect, it } from 'vitest'

import { sentenceCase } from './textCase'

describe('sentenceCase', () => {
  it('sentence-cases an ALL CAPS term', () => {
    expect(sentenceCase('SOCIETY & POLITICS')).toBe('Society & politics')
  })

  it('sentence-cases an all-lowercase term', () => {
    expect(sentenceCase('market trends')).toBe('Market trends')
  })

  it('leaves an already mixed-case term alone (acronyms like USPTO)', () => {
    expect(sentenceCase('USPTO filings')).toBe('USPTO filings')
  })

  it('leaves a Title Case term alone', () => {
    expect(sentenceCase('Trade Policy')).toBe('Trade Policy')
  })

  it('handles an empty string', () => {
    expect(sentenceCase('')).toBe('')
  })

  it('capitalizes after sentence punctuation', () => {
    expect(sentenceCase('TAXATION. TRADE POLICY')).toBe('Taxation. Trade policy')
  })
})
