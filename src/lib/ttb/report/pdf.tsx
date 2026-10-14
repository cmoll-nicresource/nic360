// Renders the same format-neutral Report model docx.ts renders, as a PDF
// instead of a Word document — built new (no PDF rendering existed in nic360
// before this), reusing 100% of chapters.ts/data.ts/format.ts/text.ts/chart.ts
// unchanged. See model.ts for the Block/Table/Row/Cell shapes this walks.
//
// react-pdf auto-paginates a Page's overflowing content and repeats any
// `fixed` element (the running header/footer below) on every page that
// overflow generates — so, unlike docx.ts, this doesn't need to create
// physical pages by hand. The one thing react-pdf does NOT repeat
// automatically is a table's own column-header row when its body rows split
// across pages (model.ts's own comment: header rows are "repeated on each
// page"), so paginateRows() below chunks each table's rows to a
// conservative per-page estimate and renders each chunk as its own
// non-splitting (wrap={false}) block with the header reprinted at the top —
// the PDF equivalent of docx.ts's `tableHeader: true`.
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

import type { Block, Report, Row, Table as TableModel } from './model'

const FONT = 'Helvetica'
const ACCENT = '#2E6DB4'
const MUTED = '#595959'

// US Letter in points (72pt/in), matching docx.ts's margins (0.75in top/bottom
// always; 1in sides portrait, 0.75in sides landscape).
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = {
  portrait: { top: 54, bottom: 54, left: 72, right: 72 },
  landscape: { top: 54, bottom: 54, left: 54, right: 54 },
}

function usableHeight(landscape: boolean): number {
  const m = landscape ? MARGIN.landscape : MARGIN.portrait
  const pageH = landscape ? PAGE_W : PAGE_H
  return pageH - m.top - m.bottom
}

const styles = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 11, paddingTop: 54, paddingBottom: 54, paddingHorizontal: 72 },
  pageLandscape: { fontFamily: FONT, fontSize: 11, paddingTop: 54, paddingBottom: 54, paddingHorizontal: 54 },
  runningHeader: { position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: MUTED },
  runningFooter: { position: 'absolute', bottom: 24, right: 54, textAlign: 'right', fontSize: 8, color: '#7F7F7F' },
  h1: { fontSize: 20, fontWeight: 700, color: ACCENT, marginBottom: 10, marginTop: 6 },
  h2: { fontSize: 15, fontWeight: 700, color: ACCENT, marginBottom: 8, marginTop: 10 },
  h3: { fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6, marginTop: 8 },
  para: { fontSize: 10, lineHeight: 1.4, marginBottom: 8, textAlign: 'justify' },
  placeholder: { backgroundColor: '#FFFF00' },
  italic: { fontStyle: 'italic' },
  tableTitle: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row' },
  cellBase: { paddingVertical: 2, paddingHorizontal: 2 },
  headerCell: { backgroundColor: '#DCE6F2' },
  shadeCell: { backgroundColor: '#EDF2F9' },
})

/** Splits text on [[...]] markers; placeholders are highlighted so the editor can find them. */
function textRuns(text: string, size: number, extra?: Record<string, unknown>): ReactElement {
  const parts = text.split(/(\[\[[\s\S]*?\]\])/).filter(Boolean)
  return (
    <Text style={{ fontSize: size, ...extra }}>
      {parts.map((part, i) => {
        const ph = part.startsWith('[[') && part.endsWith(']]')
        return (
          <Text key={i} style={ph ? [styles.placeholder, styles.italic] : undefined}>
            {ph ? part.slice(2, -2) : part}
          </Text>
        )
      })}
    </Text>
  )
}

/** Conservative rows-per-page estimate for a table at its own font size, in the section's orientation. */
function rowsPerPage(table: TableModel, landscape: boolean): number {
  const fontSize = table.fontSize ?? 8
  const rowHeight = fontSize * 1.5 + 4
  const headerHeight = table.header.length * rowHeight
  const titleHeight = table.title ? 20 : 0
  const available = usableHeight(landscape) * 0.88 - headerHeight - titleHeight
  return Math.max(3, Math.floor(available / rowHeight))
}

/** Splits a table's body rows into page-sized chunks, each reprinting the header. */
function paginateRows(table: TableModel, landscape: boolean): Row[][] {
  const perPage = rowsPerPage(table, landscape)
  if (table.rows.length <= perPage) return [table.rows]
  const chunks: Row[][] = []
  for (let i = 0; i < table.rows.length; i += perPage) chunks.push(table.rows.slice(i, i + perPage))
  return chunks
}

function cellStyle(c: Row['cells'][number]): Record<string, unknown> {
  return {
    textAlign: c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left',
    paddingLeft: (c.indent ?? 0) * 8 + 2,
    fontWeight: c.bold ? 700 : 400,
  }
}

