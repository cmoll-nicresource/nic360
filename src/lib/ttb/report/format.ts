// Number and phrase formatting in the style of the published Trade Barometer.
//
// A rounded figure gets a qualifier when the rounding hides a visible amount:
// "over"/"more than" when the exact value is above what is shown, "nearly"/"almost"
// when it is below. When the next digit would round to zero, no qualifier is used
// ($215,604,059 -> "$215.6 million", $580,627,666 -> "over $580.6 million").

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];
const COUNT_WORDS = ["", "first", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve"];

export const monthName = (mo: number) => MONTHS[mo - 1];

let flip = 0;
/** Alternates between the two synonyms so the text doesn't repeat itself. */
function word(above: boolean): string {
  flip++;
  if (above) return flip % 2 ? "over" : "more than";
  return flip % 2 ? "nearly" : "almost";
}
export function resetWording() { flip = 0; }

const int = (n: number) => Math.round(n).toLocaleString("en-US");

/** Rounds `x` to a multiple of `step`; returns the rounded value and its qualifier. */
function rounded(x: number, step: number): { v: number; q: string } {
  const v = Math.round(x / step) * step;
  const r = (x - v) / step;
  return { v, q: Math.abs(r) < 0.05 ? "" : word(r > 0) };
}

const withQ = (q: string, text: string) => (q ? `${q} ${text}` : text);

/** Billions with 2 decimals, millions with 1, otherwise the exact whole number. */
function mag(x: number): { text: string; q: string } {
  const a = Math.abs(x);
  if (a >= 1e9) { const r = rounded(a, 1e7); return { text: `${(r.v / 1e9).toFixed(2)} billion`, q: r.q }; }
  if (a >= 1e6) { const r = rounded(a, 1e5); return { text: `${(r.v / 1e6).toFixed(1)} million`, q: r.q }; }
  return { text: int(a), q: "" };
}

/** One-decimal number with qualifier, e.g. percentages and ratios. */
function one(x: number): { text: string; q: string } {
  const r = rounded(x, 0.1);
  return { text: r.v.toFixed(1), q: r.q };
}

/** "over $580.6 million", "$931,588", "nearly $1.3 million". */
export function money(x: number, qualify = true): string {
  const m = mag(x);
  return withQ(qualify ? m.q : "", `$${m.text}`);
}

/** Pieces, kilograms, dozens etc. for a Census unit. THS quantities are thousands of pieces. */
export function quantity(x: number, unit: string | null, qualify = true, noun?: string): string {
  let n = x;
  let label = noun ?? "units";
  switch (unit) {
    case "KG": label = noun ?? "kilograms"; break;
    case "THS": n = x * 1000; label = noun ?? "pieces"; break;
    case "NO": label = noun ?? "pieces"; break;
    case "DOZ": label = noun ?? "dozen"; break;
    case "GRS": label = noun ?? "gross blocks"; break;
  }
  const m = mag(n);
  return withQ(qualify ? m.q : "", `${m.text} ${label}`);
}

export interface Change { kind: "none" | "new" | "gone" | "flat" | "up" | "down"; pct: number; ratio: number }

export function change(cur: number, prev: number): Change {
  if (!cur && !prev) return { kind: "none", pct: 0, ratio: 0 };
  if (!prev) return { kind: "new", pct: Infinity, ratio: Infinity };
  if (!cur) return { kind: "gone", pct: -100, ratio: 0 };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { kind: pct > 0 ? "up" : pct < 0 ? "down" : "flat", pct, ratio: cur / prev };
}

/** "nearly 19.0 percent", "almost 3.4 times", "100.0 percent". No direction word. */
export function pctAmount(ch: Change): string {
  if (ch.kind === "gone") return "100.0 percent";
  if (ch.pct > 200) { const r = one(ch.ratio); return withQ(r.q, `${r.text} times`); }
  const r = one(Math.abs(ch.pct));
  return withQ(r.q, `${r.text} percent`);
}

/** "(nearly +19.0%)", "(-28.1%)", "(over +3.7 times)". */
export function pctParen(cur: number, prev: number): string {
  const ch = change(cur, prev);
  if (ch.kind === "none" || ch.kind === "flat") return "(0.0%)";
  if (ch.kind === "new") return "(new)";
  if (ch.kind === "gone") return "(-100.0%)";
  const sign = ch.pct > 0 ? "+" : "-";
  if (ch.pct > 200) { const r = one(ch.ratio); return `(${withQ(r.q, `${sign}${r.text} times`)})`; }
  const r = one(Math.abs(ch.pct));
  return `(${withQ(r.q, `${sign}${r.text}%`)})`;
}

export type Verbs = "updown" | "creased";
const dirWord = (up: boolean, v: Verbs) => (v === "updown" ? (up ? "up" : "down") : up ? "increased" : "decreased");

/** "up nearly 19.0 percent", "decreased 100.0 percent", "up from none", "unchanged". */
export function changePhrase(cur: number, prev: number, verbs: Verbs = "updown"): string {
  const ch = change(cur, prev);
  switch (ch.kind) {
    case "none": return "unchanged at zero";
    case "new": return `${dirWord(true, verbs)} from none`;
    case "flat": return "unchanged";
    default: return `${dirWord(ch.pct > 0, verbs)} ${pctAmount(ch)}`;
  }
}

/**
 * Volume and value change together: "up 38.9 percent in volume and over 45.9 percent in value",
 * "down almost 1.0 percent in volume, but up nearly 2.8 percent in value",
 * "down 100.0 percent in volume and value".
 */
export function volValPhrase(f: { qtyYtd: number; qtyPrev: number; valYtd: number; valPrev: number },
  verbs: Verbs = "updown"): string {
  const q = change(f.qtyYtd, f.qtyPrev), v = change(f.valYtd, f.valPrev);
  if (q.kind === "gone" && v.kind === "gone") return `${dirWord(false, verbs)} 100.0 percent in volume and value`;
  if (q.kind === "new" && v.kind === "new") return `${dirWord(true, verbs)} from none in both volume and value`;
  const up = (c: Change) => c.kind === "up" || c.kind === "new";
  const qp = `${changePhrase(f.qtyYtd, f.qtyPrev, verbs)} in volume`;
  const vAmount = v.kind === "new" ? "from none" : v.kind === "none" || v.kind === "flat" ? "" : pctAmount(v);
  if (v.kind === "none" || v.kind === "flat") return `${qp}, with value unchanged`;
  if (up(q) === up(v) && q.kind !== "none" && q.kind !== "flat") return `${qp} and ${vAmount} in value`;
  return `${qp}, but ${dirWord(up(v), verbs)} ${vAmount} in value`;
}

/** Absolute change with sign, e.g. "up almost 10.4 million kilograms (nearly +19.0%)". */
export function deltaQty(cur: number, prev: number, unit: string | null): string {
  const d = cur - prev;
  return `${d >= 0 ? "up" : "down"} ${quantity(Math.abs(d), unit)} ${pctParen(cur, prev)}`;
}
export function deltaMoney(cur: number, prev: number): string {
  const d = cur - prev;
  return `${d >= 0 ? "up" : "down"} ${money(Math.abs(d))} ${pctParen(cur, prev)}`;
}

/** Share of a total as "nearly 86.7 percent". */
export function share(part: number, whole: number, style: "percent" | "pct" = "percent"): string {
  if (!whole) return style === "percent" ? "0.0 percent" : "0.0%";
  const r = one((part / whole) * 100);
  return withQ(r.q, style === "percent" ? `${r.text} percent` : `${r.text}%`);
}

export interface Period {
  yr: number; mo: number;
  /** "April 2024" */ month: string;
  /** Rotating phrases for the year-to-date period. */ ytd: () => string;
  /** "like 2023" */ like: string;
  prevYr: number;
  /** "year-to-date", or "full-year" in December. */ ytdAdj: string;
  /** January: the month and the year-to-date are the same period. */ single: boolean;
}

export function period(yr: number, mo: number): Period {
  const variants = mo === 1
    ? [`January ${yr}`]
    : mo === 12
      ? [`calendar year ${yr}`, `the full year ${yr}`]
      : [`the first ${COUNT_WORDS[mo]} months of ${yr}`, `year-to-date ${yr}`];
  let i = 0;
  return {
    yr, mo, month: `${monthName(mo)} ${yr}`, like: `like ${yr - 1}`, prevYr: yr - 1,
    ytdAdj: mo === 12 ? "full-year" : "year-to-date", single: mo === 1,
    ytd: () => variants[i++ % variants.length],
  };
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "A, B, C, and D" */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Table number formats. */
export const fmtInt = (n: number) => (n < 0 ? `(${int(-n)})` : int(n));
export const fmtUsd = (n: number) => `$${int(n)}`;
export const fmtPrice = (val: number, qty: number) => (qty ? `$${(val / qty).toFixed(2)}` : "$0.00");
export function fmtPct(cur: number, prev: number): string {
  if (!prev) return cur ? "new" : "0.0";
  return (((cur - prev) / Math.abs(prev)) * 100).toFixed(1);
}
