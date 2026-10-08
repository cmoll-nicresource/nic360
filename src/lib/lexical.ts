/** Minimal single-paragraph Lexical document, for seeding/generating richText fields in code. */
export function lexicalFromParagraphs(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        format: '' as const,
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        children: [
          {
            type: 'text',
            format: 0,
            style: '',
            mode: 'normal',
            detail: 0,
            version: 1,
            text,
          },
        ],
      })),
    },
  }
}

export function lexicalFromText(text: string) {
  return lexicalFromParagraphs([text])
}
