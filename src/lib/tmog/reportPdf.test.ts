import { cloneElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import type { Trademark } from '@/payload-types'
import { trademarkReportDocument, type TrademarkReport } from './reportPdf'

interface Node {
  type: string
  value?: string
  box?: { left: number; top: number; width: number; height: number }
  children?: Node[]
}
function placed(node: Node, x = 0, y = 0): { node: Node; x: number; y: number }[] {
  x += node.box?.left ?? 0
  y += node.box?.top ?? 0
  return [{ node, x, y }, ...(node.children ?? []).flatMap((child) => placed(child, x, y))]
}
function text(node: Node): string {
  return (node.value ?? '') + (node.children ?? []).map(text).join('')
}
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
}
const marks = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1,
  title: `MARK-${String(i).padStart(2, '0')} Café Élan`,
  serialNumber: String(90000000 + i),
  owner: 'Example Owner LLC',
  class: '34',
  publishedDate: '2026-10-13T00:00:00.000Z',
  goods:
    i === 4
      ? 'Long description of tobacco products and smoking accessories. '.repeat(160) +
        'END-OF-DESCRIPTION'
      : 'Electronic cigarettes; tobacco substitutes; smoking accessories.',
})) as Trademark[]

describe('trademark PDF layout', () => {
  it('preserves every record, supports long goods descriptions, and repeats branding and page numbers within margins', async () => {
    let layout: Node | undefined
    const report: TrademarkReport = {
      kind: 'weekly',
      title: 'Weekly US Trademark Report',
      period: 'Week ending October 13, 2026',
      generatedAt: new Date('2026-10-15'),
      sections: [{ title: 'Published for opposition', marks, dateField: 'publishedDate' }],
    }
    const bytes = await renderToBuffer(
      cloneElement(trademarkReportDocument(report), {
        onRender: (params) => {
          layout = (params as unknown as { _INTERNAL__LAYOUT__DATA_: Node })
            ._INTERNAL__LAYOUT__DATA_
        },
      }),
    )
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    const pages = layout!.children!
    expect(pages.length).toBeGreaterThan(3)
    const content = pages.map(text).join(' ')
    for (let i = 0; i < marks.length; i++)
      expect(content.split(`MARK-${String(i).padStart(2, '0')}`).length - 1).toBe(1)
    for (const [index, page] of pages.entries()) {
      expect(text(page)).toContain(`Page ${index + 1} of ${pages.length}`)
      expect(text(page)).toContain('US TRADEMARKS')
      expect(placed(page).filter(({ node }) => node.type === 'IMAGE')).toHaveLength(1)
      for (const { node, x, y } of placed(page).filter((item) =>
        ['TEXT', 'IMAGE'].includes(item.node.type),
      )) {
        expect(x).toBeGreaterThanOrEqual(48 - 0.1)
        expect(x + node.box!.width).toBeLessThanOrEqual(564 + 0.1)
        expect(y).toBeGreaterThanOrEqual(25 - 0.1)
        expect(
          y + node.box!.height,
          `${text(node).slice(0, 120)} ${JSON.stringify(node.box)}`,
        ).toBeLessThanOrEqual(768 + 0.1)
        const value = text(node)
        if (value.startsWith('NICOTINE360 |') || value.startsWith('Page ')) {
          expect(y).toBeCloseTo(752)
        } else if (value.includes('US TRADEMARKS') || node.type === 'IMAGE') {
          expect(y + node.box!.height).toBeLessThanOrEqual(60)
        } else if (node.type !== 'IMAGE' && !value.includes('US TRADEMARKS')) {
          expect(y).toBeGreaterThanOrEqual(86 - 0.1)
          expect(y + node.box!.height).toBeLessThanOrEqual(737 + 0.1)
        }
      }
    }
    expect(bytes.toString('latin1')).toContain('https://tsdr.uspto.gov/')
    // Inspect encoded PDF text too: renderer diagnostics alone can retain a
    // text node whose glyphs were clipped from the actual PDF.
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true })
    const pdf = await task.promise
    const encoded: string[] = []
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n)
        const actual = normalizeText(
          (await page.getTextContent()).items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' '),
        )
        encoded.push(actual)
        expect(actual).toContain(`Page ${n} of ${pdf.numPages}`)
        expect(actual).toContain('US TRADEMARKS')
      }
      expect(encoded.join(' ')).toContain('Café Élan')
      expect(encoded.join(' ')).toContain('END-OF-DESCRIPTION')
      expect(encoded.join(' ')).not.toMatch(/international class/i)
      for (let i = 0; i < marks.length; i++)
        expect(encoded.join(' ').split(`MARK-${String(i).padStart(2, '0')}`).length - 1).toBe(1)
    } finally {
      await task.destroy()
    }
  }, 30000)

  it('shows all three monthly sections, their dates, and a renewal owner/address without an original address', async () => {
    const report: TrademarkReport = {
      kind: 'monthly',
      title: 'Monthly US Trademark Activity',
      period: 'September 2026',
      generatedAt: new Date('2026-10-15'),
      sections: [
        {
          title: 'Published for opposition',
          dateField: 'publishedDate',
          marks: [{ ...marks[1], publishedDate: '2026-09-08' }],
        },
        { title: 'Cancellations', dateField: 'cancelledDate', marks: [] },
        {
          title: 'Renewals',
          dateField: 'renewedDate',
          marks: [
            {
              ...marks[0],
              renewedDate: '2026-09-22',
              renewal: { owner: 'New Owner', address: 'New Address' },
            },
          ],
        },
      ],
    }
    const bytes = await renderToBuffer(trademarkReportDocument(report))
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true })
    try {
      const pdf = await task.promise
      const texts: string[] = []
      for (let n = 1; n <= pdf.numPages; n++)
        texts.push(
          (await (await pdf.getPage(n)).getTextContent()).items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' '),
        )
      const content = normalizeText(texts.join(' '))
      for (const expected of [
        'Cancellations (0)',
        'Published for opposition (1)',
        'September 8, 2026',
        'Renewals (1)',
        'New Owner',
        'New Address',
        'September 22, 2026',
      ])
        expect(content).toContain(expected)
    } finally {
      await task.destroy()
    }
  })
})
