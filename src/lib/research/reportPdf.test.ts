import { expect, it } from 'vitest'
import type { Research } from '@/payload-types'
import { lexicalFromParagraphs } from '@/lib/lexical'
import { renderResearchDigest } from './reportPdf'
it('renders complete multi-page abstracts, author/date/DOI fields and working contents destinations', async () => {
  const article = {
    id: 1,
    title: 'Research on café, nicotine and drought',
    authors: 'María Example; Second Author',
    publishedDate: '2026-05-31T23:59:59Z',
    doiLink: 'https://doi.org/10.1234/research',
    body: lexicalFromParagraphs(
      Array.from(
        { length: 22 },
        (_, i) =>
          `PARAGRAPH-${i} ${'Independent synthetic abstract content about the effects of nicotine on transgenic tobacco and soil. '.repeat(8)} END-${i}`,
      ),
    ),
  } as unknown as Research
  const bytes = await renderResearchDigest({
    title: 'Monthly Research Digest',
    month: '2026-05',
    generatedAt: new Date('2026-06-02'),
    groups: [{ journal: 'Synthetic Journal', articles: [article] }],
  })
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
  })
  try {
    const pdf = await task.promise
    expect(pdf.numPages).toBeGreaterThan(2)
    const texts: string[] = [],
      links: string[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const text = (await page.getTextContent()).items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      texts.push(text)
      expect(text).toContain(`Page ${n} of ${pdf.numPages}`)
      for (const annotation of await page.getAnnotations())
        if (annotation.url) links.push(annotation.url)
    }
    const all = texts.join(' ')
    for (let i = 0; i < 22; i++) expect(all).toContain(`END-${i}`)
    expect(all).toContain('María Example; Second Author')
    expect(all).toContain('May 2026')
    expect(links).toContain(article.doiLink)
    expect(await pdf.getDestination('research-1')).not.toBeNull()
    expect(await pdf.getDestination('contents')).not.toBeNull()
  } finally {
    await task.destroy()
  }
}, 30000)
