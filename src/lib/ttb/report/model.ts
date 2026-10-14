// A small, format-neutral description of the report. chapters.ts builds it; docx.ts renders it.

export type Block =
  | { kind: "heading"; text: string; level: 1 | 2 | 3 }
  /** Text may contain [[...]] markers: editorial placeholders rendered highlighted. */
  | { kind: "para"; text: string; italic?: boolean }
  | { kind: "chart"; png: Buffer; width: number; height: number }
  | { kind: "table"; table: Table }
  | { kind: "pageBreak" };

export interface Cell { text: string; bold?: boolean; indent?: number; align?: "left" | "right" | "center" }
export interface Row { cells: Cell[]; bold?: boolean; shade?: boolean; heading?: boolean }
export interface Table {
  title?: string;
  /** Header rows (repeated on each page). */
  header: Row[];
  rows: Row[];
  /** Relative column widths. */
  widths: number[];
  fontSize?: number;
}

/** A run of pages sharing an orientation (narrative portrait, wide tables landscape). */
export interface Section { landscape: boolean; header: string; blocks: Block[] }

export interface Chapter { partNo: number; title: string; sections: Section[] }

export interface Report { title: string; subtitle: string; chapters: Chapter[]; notes: string[] }
