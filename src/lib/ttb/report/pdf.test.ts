import { renderToBuffer } from '@react-pdf/renderer'
import { cloneElement } from 'react'
import { describe, expect, it } from 'vitest'

import type { Report, Table } from './model'
import { reportDocument } from './pdf'

// Renderer layout diagnostics let this test inspect physical cell positions,
// rather than trust pdftotext's reconstruction of borderless table columns.
// This shape is internal to @react-pdf/renderer; revisit it on renderer upgrades.
interface LayoutNode {
  type: string
  value?: string
  style?: { flexDirection?: string }
  box?: { left: number; top: number; width: number; height: number }
  children?: LayoutNode[]
}

function nodes(root: LayoutNode): LayoutNode[] {
  return [root, ...(root.children ?? []).flatMap(nodes)]
}

function placedNodes(root: LayoutNode, left = 0, top = 0): { node: LayoutNode; left: number; top: number }[] {
  const x = left + (root.box?.left ?? 0)
  const y = top + (root.box?.top ?? 0)
  return [{ node: root, left: x, top: y }, ...(root.children ?? []).flatMap((child) => placedNodes(child, x, y))]
}

function report(table: Table): Report {
  return {
    title: 'PDF regression fixture', subtitle: 'August 2026', notes: [],
    chapters: [{ partNo: 1, title: 'Wide tables', sections: [{
      landscape: true, header: 'Regression fixture', blocks: [{ kind: 'table', table }],
    }] }],
  }
}

const headers = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'YTD 2026', 'YTD 2025', 'Pct Chg']
const table: Table = {
  title: 'Wide summary with long labels and large legitimate values',
  widths: [3.4, ...Array(12).fill(1), 1.3, 1.3, 1], fontSize: 7,
  header: [{ cells: headers.map((text) => ({ text })) }],
  rows: Array.from({ length: 70 }, (_, i) => ({ cells: [
    { text: `Country ${i}: long description that should wrap within its cell` },
    ...Array.from({ length: 12 }, () => ({ text: '1,234,567', align: 'right' as const })),
    { text: '12,345,678,901', align: 'right' },
    { text: '11,234,567,890', align: 'right' },
    { text: '+9.9', align: 'right' },
  ] })),
}

