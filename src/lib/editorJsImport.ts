/**
 * Converts the old site's EditorJS-shaped `{"blocks":[...]}` JSON into plain
 * paragraph strings, for migrated content. Checked against the real data:
 * every block across 9,430 published articles is `type: "paragraph"` — no
 * headers, lists or images ever appear — so this deliberately only handles
 * that one block type rather than a full EditorJS-to-Lexical converter.
 */
export function editorJsToParagraphs(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return []
  const blocks = (raw as { blocks?: unknown }).blocks
  if (!Array.isArray(blocks)) return []
  return blocks
    .map((block) => {
      if (!block || typeof block !== 'object') return ''
      const data = (block as { type?: unknown; data?: unknown }).data
      if ((block as { type?: unknown }).type !== 'paragraph') return ''
      const text = (data as { text?: unknown } | undefined)?.text
      return typeof text === 'string' ? stripHtml(text) : ''
    })
    .filter((text) => text.length > 0)
}

/** Strips tags and decodes the handful of HTML entities seen in the old content — not a full HTML parser. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
