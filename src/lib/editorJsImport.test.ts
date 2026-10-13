import { describe, expect, it } from 'vitest'

import { editorJsToParagraphs, stripHtml } from './editorJsImport'

describe('editorJsToParagraphs', () => {
  it('extracts text from paragraph blocks', () => {
    const raw = { blocks: [{ type: 'paragraph', data: { text: 'First.' } }, { type: 'paragraph', data: { text: 'Second.' } }] }
    expect(editorJsToParagraphs(raw)).toEqual(['First.', 'Second.'])
  })

  it('strips HTML tags embedded in paragraph text', () => {
    const raw = { blocks: [{ type: 'paragraph', data: { text: 'See the <a href="https://example.com">ministry of health</a> notice.' } }] }
    expect(editorJsToParagraphs(raw)).toEqual(['See the ministry of health notice.'])
  })

  it('skips non-paragraph block types', () => {
    const raw = { blocks: [{ type: 'header', data: { text: 'Heading' } }, { type: 'paragraph', data: { text: 'Body.' } }] }
    expect(editorJsToParagraphs(raw)).toEqual(['Body.'])
  })

  it('skips empty or whitespace-only paragraphs', () => {
    const raw = { blocks: [{ type: 'paragraph', data: { text: '   ' } }, { type: 'paragraph', data: { text: 'Real text.' } }] }
    expect(editorJsToParagraphs(raw)).toEqual(['Real text.'])
  })

  it('returns an empty array for null, non-object, or malformed input', () => {
    expect(editorJsToParagraphs(null)).toEqual([])
    expect(editorJsToParagraphs(undefined)).toEqual([])
    expect(editorJsToParagraphs('blocks')).toEqual([])
    expect(editorJsToParagraphs({ blocks: 'not an array' })).toEqual([])
    expect(editorJsToParagraphs({})).toEqual([])
  })
})

describe('stripHtml', () => {
  it('decodes the handful of entities seen in the old content', () => {
    expect(stripHtml('Smith &amp; Sons &nbsp;said &quot;no&quot; &#39;today&#39;')).toBe('Smith & Sons said "no" \'today\'')
  })

  it('collapses runs of whitespace left behind by removed tags', () => {
    expect(stripHtml('A <b>bold</b>   word.')).toBe('A bold word.')
  })
})
