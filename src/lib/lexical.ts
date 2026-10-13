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

type LexicalNode = { text?: string; children?: LexicalNode[] }

/** Strips a Lexical richText document down to plain text, for building a search index. Walks every node's children and joins all `text` leaves with spaces. */
export function lexicalToPlainText(doc: unknown): string {
  const root = (doc as { root?: LexicalNode } | null | undefined)?.root
  if (!root) return ''

  const parts: string[] = []
  const visit = (node: LexicalNode) => {
    if (typeof node.text === 'string' && node.text) parts.push(node.text)
    node.children?.forEach(visit)
  }
  visit(root)

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
