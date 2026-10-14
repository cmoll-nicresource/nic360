import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, Packer, PageNumber,
  PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  type ISectionOptions,
} from "docx";
import type { Block, Report, Row, Table as TableModel } from "./model";

const FONT = "Calibri";
const ACCENT = "2E6DB4";

/** Splits text on [[...]] markers; placeholders are highlighted so the editor can find them. */
function runs(text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}): TextRun[] {
  return text.split(/(\[\[[\s\S]*?\]\])/).filter(Boolean).map((part) => {
    const ph = part.startsWith("[[") && part.endsWith("]]");
    return new TextRun({
      text: ph ? part.slice(2, -2) : part, font: FONT, bold: opts.bold, italics: opts.italic || ph,
      size: opts.size, highlight: ph ? "yellow" : undefined,
    });
  });
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const borders = (bottom = false) => ({
  top: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  bottom: bottom ? { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" } : NO_BORDER,
});

function tableBlock(t: TableModel, landscape: boolean): (Paragraph | Table)[] {
  const size = Math.round((t.fontSize ?? 8) * 2);
  const totalW = t.widths.reduce((a, b) => a + b, 0);
  const pageW = landscape ? 13680 : 9360; // twips inside 0.75"/1" margins
  const colW = t.widths.map((w) => Math.round((w / totalW) * pageW));
  const row = (r: Row, isHeader: boolean, lastHeader: boolean) => new TableRow({
    tableHeader: isHeader,
    cantSplit: true,
    children: r.cells.map((c, i) => new TableCell({
      width: { size: colW[i], type: WidthType.DXA },
      borders: borders(lastHeader || !!r.shade),
      shading: r.shade ? { type: ShadingType.CLEAR, fill: "EDF2F9", color: "auto" } : isHeader ? { type: ShadingType.CLEAR, fill: "DCE6F2", color: "auto" } : undefined,
      margins: { top: 10, bottom: 10, left: 40, right: 40 },
      children: [new Paragraph({
        alignment: c.align === "right" ? AlignmentType.RIGHT : c.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        indent: c.indent ? { left: c.indent * 160 } : undefined,
        spacing: { before: 0, after: 0 },
        children: runs(c.text, { bold: r.bold || c.bold || isHeader, size }),
      })],
    })),
  });
  const out: (Paragraph | Table)[] = [];
  if (t.title) {
    out.push(new Paragraph({ spacing: { before: 200, after: 60 }, keepNext: true, children: runs(t.title, { bold: true, size: size + 2 }) }));
  }
  out.push(new Table({
    width: { size: pageW, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      ...t.header.map((r, i) => row(r, true, i === t.header.length - 1)),
      ...t.rows.map((r) => row(r, false, false)),
    ],
  }));
  out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return out;
}

function blockToDocx(b: Block, landscape: boolean): (Paragraph | Table)[] {
  switch (b.kind) {
    case "heading":
      return [new Paragraph({
        heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        keepNext: true,
        children: [new TextRun({ text: b.text, font: FONT, color: ACCENT })],
      })];
    case "para":
      return [new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.JUSTIFIED, children: runs(b.text, { italic: b.italic, size: 22 }) })];
    case "chart":
      return [new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 },
        children: [new ImageRun({ type: "png", data: b.png, transformation: { width: b.width, height: b.height } })],
      })];
    case "table":
      return tableBlock(b.table, landscape);
    case "pageBreak":
      return [new Paragraph({ pageBreakBefore: true, children: [] })];
  }
}

export async function renderDocx(report: Report): Promise<Buffer> {
  const sections: ISectionOptions[] = [];
  // Cover / contents
  sections.push({
    properties: { page: { size: { width: 12240, height: 15840 } } },
    children: [
      new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: report.title, font: FONT, size: 56, bold: true, color: ACCENT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: report.subtitle, font: FONT, size: 36, color: "595959" })] }),
      ...report.chapters.map((c) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Part ${c.partNo}: ${c.title}`, font: FONT, size: 24 })] })),
      ...(report.notes.length
        ? [new Paragraph({ spacing: { before: 600 }, children: runs("Data notes", { bold: true }) }),
          ...report.notes.map((n) => new Paragraph({ bullet: { level: 0 }, children: runs(`[[${n}]]`) }))]
        : []),
      new Paragraph({ spacing: { before: 600 }, children: runs("Highlighted text marks placeholders and editor notes that need a person’s input before publishing.", { italic: true, size: 18 }) }),
    ],
  });
  for (const ch of report.chapters) {
    ch.sections.forEach((s, i) => {
      const children: (Paragraph | Table)[] = [];
      if (i === 0) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `Part ${ch.partNo}: ${ch.title}`, font: FONT, color: ACCENT })] }));
      }
      for (const b of s.blocks) children.push(...blockToDocx(b, s.landscape));
      sections.push({
        properties: {
          page: {
            size: s.landscape ? { orientation: PageOrientation.LANDSCAPE, width: 12240, height: 15840 } : { width: 12240, height: 15840 },
            margin: { top: 1080, bottom: 1080, left: s.landscape ? 1080 : 1440, right: s.landscape ? 1080 : 1440 },
          },
        },
        headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: s.header, font: FONT, size: 18, color: "595959" })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], font: FONT, size: 16, color: "7F7F7F" })] })] }) },
        children,
      });
    });
  }
  const doc = new Document({
    creator: "ttb-trade",
    title: `${report.title} ${report.subtitle}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections,
  });
  return Packer.toBuffer(doc);
}
