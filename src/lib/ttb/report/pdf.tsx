// Renders the same format-neutral Report model docx.ts renders, as a PDF
// instead of a Word document — built new (no PDF rendering existed in nic360
// before this), using the existing chapters/data/format/text/chart layer.
// See model.ts for the Block/Table/Row/Cell shapes this walks.
//
// The installed renderer's new pagination engine measures rows and scopes
// fixed elements to their immediate parent. A fixed title/header inside a
// table repeats only when that table crosses a physical page boundary.
// No estimated row chunks: adjacent tables can share pages without spurious
// headers in the middle of a table or headerless continuation pages.
import { Document, Image, Link, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer'
import fs from 'node:fs'
import path from 'node:path'
import type { ComponentProps, ReactElement } from 'react'

import type { Block, Report, Row, Table as TableModel } from './model'
import { assertReportReady } from './readiness'

const FONT = 'Helvetica'
const ACCENT = '#285888'
const MUTED = '#595959'

// US Letter in points (72pt/in), matching docx.ts's margins (0.75in top/bottom
// always; 1in sides portrait, 0.75in sides landscape).
const PAGE_W = 612
const MARGIN = {
  portrait: { top: 54, bottom: 54, left: 72, right: 72 },
  landscape: { top: 54, bottom: 54, left: 54, right: 54 },
}

function usableWidth(landscape: boolean): number {
  const m = landscape ? MARGIN.landscape : MARGIN.portrait
  const pageW = landscape ? 792 : PAGE_W
  return pageW - m.left - m.right
}

/**
 * Explicit per-column widths in points, not percentage strings. With 15-16
 * sibling cells in a row, explicit widths keep the layout predictable.
 * Reconcile the rounding remainder onto the widest column so the widths
 * sum to the available content width. The original overlapping digits
 * were primarily caused by concatenated database numeric strings (see
 * data.ts); column sizing alone could not correct those invalid figures.
 */
function columnWidthsPt(widths: number[], contentWidth: number): number[] {
  if (!widths.length || widths.some((w) => !Number.isFinite(w) || w <= 0)) {
    throw new Error('PDF table column widths must be finite and positive')
  }
  const totalW = widths.reduce((a, b) => a + b, 0)
  const raw = widths.map((w) => (w / totalW) * contentWidth)
  const floored = raw.map(Math.floor)
  const remainder = Math.round(contentWidth - floored.reduce((a, b) => a + b, 0))
  const widestIndex = widths.indexOf(Math.max(...widths))
  floored[widestIndex] += remainder
  if (floored.some((w) => w < 1)) throw new Error('PDF table column is too narrow')
  return floored
}

const styles = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 11, paddingTop: 54, paddingBottom: 54, paddingHorizontal: 72 },
  pageLandscape: { fontFamily: FONT, fontSize: 11, paddingTop: 54, paddingBottom: 54, paddingHorizontal: 54 },
  runningHeader: { position: 'absolute', top: 26, left: 180, right: 54, textAlign: 'right', fontSize: 7.5, color: MUTED },
  runningFooter: { position: 'absolute', bottom: 24, right: 54, textAlign: 'right', fontSize: 8, color: '#7F7F7F' },
  h1: { fontSize: 20, fontWeight: 700, color: ACCENT, marginBottom: 10, marginTop: 6 },
  h2: { fontSize: 15, fontWeight: 700, color: ACCENT, marginBottom: 8, marginTop: 10 },
  h3: { fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6, marginTop: 8 },
  para: { fontSize: 10, lineHeight: 1.4, marginBottom: 8, textAlign: 'justify' },
  tableTitle: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row' },
  cellBase: { paddingVertical: 2, paddingHorizontal: 2 },
  headerCell: { backgroundColor: '#DCE6F2' },
  shadeCell: { backgroundColor: '#EDF2F9' },
})

/** Readiness validation rejects editorial markers before any PDF is built. */
function textRuns(text: string, size: number, extra?: Record<string, unknown>): ReactElement {
  return <Text style={{ fontSize: size, ...extra }}>{text}</Text>
}

function cellStyle(c: Row['cells'][number]): Record<string, unknown> {
  return {
    textAlign: c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left',
    paddingLeft: (c.indent ?? 0) * 8 + 2,
    fontWeight: c.bold ? 700 : 400,
  }
}