function tableRow(key: number | string, r: Row, widths: number[], isHeader: boolean, fontSize: number): ReactElement {
  const totalW = widths.reduce((a, b) => a + b, 0)
  return (
    <View key={key} style={[styles.row, isHeader ? styles.headerCell : r.shade ? styles.shadeCell : undefined]} wrap={false}>
      {r.cells.map((c, i) => (
        <View key={i} style={[styles.cellBase, { width: `${(widths[i] / totalW) * 100}%` }]}>
          <Text style={{ fontSize, ...cellStyle(c), fontWeight: r.bold || c.bold || isHeader ? 700 : 400 }}>{c.text}</Text>
        </View>
      ))}
    </View>
  )
}

function tableBlock(t: TableModel, landscape: boolean): ReactElement {
  const fontSize = t.fontSize ?? 8
  const chunks = paginateRows(t, landscape)
  return (
    <>
      {t.title && <Text style={styles.tableTitle}>{t.title}</Text>}
      {chunks.map((chunk, ci) => (
        <View key={ci} wrap={false} style={{ marginBottom: ci === chunks.length - 1 ? 8 : 0 }} break={ci > 0}>
          {t.header.map((r, i) => tableRow(`h${i}`, r, t.widths, true, fontSize))}
          {chunk.map((r, i) => tableRow(`r${i}`, r, t.widths, false, fontSize))}
        </View>
      ))}
    </>
  )
}

function blockToPdf(b: Block, landscape: boolean, key: number): ReactElement {
  switch (b.kind) {
    case 'heading':
      return (
        <View key={key} style={b.level === 1 ? styles.h1 : b.level === 2 ? styles.h2 : styles.h3} wrap={false}>
          <Text>{b.text}</Text>
        </View>
      )
    case 'para':
      return (
        <View key={key} style={styles.para} wrap>
          {textRuns(b.text, 10, b.italic ? { fontStyle: 'italic' } : undefined)}
        </View>
      )
    case 'chart':
      return (
        <View key={key} style={{ alignItems: 'center', marginVertical: 8 }} wrap={false}>
          <Image src={b.png} style={{ width: b.width * 0.75, height: b.height * 0.75 }} />
        </View>
      )
    case 'table':
      return <View key={key}>{tableBlock(b.table, landscape)}</View>
    case 'pageBreak':
      return <View key={key} break />
  }
}

export async function renderPdf(report: Report): Promise<Buffer> {
  const pages: ReactElement[] = []

  // Cover / contents
  pages.push(
    <Page key="cover" size="LETTER" style={styles.page}>
      <View style={{ marginTop: 160, alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>{report.title}</Text>
        <Text style={{ fontSize: 18, color: MUTED, marginBottom: 24 }}>{report.subtitle}</Text>
        {report.chapters.map((c, i) => (
          <Text key={i} style={{ fontSize: 12, marginBottom: 4 }}>
            Part {c.partNo}: {c.title}
          </Text>
        ))}
        {report.notes.length > 0 && (
          <View style={{ marginTop: 24, alignSelf: 'stretch' }}>
            <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Data notes</Text>
            {report.notes.map((n, i) => (
              <Text key={i} style={{ fontSize: 9, marginBottom: 3 }}>
                • {textContentOnly(n)}
              </Text>
            ))}
          </View>
        )}
        <Text style={{ fontSize: 9, fontStyle: 'italic', color: MUTED, marginTop: 24 }}>
          Highlighted text marks placeholders and editor notes that need a person&apos;s input before publishing.
        </Text>
      </View>
    </Page>,
  )

  for (const ch of report.chapters) {
    ch.sections.forEach((s, i) => {
      pages.push(
        <Page key={`${ch.partNo}-${i}`} size="LETTER" orientation={s.landscape ? 'landscape' : 'portrait'} style={s.landscape ? styles.pageLandscape : styles.page}>
          <Text style={styles.runningHeader} fixed>
            {s.header}
          </Text>
          <Text style={styles.runningFooter} fixed render={({ pageNumber }) => `Page ${pageNumber}`} />
          {i === 0 && (
            <View style={styles.h1} wrap={false}>
              <Text>
                Part {ch.partNo}: {ch.title}
              </Text>
            </View>
          )}
          {s.blocks.map((b, bi) => blockToPdf(b, s.landscape, bi))}
        </Page>,
      )
    })
  }

  const buffer = await renderToBuffer(<Document title={`${report.title} ${report.subtitle}`}>{pages}</Document>)
  return buffer
}

/** Strips [[...]] markers for the plain-text notes list on the cover page. */
function textContentOnly(s: string): string {
  return s.replace(/\[\[([\s\S]*?)\]\]/g, '$1')
}
