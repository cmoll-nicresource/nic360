import { editorJsToParagraphs, stripHtml } from './editorJsImport'
import { lexicalToPlainText } from './lexical'

/** PostgreSQL text COPY escapes must be decoded before parsing embedded JSON. */
export function decodePgCopyText(value: string | undefined): string | null {
  if (value == null || value === '\\N') return null
  return value.replace(/\\(x[\da-f]{1,2}|[0-7]{1,3}|[\s\S])/gi, (_, escaped: string) => {
    const simple: Record<string, string> = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
      '\\': '\\',
    }
    if (escaped in simple) return simple[escaped]
    if (/^[0-7]/.test(escaped)) return String.fromCharCode(parseInt(escaped, 8))
    if (escaped.startsWith('x')) return String.fromCharCode(parseInt(escaped.slice(1), 16))
    return escaped
  })
}

export type LegacyArticleText = {
  title: string
  shortAbstract?: string
  fullText?: string
  content?: string
  rawContent?: string
}
const comparable = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim()

/** The old news publication uses short_abstract, not full_text (usually empty). */
export function legacyArticleExcerpt(row: LegacyArticleText) {
  const title = comparable(decodePgCopyText(row.title) || '')
  const candidates = [
    ['short_abstract', row.shortAbstract],
    ['full_text', row.fullText],
    ['content', row.content],
  ] as const
  for (const [source, raw] of candidates) {
    const decoded = decodePgCopyText(raw)
    if (!decoded) continue
    try {
      const paragraphs = editorJsToParagraphs(JSON.parse(decoded))
      if (paragraphs.length && comparable(paragraphs.join(' ')) !== title)
        return { source, paragraphs }
    } catch {
      // A malformed candidate must not prevent use of a later valid source.
    }
  }
  const raw = decodePgCopyText(row.rawContent)
  const text = raw ? stripHtml(raw) : ''
  return text && comparable(text) !== title
    ? { source: 'raw_content' as const, paragraphs: [text] }
    : null
}

/** Only migration's exact fallback or a headline-only field is eligible for repair. */
export function canRepairLegacyArticleExcerpt(
  excerpt: unknown,
  title: string,
  old: LegacyArticleText,
) {
  const current = comparable(lexicalToPlainText(excerpt))
  const originalFallback = old.rawContent && old.rawContent !== '\\N' ? old.rawContent : old.title
  return !current || current === comparable(title) || current === comparable(originalFallback)
}