function tableRow(key: number | string, r: Row, colWidthsPt: number[], isHeader: boolean, fontSize: number): ReactElement {
  return (
    <View key={key} style={[styles.row, isHeader ? styles.headerCell : r.shade ? styles.shadeCell : undefined]} wrap={false}>
      {r.cells.map((c, i) => (
        <View key={i} style={[styles.cellBase, { width: colWidthsPt[i], flexShrink: 0, flexGrow: 0 }]}>
          <Text style={{ fontSize, ...cellStyle(c), fontWeight: r.bold || c.bold || isHeader ? 700 : 400 }}>{c.text}</Text>
        </View>
      ))}
    </View>
  )
}

function tableBlock(t: TableModel, landscape: boolean): ReactElement {
  if ([...t.header, ...t.rows].some((r) => r.cells.length !== t.widths.length)) {
    throw new Error(`PDF table "${t.title ?? 'untitled'}" has mismatched cells and column widths`)
  }
  const fontSize = t.fontSize ?? 8
  if (!Number.isFinite(fontSize) || fontSize <= 0) throw new Error('PDF table font size must be finite and positive')
  const colWidthsPt = columnWidthsPt(t.widths, usableWidth(landscape))
  return (
    <View style={{ marginBottom: 8 }}>
      <View fixed wrap={false} minPresenceAhead={fontSize * 2 + 4}>
        {t.title && <Text style={styles.tableTitle}>{t.title}</Text>}
        {t.header.map((r, i) => tableRow(`h${i}`, r, colWidthsPt, true, fontSize))}
      </View>
      {t.rows.map((r, i) => tableRow(`r${i}`, r, colWidthsPt, false, fontSize))}
    </View>
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
          {/* react-pdf Image is a PDF primitive, not an HTML image. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={b.png} style={{ width: b.width * 0.75, height: b.height * 0.75 }} />
        </View>
      )
    case 'table':
      return <View key={key}>{tableBlock(b.table, landscape)}</View>
    case 'pageBreak':
      return <View key={key} break />
  }
}

export function reportDocument(report: Report): ReactElement<ComponentProps<typeof Document>> {
  assertReportReady(report)
  const pages: ReactElement[] = []
  // Read the tracked asset, not an absolute workstation path or a remote URL.
  const logo = { data: fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png')), format: 'png' as const }

  // Cover / contents
  pages.push(
    <Page key="cover" size="LETTER" style={styles.page} experimentalPagination>
      <View style={{ marginTop: 90, alignItems: 'center' }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF primitive */}
        <Image src={logo} style={{ width: 360, height: 360 * 424 / 2182, marginBottom: 38 }} />
        <Text style={{ fontSize: 28, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>{report.title}</Text>
        <Text style={{ fontSize: 18, color: MUTED, marginBottom: 24 }}>{report.subtitle}</Text>
        {report.chapters.map((c, i) => (
          <Link key={i} src={`#part-${c.partNo}`} style={{ fontSize: 12, marginBottom: 4, color: ACCENT, textDecoration: 'underline' }}>
            Part {c.partNo}: {c.title}
          </Link>
        ))}
      </View>
    </Page>,
  )

  for (const ch of report.chapters) {
    ch.sections.forEach((s, i) => {
      pages.push(
        <Page key={`${ch.partNo}-${i}`} size="LETTER" orientation={s.landscape ? 'landscape' : 'portrait'} style={s.landscape ? styles.pageLandscape : styles.page}
          layout={({ children, pageNumber, totalPages }) => (
            <>
              {/* Page chrome is instantiated afresh, outside the table flow. */}
              {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF primitive */}
              <Image src={logo} style={{ position: 'absolute', top: 20, left: s.landscape ? 54 : 72, width: 100, height: 100 * 424 / 2182 }} />
              <Text style={styles.runningHeader}>
                {s.header.replace(/^TMA Tobacco Trade Barometer/, 'US Tobacco Trade Barometer')}
              </Text>
              <Text style={styles.runningFooter}>Page {pageNumber} of {totalPages}</Text>
              {children}
            </>
          )}>
          {i === 0 && (
            <View id={`part-${ch.partNo}`} style={styles.h1} wrap={false}>
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

  return <Document title={`${report.title} ${report.subtitle}`}>{pages}</Document>
}

export async function renderPdf(report: Report): Promise<Buffer> {
  return renderToBuffer(reportDocument(report))
}
