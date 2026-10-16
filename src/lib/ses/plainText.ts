/** A readable alternative for the trusted editor-rendered newsletter HTML. */
export function newsletterPlainText(html: string): string {
  return html
    .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<(br|\/p|\/div|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#\d+|#x[\da-f]+);/gi, (whole, entity: string) => {
      const named: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
        '#39': "'",
      }
      const key = entity.toLowerCase()
      if (key in named) return named[key]
      const code = key.startsWith('#x') ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10)
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
