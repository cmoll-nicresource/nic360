import sharp from 'sharp'
import { expect, it } from 'vitest'

import { digestAnchor, renderDigestPdf, type DigestInput } from './digestPdf'

const paragraph = (n: number) =>
  `<p>PARA-${n} ${'Synthetic story text about excise duties, nicotine pouches and the Tobacco Products Directive in Māori, € and ₱ terms. '.repeat(5)}END-${n}</p>`

it('renders linked contents with correct page numbers, the ad after the contents, and story sources', async () => {
  const png = await sharp({ create: { width: 1200, height: 600, channels: 3, background: '#88aa33' } }).png().toBuffer()
  const input: DigestInput = {
    title: 'Weekly Executive Summary',
    dateLabel: 'November 6, 2026',
    ad: { png, width: 1200, height: 600, href: 'https://nicotine360.org/api/ads/5/click' },
    groups: [10, 11, 12].map((headingId, g) => ({
      heading: { id: headingId, title: `HEADING-${g}` },
      stories: Array.from({ length: 6 }, (_, i) => {
        const id = g * 10 + i + 1
        return {
          id,
          headline: `HEADLINE-${id} Malta Blocks EU Tobacco Tax Overhaul`,
          bodyHtml: paragraph(id) + paragraph(id + 100) + '<ul><li>Health warnings</li></ul>',
          sources: [
            { name: `SOURCE-${id}`, url: `https://example.com/source-${id}` },
            { name: 'Antara News Agency', url: null },
          ],
          url: `https://tobaccoreporter.com/story-${id}/`,
        }
      }),
    })),
  }
  const { pdf, pages } = await renderDigestPdf(input)

  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({ data: new Uint8Array(pdf), disableFontFace: true })
  try {
    const doc = await task.promise
    expect(doc.numPages).toBeGreaterThan(5)
    const texts: string[] = []
    const links: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      texts.push(
        (await page.getTextContent()).items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' '),
      )
      for (const annotation of await page.getAnnotations()) if (annotation.url) links.push(annotation.url)
      expect(texts[n - 1]).toContain(`Page ${n} of ${doc.numPages}`)
    }
    const all = texts.join(' ')
    for (const group of input.groups)
      for (const story of group.stories) {
        expect(all).toContain(`END-${story.id}`)
        expect(all).toContain(`END-${story.id + 100}`)
        expect(links).toContain(`https://example.com/source-${story.id}`)
        // The contents page number is where the story's destination really is.
        const anchor = digestAnchor.story(story.id)
        const dest = await doc.getDestination(anchor)
        const actual = (await doc.getPageIndex(dest![0] as { num: number; gen: number })) + 1
        expect(pages.get(anchor)).toBe(actual)
        expect(texts[actual - 1]).toContain(`HEADLINE-${story.id}`)
      }
    expect(all).toContain('Source: Antara News Agency')
    expect(all).toContain('Māori')
    expect(links).toContain('https://nicotine360.org/api/ads/5/click')
    // The ad and contents sit before the first section.
    expect(texts[0]).toContain('Contents')
    const firstSection = pages.get(digestAnchor.heading(10))!
    expect(firstSection).toBeGreaterThan(1)
    expect(texts.slice(0, firstSection - 1).join(' ')).toContain('ADVERTISEMENT')
    expect(texts[firstSection - 1]).not.toContain('ADVERTISEMENT')
    expect(await doc.getDestination('contents')).not.toBeNull()
  } finally {
    await task.destroy()
  }
}, 60000)