describe('PDF table rendering', () => {
  it('writes internal cover links to unique chapter page destinations after pagination', async () => {
    const fixture = report(table)
    fixture.chapters.push({ partNo: 2, title: 'Second chapter', sections: [{ landscape: false, header: 'Second chapter', blocks: [{ kind: 'para', text: 'Second chapter starts here.' }] }] })
    const raw = (await renderToBuffer(reportDocument(fixture))).toString('latin1')
    expect(raw.match(/\/Subtype \/Link\b/g)).toHaveLength(2)
    const targets: string[] = []
    for (const part of [1, 2]) {
      expect(raw).toContain(`/S /GoTo\n/D (part-${part})`)
      const destination = new RegExp(`\\(part-${part}\\) \\[(\\d+) 0 R /XYZ`).exec(raw)
      expect(destination).not.toBeNull()
      targets.push(destination![1])
      const pageObject = new RegExp(`(?:^|\\n)${destination![1]} 0 obj\\n([\\s\\S]*?)endobj`).exec(raw)
      expect(pageObject?.[1]).toMatch(/\/Type \/Page\b/)
    }
    expect(new Set(targets).size).toBe(2)
  }, 15000)

  it('keeps every cell inside the page and preserves all rows through pagination', async () => {
    let layout: LayoutNode | undefined
    const document = cloneElement(reportDocument(report(table)), {
      onRender: (params) => {
        layout = (params as unknown as { _INTERNAL__LAYOUT__DATA_: LayoutNode })._INTERNAL__LAYOUT__DATA_
      },
    })
    const buffer = await renderToBuffer(document)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    expect(layout).toBeDefined()
    const pages = layout!.children!.slice(1) // exclude cover
    expect(pages.length).toBeGreaterThan(1)
    let rowCount = 0
    const bodyLabels: number[] = []
    for (const page of pages) {
      const rows = placedNodes(page).filter(({ node }) => node.style?.flexDirection === 'row')
      for (const { node: row, left, top } of rows) {
        rowCount++
        const text = nodes(row).map((n) => n.value ?? '').join('')
        const label = /Country (\d+):/.exec(text)
        if (label) bodyLabels.push(Number(label[1]))
        expect(left).toBeGreaterThanOrEqual(54 - 0.01)
        expect(left + row.box!.width).toBeLessThanOrEqual(738 + 0.01)
        expect(top).toBeGreaterThanOrEqual(54 - 0.01)
        expect(top + row.box!.height).toBeLessThanOrEqual(558 + 0.01)
        expect(row.children).toHaveLength(16)
        const cells = row.children!
        expect(cells.reduce((sum, cell) => sum + cell.box!.width, 0)).toBeCloseTo(684, 3)
        for (let i = 0; i < cells.length; i++) {
          const box = cells[i].box!
          expect(box.width).toBeGreaterThan(0)
          expect(box.left).toBeGreaterThanOrEqual(-0.01)
          expect(box.left + box.width).toBeLessThanOrEqual(row.box!.width + 0.01)
          if (i) expect(box.left).toBeGreaterThanOrEqual(cells[i - 1].box!.left + cells[i - 1].box!.width - 0.01)
        }
      }
    }
    // Exactly one table header per physical page containing body rows.
    expect(rowCount).toBe(70 + pages.length)
    expect(bodyLabels).toEqual(Array.from({ length: 70 }, (_, i) => i))
  }, 15000)

  it('repeats the active table title and both headers at real page breaks, never mid-table', async () => {
    function detailTable(category: string, count: number): Table {
      return {
        title: `${category} category`, fontSize: 7,
        widths: [3.2, ...Array(10).fill(1.25)],
        header: [
          { cells: [{ text: `${category} quantities` }, ...Array.from({ length: 10 }, () => ({ text: 'Value' }))] },
          { cells: [{ text: `${category} countries` }, ...Array.from({ length: 10 }, () => ({ text: 'YTD 2026' }))] },
        ],
        rows: Array.from({ length: count }, (_, i) => ({ cells: [
          { text: `${category} country ${i}${category === 'B' && i % 5 === 0 ? ': longer country label wrapping onto extra lines' : ''}` },
          ...Array.from({ length: 10 }, () => ({ text: '$123,456,789', align: 'right' as const })),
        ] })),
      }
    }
    const fixture = report(detailTable('A', 28))
    fixture.chapters[0].sections[0].blocks.push({ kind: 'table', table: detailTable('B', 56) })
    let layout: LayoutNode | undefined
    await renderToBuffer(cloneElement(reportDocument(fixture), {
      onRender: (params) => {
        layout = (params as unknown as { _INTERNAL__LAYOUT__DATA_: LayoutNode })._INTERNAL__LAYOUT__DATA_
      },
    }))
    const seen: Record<string, number[]> = { A: [], B: [] }
    const pages = layout!.children!.slice(1)
    expect(pages.length).toBeGreaterThan(2)
    for (const page of pages) {
      const allNodes = placedNodes(page)
      const [logo] = allNodes.filter(({ node }) => node.type === 'IMAGE')
      expect(logo.left).toBeCloseTo(54)
      expect(logo.top).toBeCloseTo(20)
      expect(logo.node.box!.width).toBeCloseTo(100)
      const [runningHeader] = allNodes.filter(({ node }) => node.type === 'TEXT' && nodes(node).some((n) => n.value === 'Regression fixture'))
      expect(runningHeader.top).toBeCloseTo(26)
      expect(runningHeader.left + runningHeader.node.box!.width).toBeLessThanOrEqual(738 + 0.01)
      const [footer] = allNodes.filter(({ node }) => node.type === 'TEXT' && /^Page \d+ of \d+$/.test(nodes(node).map((n) => n.value ?? '').join('')))
      expect(footer.top + footer.node.box!.height).toBeCloseTo(588)
      const rows = allNodes.filter(({ node }) => node.style?.flexDirection === 'row')
      for (const category of ['A', 'B']) {
        const categoryRows = rows.filter(({ node }) => nodes(node).some((n) => n.value?.startsWith(`${category} country `)))
        const titles = allNodes.filter(({ node }) => node.type === 'TEXT' && nodes(node).some((n) => n.value === `${category} category`))
        const groupHeaders = rows.filter(({ node }) => nodes(node).some((n) => n.value === `${category} quantities`))
        const columnHeaders = rows.filter(({ node }) => nodes(node).some((n) => n.value === `${category} countries`))
        // No stranded headers or old category headers on later-category pages.
        expect(titles).toHaveLength(categoryRows.length ? 1 : 0)
        expect(groupHeaders).toHaveLength(categoryRows.length ? 1 : 0)
        expect(columnHeaders).toHaveLength(categoryRows.length ? 1 : 0)
        if (!categoryRows.length) continue
        expect(titles[0].top).toBeLessThan(groupHeaders[0].top)
        expect(groupHeaders[0].top).toBeLessThan(columnHeaders[0].top)
        expect(columnHeaders[0].top + columnHeaders[0].node.box!.height).toBeLessThanOrEqual(categoryRows[0].top + 0.01)
        for (const { node, top } of categoryRows) {
          const text = nodes(node).map((n) => n.value ?? '').join('')
          seen[category].push(Number(new RegExp(`${category} country (\\d+)`).exec(text)![1]))
          expect(top + node.box!.height).toBeLessThanOrEqual(558 + 0.01)
        }
      }
    }
    expect(seen.A).toEqual(Array.from({ length: 28 }, (_, i) => i))
    expect(seen.B).toEqual(Array.from({ length: 56 }, (_, i) => i))
    // The first two categories can share a page; don't solve this by giving
    // every small table a mostly empty dedicated page.
    expect(pages.some((page) => {
      const text = nodes(page).map((n) => n.value ?? '').join('')
      return text.includes('A country') && text.includes('B country')
    })).toBe(true)
    expect(nodes(layout!).filter((n) => n.type === 'IMAGE')).toHaveLength(layout!.children!.length)
  }, 15000)

  it('rejects a row whose cell count does not match its column definitions', () => {
    const bad = { ...table, rows: [{ cells: [{ text: 'Only one cell' }] }] }
    expect(() => reportDocument(report(bad))).toThrow(/mismatched/)
  })

  it('keeps branding and page chrome inside the page when portrait sections precede wide tables', async () => {
    const fixture = report(table)
    fixture.chapters[0].sections.unshift({
      landscape: false, header: 'Portrait context',
      blocks: [{ kind: 'para', text: 'Narrative context before the wide summary tables. '.repeat(120) }],
    })
    let layout: LayoutNode | undefined
    await renderToBuffer(cloneElement(reportDocument(fixture), {
      onRender: (params) => {
        layout = (params as unknown as { _INTERNAL__LAYOUT__DATA_: LayoutNode })._INTERNAL__LAYOUT__DATA_
      },
    }))
    const pages = layout!.children!.slice(1)
    expect(pages.some((p) => p.box!.width === 612)).toBe(true)
    expect(pages.some((p) => p.box!.width === 792)).toBe(true)
    for (const page of pages) {
      const contents = placedNodes(page)
      const [logo] = contents.filter(({ node }) => node.type === 'IMAGE')
      expect(logo.left).toBeCloseTo(page.box!.width === 792 ? 54 : 72)
      expect(logo.top).toBeCloseTo(20)
      const chrome = contents.filter(({ node }) => node.type === 'TEXT' && nodes(node).some((n) => /Portrait context|Regression fixture|^Page /.test(n.value ?? '')))
      expect(chrome).toHaveLength(2)
      for (const { node, left, top } of chrome) {
        expect(left).toBeGreaterThan(0)
        expect(left + node.box!.width).toBeLessThanOrEqual(page.box!.width - 54 + 0.01)
        expect(top).toBeGreaterThan(0)
        expect(top + node.box!.height).toBeLessThanOrEqual(page.box!.height - 24 + 0.01)
      }
    }
  }, 15000)

  it.each([0, -1, NaN, Infinity])('rejects invalid relative widths (%j)', (width) => {
    expect(() => reportDocument(report({ ...table, widths: [width, ...table.widths.slice(1)] }))).toThrow(/widths/)
  })

  it.each([0, -1, NaN, Infinity])('rejects invalid font sizes (%j)', (fontSize) => {
    expect(() => reportDocument(report({ ...table, fontSize }))).toThrow(/font size/)
  })
})
