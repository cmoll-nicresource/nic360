// Builds the report: one chapter per published part, each with its narrative, charts,
// and country detail tables. Required external figures are resolved before building;
// incomplete data stops generation. Release dates use the generation day in US Eastern.

import type pg from "pg";
import { type UsTrade, usTradeParagraphs } from '../usTrade';
import type { Trq } from '../trq';
import { tradeNumber } from '../numeric';
import { assertReportInputs, assertReportReady, generationDate } from './readiness';
import { stackedBarSvg, svgToPng } from "./chart";
import {
  type Basis, type Figures, type Line, type LineFigures, type MonthPoint,
  loadChapterFigures, loadLines, loadMonthlySeries, pick,
} from "./data";
import {
  type Period, capitalise, change, changePhrase, fmtInt, fmtPct, fmtPrice, fmtUsd, listJoin,
  money, monthName, pctParen, period, quantity, share, volValPhrase,
} from "./format";
import type { Block, Chapter, Report, Row, Section, Table } from "./model";
import {
  comparisons, deltaPair, isEmpty, noneSentence, pctFirstPair, topCountries, ytdTotals,
} from "./text";

export interface Inputs {
  /** Billions of dollars. Automatic FRED inputs cover goods and services;
   * legacy manual inputs without source metadata retain the merchandise basis. */
  usTrade?: UsTrade;
  /** Editorial sentences, keyed by where they go. */
  commentary?: { usTrade?: string };
  trq?: Trq;
}

interface Ctx {
  c: pg.ClientBase;
  yr: number;
  mo: number;
  p: Period;
  lines: Map<string, Line[]>;
  inputs: Inputs;
  cache: Map<string, LineFigures[]>;
  releaseDate: string;
}

const para = (text: string): Block => ({ kind: "para", text });
const h = (text: string, level: 1 | 2 | 3 = 2): Block => ({ kind: "heading", text, level });

async function figures(ctx: Ctx, chapterId: string, basis: Basis): Promise<LineFigures[]> {
  const key = `${chapterId}:${basis}`;
  if (!ctx.cache.has(key)) {
    ctx.cache.set(key, await loadChapterFigures(ctx.c, ctx.lines.get(chapterId)!, basis, ctx.yr, ctx.mo));
  }
  return ctx.cache.get(key)!;
}

/** Thirteen months ending at the as-of month. */
function window13(ctx: Ctx): { from: [number, number]; to: [number, number]; labels: string[] } {
  const labels: string[] = [];
  for (let k = 12; k >= 0; k--) {
    const idx = ctx.yr * 12 + ctx.mo - 1 - k;
    labels.push(monthName((idx % 12) + 1).slice(0, 3));
  }
  return { from: [ctx.yr - 1, ctx.mo], to: [ctx.yr, ctx.mo], labels };
}

function chartBlock(title: string, subtitle: string, units: string, labels: string[],
  series: { name: string; values: number[] }[]): Block {
  const svg = stackedBarSvg({ title, subtitle, units, labels, series });
  return { kind: "chart", png: svgToPng(svg), width: 600, height: 356 };
}

/** Lines that feed a chart: grouped, not totals, and not already counted through a parent line. */
function chartLines(lines: Line[]): Line[] {
  const chosen: Line[] = [];
  const stack: Line[] = [];
  for (const l of lines) {
    while (stack.length && stack[stack.length - 1].indent >= l.indent) stack.pop();
    const parentChosen = stack.some((s) => chosen.includes(s));
    if (l.chartGroup && !l.isTotal && !parentChosen) chosen.push(l);
    stack.push(l);
  }
  return chosen;
}

async function groupChart(ctx: Ctx, chapterId: string, basis: Basis, measure: "val" | "qty",
  divisor: number, title: string, units: string, only?: string[]): Promise<Block> {
  const w = window13(ctx);
  let lines = chartLines(ctx.lines.get(chapterId)!);
  if (only) lines = lines.filter((l) => only.includes(l.chartGroup!));
  const series = await loadMonthlySeries(ctx.c, lines, basis, w.from, w.to);
  const groups = new Map<string, number[]>();
  for (const l of lines) {
    const g = groups.get(l.chartGroup!) ?? new Array(13).fill(0);
    series.get(l.lineId)!.forEach((pt, i) => (g[i] += (measure === "val" ? pt.val : pt.qty) / divisor));
    groups.set(l.chartGroup!, g);
  }
  return chartBlock(title, `(${monthName(w.from[1])} ${w.from[0]} - ${ctx.p.month})`, units, w.labels,
    [...groups].map(([name, values]) => ({ name, values })));
}

// ------------------------------------------------------------------ detail tables

/** Some layout descriptions are upper case; tables read better in title case. */
const titleCase = (s: string) => (s === s.toUpperCase()
  ? s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bNesoi\b/, "NESOI")
  : s);

const UNIT_LABEL: Record<string, [string, string]> = {
  KG: ["kilograms", "$/Kilogram"],
  THS: ["thousands of pieces", "$/Thousand"],
  NO: ["pieces", "$/Piece"],
  DOZ: ["dozens of pieces", "$/Dozen"],
  GRS: ["gross blocks", "$/Gross"],
};

function detailTables(prefix: string, figs: LineFigures[], withCif: boolean, p: Period): Block[] {
  const out: Block[] = [];
  for (const lf of figs) {
    if (!lf.countries.length) continue;
    const unit = lf.line.unit;
    const [qLabel, priceLabel] = unit ? UNIT_LABEL[unit] ?? [unit, "$/Unit"] : ["", ""];
    const title = `${prefix} ${titleCase(lf.line.description)} (${unit ? `quantities in ${qLabel}` : "quantities intentionally left blank"}, values in dollars)`;
    const qty = (n: number) => (unit ? fmtInt(n) : "");
    const cells = (f: Figures) => {
      const c = [qty(f.qtyMo), qty(f.qtyYtd), qty(f.qtyPrev), fmtUsd(f.valMo), fmtUsd(f.valYtd), fmtUsd(f.valPrev)];
      if (withCif) c.push(fmtUsd(f.cifMo), fmtUsd(f.cifYtd), fmtUsd(f.cifPrev));
      c.push(unit ? fmtPrice(f.valYtd, f.qtyYtd) : "");
      return c;
    };
    const valueHead = withCif ? ["Customs Value", "CIF Value"] : ["Value"];
    const groups = ["Quantity", ...valueHead];
    const header: Row[] = [
      { heading: true, cells: [{ text: "" }, ...groups.flatMap((g) => [{ text: g, align: "center" as const }, { text: "" }, { text: "" }]), { text: "Price", align: "center" }] },
      { heading: true, cells: [{ text: "Country" }, ...groups.flatMap(() => ["This Month", `YTD ${p.yr}`, `YTD ${p.prevYr}`].map((t) => ({ text: t, align: "right" as const }))), { text: unit ? `${priceLabel} ${p.yr}` : "", align: "right" }] },
    ];
    const rows: Row[] = lf.countries.map((c) => ({
      cells: [{ text: c.country, indent: 1 }, ...cells(c).map((t) => ({ text: t, align: "right" as const }))],
    }));
    rows.push({ bold: true, shade: true, cells: [{ text: "Total" }, ...cells(lf.total).map((t) => ({ text: t, align: "right" as const }))] });
    const n = 2 + 3 * groups.length;
    out.push({ kind: "table", table: { title, header, rows, widths: [3.2, ...new Array(n - 1).fill(1.25)], fontSize: withCif ? 7 : 7.5 } });
  }
  return out;
}

// ------------------------------------------------------------------ Part 1 summary tables

function summaryTable(title: string, figs: LineFigures[], series: Map<number, MonthPoint[]>, measure: "qty" | "val",
  p: Period, skipMixed = true): Table {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const rows: Row[] = [];
  for (const lf of figs) {
    if (measure === "qty" && skipMixed && !lf.line.unit) continue;
    const div = measure === "val" ? 1000 : lf.line.qtyDivisor;
    const pts = series.get(lf.line.lineId) ?? [];
    const monthly = months.map((_, i) => {
      const pt = pts.find((x) => x.mo === i + 1);
      return pt ? Math.round((measure === "val" ? pt.val : pt.qty) / div) : 0;
    });
    const cur = measure === "val" ? lf.total.valYtd : lf.total.qtyYtd;
    const prev = measure === "val" ? lf.total.valPrev : lf.total.qtyPrev;
    rows.push({
      bold: lf.line.isTotal, shade: lf.line.isTotal,
      cells: [
        { text: lf.line.part1Desc.replace(/^-+/, ""), indent: lf.line.indent },
        ...monthly.map((v) => ({ text: fmtInt(v), align: "right" as const })),
        { text: fmtInt(Math.round(cur / div)), align: "right" },
        { text: fmtInt(Math.round(prev / div)), align: "right" },
        { text: fmtPct(cur, prev), align: "right" },
      ],
    });
  }
  return {
    title,
    header: [{ heading: true, cells: [{ text: "" }, ...months.map((m) => ({ text: m, align: "right" as const })), { text: `YTD ${p.yr}`, align: "right" }, { text: `YTD ${p.prevYr}`, align: "right" }, { text: "Pct Chg", align: "right" }] }],
    rows,
    widths: [3.4, ...new Array(12).fill(1), 1.3, 1.3, 1],
    fontSize: 7,
  };
}

// ------------------------------------------------------------------ Part 1

interface Balance { leafExp: number; prodExp: number; leafGen: number; orientalGen: number; prodGen: number }
const total = (b: Balance) => b.leafExp + b.prodExp - b.leafGen - b.prodGen;
const totalNet = (b: Balance) => total(b) + b.orientalGen;

async function balanceSeries(ctx: Ctx, from: [number, number], to: [number, number]) {
  const el = pick(await figures(ctx, "EXPORT_LEAF", "export"), "All Tobacco Leaf").line;
  const ep = pick(await figures(ctx, "EXPORT_PRODUCT", "export"), "ALL TOBACCO PRODUCTS").line;
  const il = ctx.lines.get("IMPORT_LEAF")!;
  const ip = ctx.lines.get("IMPORT_PRODUCT")!;
  const allLeaf = il.find((l) => l.description === "All Leaf Tobacco")!;
  const oriental = il.find((l) => l.description === "Oriental Cigarette Tobacco")!;
  const allProd = ip.find((l) => l.description === "All Tobacco Products")!;
  const exp = await loadMonthlySeries(ctx.c, [el, ep], "export", from, to);
  const gen = await loadMonthlySeries(ctx.c, [allLeaf, oriental, allProd], "general", from, to);
  return exp.get(el.lineId)!.map((pt, i): Balance & { yr: number; mo: number } => ({
    yr: pt.yr, mo: pt.mo,
    leafExp: pt.val, prodExp: exp.get(ep.lineId)![i].val,
    leafGen: gen.get(allLeaf.lineId)![i].val, orientalGen: gen.get(oriental.lineId)![i].val,
    prodGen: gen.get(allProd.lineId)![i].val,
  }));
}

const b1 = (n: number) => (n < 0 ? `(${Math.abs(n).toFixed(1)})` : n.toFixed(1));
const surplusWord = (n: number) => (n >= 0 ? "surplus" : "deficit");

async function part1(ctx: Ctx): Promise<Chapter> {
  const { p, inputs } = ctx;
  const blocks: Block[] = [];
  const leafExp = pick(await figures(ctx, "EXPORT_LEAF", "export"), "All Tobacco Leaf").total;
  const prodExpF = await figures(ctx, "EXPORT_PRODUCT", "export");
  const prodExp = pick(prodExpF, "ALL TOBACCO PRODUCTS").total;
  const cigExp = pick(prodExpF, "CIGARETTES");
  const leafGenF = await figures(ctx, "IMPORT_LEAF", "general");
  const leafGen = pick(leafGenF, "All Leaf Tobacco").total;
  const orientalGen = pick(leafGenF, "Oriental Cigarette Tobacco").total;
  const prodGen = pick(await figures(ctx, "IMPORT_PRODUCT", "general"), "All Tobacco Products").total;

  // US trade
  blocks.push(h("Balance of US Trade"));
  const prevMonthName = ctx.mo === 1 ? `December ${p.yr - 1}` : `${monthName(ctx.mo - 1)} ${p.yr}`;
  const us = inputs.usTrade;
  if (us?.source) {
    blocks.push(...usTradeParagraphs(us, ctx.yr, ctx.mo, inputs.commentary?.usTrade).map(para));
    blocks.push({ kind: 'para', italic: true, text: `Source: US Census Bureau / BEA via FRED (${us.source.series.join(', ')}). Goods and services, balance of payments basis, seasonally adjusted; billions of dollars. Retrieved ${us.source.retrievedAt.slice(0, 10)}. Figures are subject to revision.` });
  } else if (us) {
    const B = 1e9;
    const def = (us.exports.month - us.imports.month) * B, defPrev = (us.exports.prevMonth - us.imports.prevMonth) * B;
    const defYtd = (us.exports.ytd - us.imports.ytd) * B, defPrevYtd = (us.exports.prevYtd - us.imports.prevYtd) * B;
    const grew = Math.abs(def) > Math.abs(defPrev);
    const dir = (a: number, b: number) => (a >= b ? "grew" : "shrank");
    blocks.push(para(
      `The nation’s merchandise trade ${surplusWord(def)} in ${p.month} ${grew ? "grew" : "shrank"} by ${money(Math.abs(Math.abs(def) - Math.abs(defPrev)))} `
      + `(from the revised ${prevMonthName} ${surplusWord(defPrev)} of ${money(Math.abs(defPrev))}) to ${money(Math.abs(def))} as imports `
      + `${dir(us.imports.month, us.imports.prevMonth)} while exports ${dir(us.exports.month, us.exports.prevMonth)}. `
      + `${inputs.commentary?.usTrade ? `${inputs.commentary.usTrade} ` : ''}`
      + `The year-to-date ${p.yr} trade ${surplusWord(defYtd)} figure of ${money(Math.abs(defYtd))} was ${money(Math.abs(Math.abs(defYtd) - Math.abs(defPrevYtd)))} `
      + `or ${changePhrase(Math.abs(defYtd), Math.abs(defPrevYtd)).replace(/^(up|down) /, "")} ${Math.abs(defYtd) >= Math.abs(defPrevYtd) ? "greater" : "less"} `
      + `than the comparable ${p.prevYr} figure of ${money(Math.abs(defPrevYtd))}.`,
    ));
    const flowSentence = (label: string, f: typeof us.imports) => {
      const cmp = (a: number, b: number) => `${money(Math.abs(a - b) * B)} ${pctParen(a, b)} ${a >= b ? "greater" : "less"}`;
      let s = `${monthName(ctx.mo)}’s ${label} figure of ${money(f.month * B)} was ${cmp(f.month, f.prevMonth)} than the revised ${money(f.prevMonth * B)} recorded in ${prevMonthName}`;
      if (ctx.mo > 1) {
        const avg = (f.ytd - f.month) / (ctx.mo - 1);
        s += ` and ${cmp(f.month, avg)} than the ${money(avg * B)} monthly average for the January${ctx.mo > 2 ? ` to ${monthName(ctx.mo - 1)}` : ""} ${p.yr} period`;
      }
      return `${s}.`;
    };
    blocks.push(para(`${flowSentence("import", us.imports)} ${flowSentence("export", us.exports)}`));
  } else {
    throw new Error('US trade figures are required to generate the report');
  }

  // Tobacco trade
  const w = window13(ctx);
  const hist = await balanceSeries(ctx, [1999, 1], [ctx.yr, ctx.mo]);
  const now = hist[hist.length - 1], before = hist[hist.length - 2];
  const bal = total(now), balNet = totalNet(now), balPrev = total(before);
  const ytd: Balance = { leafExp: leafExp.valYtd, prodExp: prodExp.valYtd, leafGen: leafGen.valYtd, orientalGen: orientalGen.valYtd, prodGen: prodGen.valYtd };
  const ytdPrev: Balance = { leafExp: leafExp.valPrev, prodExp: prodExp.valPrev, leafGen: leafGen.valPrev, orientalGen: orientalGen.valPrev, prodGen: prodGen.valPrev };
  let streak = "";
  if (Math.sign(bal) !== Math.sign(balPrev)) {
    const last = [...hist.slice(0, -1)].reverse().find((b) => Math.sign(total(b)) === Math.sign(bal) && (b.leafExp || b.leafGen));
    streak = last
      ? ` This month’s tobacco trade ${surplusWord(bal)} was the first since ${monthName(last.mo)} ${last.yr}.`
      : ` This is the first tobacco trade ${surplusWord(bal)} in the database (back to 1999).`;
  }
  const absPair = (a: number, b: number) => pctParen(Math.abs(a), Math.abs(b));
  blocks.push(h("Balance of US Tobacco Trade"));
  blocks.push(para(
    `The U.S. tobacco industry in ${p.month} reported a monthly trade ${surplusWord(bal)} of ${money(Math.abs(bal))} `
    + `(${money(Math.abs(balNet))} ${surplusWord(balNet)} net of oriental) compared to the ${money(Math.abs(balPrev))} ${surplusWord(balPrev)} from ${prevMonthName}.${streak} `
    + `For ${p.ytd()}, there was a tobacco industry trade ${surplusWord(total(ytd))} of ${money(Math.abs(total(ytd)))} `
    + `(${money(Math.abs(totalNet(ytd)))} net of oriental), ${Math.abs(total(ytd)) <= Math.abs(total(ytdPrev)) ? "down" : "up"} ${money(Math.abs(Math.abs(total(ytd)) - Math.abs(total(ytdPrev))))} `
    + `${absPair(total(ytd), total(ytdPrev))} when compared to ${p.like} (${money(Math.abs(Math.abs(totalNet(ytd)) - Math.abs(totalNet(ytdPrev))))} `
    + `or ${absPair(totalNet(ytd), totalNet(ytdPrev)).slice(1, -1)} net of oriental).`,
  ));
  const leafBalNet = (b: Balance) => b.leafExp - b.leafGen + b.orientalGen;
  const prodBal = (b: Balance) => b.prodExp - b.prodGen;
  const leafGenAll = pick(leafGenF, "All Leaf Tobacco").total;
  blocks.push(para(
    `Cigarette shipments of ${quantity(cigExp.total.qtyMo, "THS")}, valued at ${money(cigExp.total.valMo)}, brought ${monthName(ctx.mo)}’s total export value of tobacco products to ${money(prodExp.valMo)}. `
    + `Compared with ${monthName(ctx.mo)} ${p.prevYr}, this month’s leaf exports of ${quantity(leafExp.qtyMo, "KG")} were ${changePhrase(leafExp.qtyMo, leafExp.qtyPrevMo)}, `
    + `while this month’s leaf general imports of ${quantity(leafGenAll.qtyMo, "KG")} were ${changePhrase(leafGenAll.qtyMo, leafGenAll.qtyPrevMo)}. `
    + `The ${leafBalNet(ytd) >= 0 ? "positive" : "negative"} balance of trade in leaf (net of oriental) for ${p.ytd()} was ${money(Math.abs(leafBalNet(ytd)))} ${absPair(leafBalNet(ytd), leafBalNet(ytdPrev))}, `
    + `while the ${prodBal(ytd) >= 0 ? "positive" : "negative"} balance of trade in tobacco products totaled ${money(Math.abs(prodBal(ytd)))} ${absPair(prodBal(ytd), prodBal(ytdPrev))}.`,
  ));
  released(ctx, blocks);

  // Chart: monthly balance by products and leaf (net of oriental), millions
  const last13 = hist.slice(-13);
  blocks.push(chartBlock("Tracking Tobacco’s Trade Surplus", `(${monthName(w.from[1])} ${w.from[0]} - ${p.month})`, "Millions of US$", w.labels, [
    { name: "Tobacco Products", values: last13.map((b) => prodBal(b) / 1e6) },
    { name: "Tobacco Leaf (net of oriental)", values: last13.map((b) => leafBalNet(b) / 1e6) },
  ]));

  // Balance table
  const usRows: Row[] = us
    ? [
      [us.source ? "Exports [BOP basis]" : "Exports [f.a.s. value]", us.exports.month, us.exports.ytd, us.exports.prevYtd],
      [us.source ? "Imports [BOP basis]" : "General imports [customs]", us.imports.month, us.imports.ytd, us.imports.prevYtd],
      ["Surplus or (deficit)", us.balance?.month ?? us.exports.month - us.imports.month, us.balance?.ytd ?? us.exports.ytd - us.imports.ytd, us.balance?.prevYtd ?? us.exports.prevYtd - us.imports.prevYtd],
    ].map(([label, ...v]) => ({ cells: [{ text: label as string, indent: 1 }, ...(v as number[]).map((n) => ({ text: b1(n), align: "right" as const }))] }))
    : [];
  const M = 1e6;
  const tob = (label: string, f: (b: Balance) => number) => ({
    cells: [{ text: label, indent: 1 }, ...[now, ytd, ytdPrev].map((b) => ({ text: b1(f(b) / M), align: "right" as const }))],
  });
  blocks.push({ kind: "table", table: {
    title: "Total US and Tobacco Industry Balance of Trade",
    header: [{ heading: true, cells: [{ text: "" }, { text: "This Month", align: "right" }, { text: String(p.yr), align: "right" }, { text: String(p.prevYr), align: "right" }] }],
    rows: [
      { bold: true, cells: [{ text: us?.source ? "Total US goods and services (Billions of US$, seasonally adjusted)" : "Total US (Billions of US$)" }, { text: "" }, { text: "" }, { text: "" }] },
      ...usRows,
      { bold: true, cells: [{ text: "Tobacco Industry (Millions of US$)" }, { text: "" }, { text: "" }, { text: "" }] },
      tob("Exports [f.a.s. value]", (b) => b.leafExp + b.prodExp),
      tob("General imports [customs]", (b) => b.leafGen + b.prodGen),
      tob("General imports [customs] - Net of oriental", (b) => b.leafGen + b.prodGen - b.orientalGen),
      tob("Surplus or (deficit)", total),
      tob("Surplus or (deficit) - Net of oriental", totalNet),
    ],
    widths: [4, 1.3, 1.3, 1.3],
    fontSize: 9,
  } });

  // TRQ
  blocks.push(h("Tariff-Rate-Quota Barometer"));
  blocks.push(para("On December 12, 1995, the U.S. Federal government implemented its Tariff-Rate-Quota (TRQ) system that defined how tobacco leaf, used to produce cigarettes manufactured and sold for U.S. consumption, is to be imported into the U.S. The table below shows the quota level of U.S. Imports for Consumption for each foreign leaf exporter. The last group of countries, which has been labeled “Others” contains all other countries and areas not previously listed. Leaf imported from Canada, Mexico and Israel are not subject to this quota system."));
  if (inputs.trq) {
    const t = inputs.trq;
    blocks.push(para(`For the period of ${t.periodLabel} (all figures are in kilograms)`));
    const rows: Row[] = t.rows.map((r) => ({ cells: [
      { text: r.country }, { text: fmtInt(r.imported), align: "right" }, { text: fmtInt(r.quota), align: "right" },
      { text: fmtInt(r.quota - r.imported), align: "right" }, { text: r.quota ? ((r.imported / r.quota) * 100).toFixed(2) : "", align: "right" },
    ] }));
    const ti = t.rows.reduce((s, r) => s + r.imported, 0), tq = t.rows.reduce((s, r) => s + r.quota, 0);
    rows.push({ bold: true, shade: true, cells: [{ text: "Total" }, { text: fmtInt(ti), align: "right" }, { text: fmtInt(tq), align: "right" }, { text: fmtInt(tq - ti), align: "right" }, { text: ((ti / tq) * 100).toFixed(2), align: "right" }] });
    blocks.push({ kind: "table", table: {
      header: [{ heading: true, cells: ["Country", "Cigarette Leaf Imported", `${t.quotaYear} Quota Level`, "Quantity Remaining", "% TRQ"].map((x, i) => ({ text: x, align: i ? "right" as const : "left" as const })) }],
      rows, widths: [3, 2, 2, 2, 1.2], fontSize: 9,
    } });
    blocks.push({ kind: "para", text: t.source
      ? `Source: US Customs and Border Protection, Commodity Status Report dated ${t.source.releaseDate}, via ACE. Allocated quantities as of this weekly release; quota effective dates ${t.source.effectiveBegin} to ${t.source.effectiveEnd}. ${t.source.url}`
      : "Source: The US Department of Homeland Security - Automated Commercial Environment (ACE) system", italic: true });
  } else {
    throw new Error('TRQ figures are required to generate the report');
  }

  // Leaf balance chart: cigarette leaf types net of oriental vs cigar and other leaf
  const el = ctx.lines.get("EXPORT_LEAF")!, il = ctx.lines.get("IMPORT_LEAF")!;
  const cigTypes = new Set(["Flue-Cured", "Burley", "Maryland"]);
  const expCig = el.filter((l) => !l.isTotal && l.indent === 0 && cigTypes.has(l.chartGroup ?? ""));
  const expOther = el.filter((l) => !l.isTotal && l.indent === 0 && !cigTypes.has(l.chartGroup ?? ""));
  const impCig = il.filter((l) => l.description === "All Cigarette Leaf Tobacco");
  const impOrient = il.filter((l) => l.description === "Oriental Cigarette Tobacco");
  const impOther = il.filter((l) => !l.isTotal && l.indent === 0);
  const se = await loadMonthlySeries(ctx.c, [...expCig, ...expOther], "export", w.from, w.to);
  const sg = await loadMonthlySeries(ctx.c, [...impCig, ...impOrient, ...impOther], "general", w.from, w.to);
  const sum = (m: Map<number, MonthPoint[]>, ls: Line[]) => w.labels.map((_, i) => ls.reduce((s, l) => s + m.get(l.lineId)![i].val, 0));
  const k = (a: number[], b: number[], c: number[] = [], d: number[] = []) => a.map((x, i) => (x - b[i] + (c[i] ?? 0) - (d[i] ?? 0)) / 1000);
  blocks.push(chartBlock("Tracking Leaf’s Balance", `(${monthName(w.from[1])} ${w.from[0]} - ${p.month})`, "Thousands of US$", w.labels, [
    { name: "Cigar and Other Leaf Types", values: k(sum(se, expOther), sum(sg, impOther)) },
    { name: "Cigarette Leaf Types, Net of Oriental", values: k(sum(se, expCig), sum(sg, impCig), sum(sg, impOrient)) },
  ]));

  // Summary tables
  const summary: Block[] = [];
  const add = async (chapterId: string, basis: Basis, qtyTitle: string, valTitle: string) => {
    const figs = await figures(ctx, chapterId, basis);
    const s = await loadMonthlySeries(ctx.c, figs.map((f) => f.line), basis, [ctx.yr, 1], [ctx.yr, ctx.mo]);
    summary.push({ kind: "table", table: summaryTable(qtyTitle, figs, s, "qty", p) });
    summary.push({ kind: "table", table: summaryTable(valTitle, figs, s, "val", p) });
  };
  const prodUnits = "(Cigs. millions of pieces, Little Cigars, Large Cigars thousands of pieces, other products thousands of kgs)";
  await add("EXPORT_LEAF", "export", "Leaf Export Quantities (thousands of kilograms)", "Leaf Export Value (thousands of dollars)");
  await add("EXPORT_PRODUCT", "export", `Product Exports Quantities ${prodUnits}`, "Products Exports Value (thousands of dollars)");
  await add("IMPORT_LEAF", "consumption", "Leaf Imports For Consumption Quantity (thousands of kilograms)", "Leaf Imports For Consumption Customs Value (thousands of dollars)");
  await add("IMPORT_LEAF", "general", "Leaf General Imports Quantities (thousands of kilograms)", "Leaf General Imports Customs Value (thousands of dollars)");
  await add("IMPORT_PRODUCT", "consumption", `Product Imports For Consumption Quantities ${prodUnits}`, "Products Imports For Consumption Customs Value (thousands of dollars)");
  await add("IMPORT_PRODUCT", "general", `Products General Imports Quantities ${prodUnits}`, "Products General Imports Customs Value (thousands of dollars)");

  // Balance-of-trade summary, by month
  const yearHist = hist.filter((b) => b.yr === ctx.yr);
  const balRows: [string, (b: Balance) => number, boolean?][] = [
    ["LEAF EXPORTS", (b) => b.leafExp], ["LEAF GENERAL IMPORTS", (b) => b.leafGen],
    ["LEAF GENERAL IMPORTS (NET OF ORIENTAL)", (b) => b.leafGen - b.orientalGen],
    ["LEAF BALANCE", (b) => b.leafExp - b.leafGen, true], ["LEAF BALANCE (NET OF ORIENTAL)", leafBalNet, true],
    ["PRODUCT EXPORT", (b) => b.prodExp], ["PRODUCT GENERAL IMPORT", (b) => b.prodGen],
    ["PRODUCT BALANCE", prodBal, true], ["TOTAL INDUSTRY BALANCE", total, true],
    ["TOTAL INDUSTRY BALANCE (NET OF ORIENTAL)", totalNet, true],
  ];
  const months12 = Array.from({ length: 12 }, (_, i) => i + 1);
  const num = (n: number) => Math.round(n / 1000).toLocaleString("en-US");
  summary.push({ kind: "table", table: {
    title: "Tobacco Industry Balance of Trade (thousands of dollars)",
    header: [{ heading: true, cells: [{ text: "" }, ...months12.map((m) => ({ text: monthName(m).slice(0, 3), align: "right" as const })), { text: `YTD ${p.yr}`, align: "right" }, { text: `YTD ${p.prevYr}`, align: "right" }, { text: "Pct Chg", align: "right" }] }],
    rows: balRows.map(([label, f, isBal]) => ({
      bold: isBal, cells: [
        { text: label },
        ...months12.map((m) => { const b = yearHist.find((x) => x.mo === m); return { text: b ? num(f(b)) : "0", align: "right" as const }; }),
        { text: num(f(ytd)), align: "right" }, { text: num(f(ytdPrev)), align: "right" },
        { text: fmtPct(Math.abs(f(ytd)), Math.abs(f(ytdPrev))), align: "right" },
      ],
    })),
    widths: [3.4, ...new Array(12).fill(1), 1.3, 1.3, 1], fontSize: 7,
  } });

  return {
    partNo: 1, title: "Balance of Trade",
    sections: [
      { landscape: false, header: `US Trade Barometer: Balance of Trade | ${p.month}`, blocks },
      { landscape: true, header: `TMA Tobacco Trade Barometer Part 1 Summary | Month of ${p.month}`, blocks: summary },
    ],
  };
}

// ------------------------------------------------------------------ Part 2: leaf exports

async function part2(ctx: Ctx): Promise<Chapter> {
  const { p } = ctx;
  const F = await figures(ctx, "EXPORT_LEAF", "export");
  const all = pick(F, "All Tobacco Leaf"), t = all.total;
  const b: Block[] = [h("Total Exports")];
  b.push(para(
    p.single
      ? `Exports of American-grown leaf tobacco in ${p.month} totaled ${quantity(t.qtyMo, "KG")}, valued at ${money(t.valMo)}, `
        + `${deltaPair(t, "KG")} compared to ${monthName(1)} ${p.prevYr}.`
      : `Exports of American-grown leaf tobacco in ${p.month} totaled ${quantity(t.qtyMo, "KG")}, valued at ${money(t.valMo)}, `
        + `bringing the volume for ${p.ytd()} to ${quantity(t.qtyYtd, "KG")} valued at ${money(t.valYtd)}. `
        + `These ${p.ytdAdj} ${p.yr} figures were ${deltaPair(t, "KG")} compared to the same period in ${p.prevYr}.`,
  ));
  const top = topCountries(all, 10);
  const lead = top.ranked[0];
  if (lead) {
    b.push(para(
      `${lead.country} was the largest buyer of U.S. leaf during ${p.ytd()} with shipments of ${quantity(lead.qtyYtd, "KG")} valued at ${money(lead.valYtd)}, `
      + `${volValPhrase(lead)} compared with ${p.like}. For ${p.ytd()}, the leading country customers of U.S. leaf (in descending order) were `
      + `${listJoin(top.names)}, accounting for ${top.share} of all U.S. leaf exports, compared to ${top.prevShare} during ${p.like}.`,
    ));
  }
  b.push(await groupChart(ctx, "EXPORT_LEAF", "export", "val", 1000, "Exports of Unmanufactured Tobacco", "by Major Types (thousands of dollars)"));

  const typeSection = (title: string, name: string, desc: string, sub: string, withShare: boolean) => {
    const f = pick(F, desc).total;
    const st = pick(F, desc.replace("Unstemmed and Stemmed", "Stemmed")), un = pick(F, desc.replace("Unstemmed and Stemmed", "Unstemmed"));
    b.push(h(title));
    if (isEmpty(f)) { b.push(para(noneSentence(`${name} tobacco exports`, p))); return; }
    const shareText = withShare ? `accounted for ${share(f.qtyYtd, t.qtyYtd)} of total leaf export volume for ${p.ytd()} and ` : "";
    const lead = withShare ? `Exports of ${name} tobacco to customers abroad ${shareText}totaled` : `Exports of ${name} tobacco for ${p.ytd()} totaled`;
    const subs = [st, un].map((x, i) => isEmpty(x.total)
      ? `there were no exports of ${i ? "unstemmed" : "stemmed"} ${sub} for either year-to-date ${p.yr} or ${p.prevYr}`
      : `exports of ${i ? `unstemmed ${sub.replace(/ tobacco$/, "")} shipments` : `stemmed ${sub}`} were ${volValPhrase(x.total)}`);
    b.push(para(
      `${lead} ${quantity(f.qtyYtd, "KG")} valued at ${money(f.valYtd)}, ${deltaPair(f, "KG")} compared with ${p.like}. `
      + `Comparing ${p.ytd()} with ${p.like}, ${subs[0]}, while ${subs[1]}.`,
    ));
  };
  typeSection("Flue-Cured Tobacco", "flue-cured", "Flue-Cured Tobacco Unstemmed and Stemmed", "flue-cured tobacco", true);
  typeSection("Burley Tobacco", "burley", "Burley Tobacco Unstemmed and Stemmed", "burley tobacco", false);
  b.push(h("Other Leaf Tobacco"));
  b.push(para(comparisons([
    { noun: "Maryland tobacco exports", f: pick(F, "Maryland Tobacco") },
    { noun: "dark-fired Kentucky-Tennessee exports", f: pick(F, "Dark-Fired Kentucky & Tennessee Tobacco") },
    { noun: "fire-cured and sun-cured exports", f: pick(F, "Fire-Cured & Sun-Cured Tobacco") },
    { noun: "Black Fat tobacco exports", f: pick(F, "Black Fat Tobacco") },
    { noun: "shipments of “other unmanufactured, tobacco not elsewhere specified or included”", f: pick(F, "Other Unmanufactured Tobacco, NESOI") },
  ], p)));
  b.push(h("Cigar Leaf Tobacco"));
  b.push(para(comparisons([
    { noun: "Connecticut cigar wrapper tobacco exports", f: pick(F, "Connecticut Cigar Wrapper Tobacco Unstemmed and Stemmed") },
    { noun: "cigar binder tobacco exports", f: pick(F, "Cigar Binder Tobacco Unstemmed and Stemmed") },
    { noun: "cigar filler tobacco exports", f: pick(F, "Cigar Filler Tobacco Unstemmed and Stemmed") },
    { noun: "threshed cigar leaf exports", f: pick(F, "Threshed - Cigar Leaf (scrap)") },
  ], p)));
  released(ctx, b);
  return chapterOf(ctx, 2, "Exports of Leaf Tobacco", b, detailTables("Exports", F, false, p));
}

// ------------------------------------------------------------------ Part 3: product exports

async function part3(ctx: Ctx): Promise<Chapter> {
  const { p } = ctx;
  const F = await figures(ctx, "EXPORT_PRODUCT", "export");
  const t = pick(F, "ALL TOBACCO PRODUCTS").total;
  const b: Block[] = [h("Total Exports")];
  b.push(para(
    `American-made tobacco products shipped to customers abroad totaled ${money(t.valMo)} in ${p.month}${p.single ? "" : `, and brought the products export value for ${p.ytd()} `
    + `to ${money(t.valYtd)}`}, ${t.valYtd >= t.valPrev ? "up" : "down"} ${money(Math.abs(t.valYtd - t.valPrev))} ${pctParen(t.valYtd, t.valPrev)} from the comparable ${p.prevYr} figure of ${money(t.valPrev)}.`,
  ));
  b.push(await groupChart(ctx, "EXPORT_PRODUCT", "export", "val", 1000, "Exports of Tobacco Products", "Thousands of Dollars"));

  const cig = pick(F, "CIGARETTES"), ct = cig.total;
  const top = topCountries(cig, 5);
  b.push(h("Cigarettes and Cigars"));
  b.push(para(
    `U.S. cigarette exports in ${p.month} totaled ${quantity(ct.qtyMo, "THS", true, "cigarettes")}, valued at ${money(ct.valMo)}. `
    + `This brought manufacturers’ shipments of cigarettes for ${p.ytd()} to ${quantity(ct.qtyYtd, "THS")}, valued at ${money(ct.valYtd)}, `
    + `${deltaPair(ct, "THS")} from ${p.like}. Cigarette exports to ${listJoin(top.names)} accounted for ${top.share} of all cigarette export shipments for ${p.ytd()}, `
    + `compared to ${top.prevShare} during ${p.like}.`,
  ));
  const lc = pick(F, "LITTLE CIGARS").total, lg = pick(F, "LARGE CIGARS INCLUDING CIGARILLOS").total;
  b.push(para(
    (isEmpty(lc) ? noneSentence("little cigar exports", p) : `For ${p.ytd()}, exports of little cigars ${ytdTotals(lc, "THS")}, ${deltaPair(lc, "THS")} compared with the same period in ${p.prevYr}.`)
    + " " + (isEmpty(lg) ? noneSentence("large cigar exports", p) : `For ${p.ytd()}, large cigar exports ${ytdTotals(lg, "THS")}, ${deltaPair(lg, "THS")} when compared with ${p.like}.`),
  ));
  b.push(await groupChart(ctx, "EXPORT_PRODUCT", "export", "qty", 1, "Exports of Cigarettes", "Thousands of Pieces", ["Cigarettes"]));

  const pkg = pick(F, "PACKAGED SMOKING TOBACCO"), pipe = pick(F, "PACKAGED PIPE TOBACCO");
  const wp = pick(F, "WATER PIPE TOBACCO"), bulk = pick(F, "BULK AND STRIP SMOKING");
  b.push(h("Smoking Tobacco"));
  b.push(para([
    isEmpty(pkg.total) ? noneSentence("packaged smoking tobacco exports", p)
      : `For ${p.ytd()}, exports of packaged smoking tobacco, ${share(pipe.total.qtyYtd, pkg.total.qtyYtd)} of which was pipe tobacco, ${volValPhrase(pkg.total, "creased")} compared with ${p.like}.`,
    isEmpty(wp.total) ? noneSentence("water pipe (hookah) tobacco exports", p)
      : `Water pipe (hookah) tobacco exports for ${p.ytd()} ${ytdTotals(wp.total, "KG")}, ${volValPhrase(wp.total)} when compared with ${p.like}.`,
    isEmpty(bulk.total) ? noneSentence("bulk and strip smoking tobacco exports", p)
      : `Exports of bulk and strip smoking tobacco for ${p.ytd()} ${volValPhrase(bulk.total, "creased")} when compared with ${p.like}.`,
  ].join(" ")));
  b.push(h("Smokeless & Other Tobacco Products"));
  b.push(para(comparisons([
    { noun: "chewing tobacco exports", f: pick(F, "CHEWING TOBACCO") },
    { noun: "snuff exports", f: pick(F, "SNUFF AND SNUFF FLOUR") },
    { noun: "homogenized tobacco exports", f: pick(F, "HOMOGENIZED TOBACCO") },
    { noun: "shipments of other manufactured tobacco", f: pick(F, "OTHER MANUFACTURED TOBACCO, NESOI") },
  ], p)));
  b.push(h("Novel Tobacco Products & Electronic Cigarettes"));
  b.push(para([
    ["Novel tobacco product (no combustion) exports", "NOVEL TOBACCO PRODUCTS (NO COMBUSTION)"],
    ["Nicotine-containing product exports", "NICOTINE CONTAINING PRODUCTS"],
    ["Electronic cigarette exports", "ELECTRONIC CIGARETTES"],
  ].map(([noun, d]) => {
    const lf = pick(F, d);
    return isEmpty(lf.total) ? noneSentence(noun.toLowerCase(), p)
      : `${noun} ${ytdTotals(lf.total, lf.line.unit)} in ${p.ytd()}, ${volValPhrase(lf.total)} when compared to ${p.like}.`;
  }).join(" ")));
  released(ctx, b);
  return chapterOf(ctx, 3, "Exports of Tobacco Products", b, detailTables("Exports", F, false, p));
}

// ------------------------------------------------------------------ Part 4: leaf imports

async function part4(ctx: Ctx): Promise<Chapter> {
  const { p } = ctx;
  const F = await figures(ctx, "IMPORT_LEAF", "consumption");
  const G = await figures(ctx, "IMPORT_LEAF", "general");
  const t = pick(F, "All Leaf Tobacco").total;
  const b: Block[] = [h("Total Imports")];
  const dq = t.qtyYtd - t.qtyPrev, dv = t.valYtd - t.valPrev;
  b.push(para(
    `Consumption imports of leaf tobacco in ${p.month} amounted to ${quantity(t.qtyMo, "KG")} with a customs value of ${money(t.valMo)}`
    + (p.single ? ", " : `. These figures brought the totals for ${p.ytd()} to ${quantity(t.qtyYtd, "KG")}, valued at ${money(t.valYtd)}, `)
    + `${dq >= 0 ? "up" : "down"} ${quantity(Math.abs(dq), "KG")} or ${changePhrase(t.qtyYtd, t.qtyPrev).replace(/^(up|down) /, "")} in volume and `
    + `${dv >= 0 ? "up" : "down"} ${money(Math.abs(dv))} or ${changePhrase(t.valYtd, t.valPrev).replace(/^(up|down) /, "")} in value when compared to the ${p.like} figures of `
    + `${quantity(t.qtyPrev, "KG")}, valued at ${money(t.valPrev)}.`,
  ));
  b.push(await groupChart(ctx, "IMPORT_LEAF", "general", "val", 1000, "General Imports of Unmanufactured Tobacco", "Thousands of Dollars"));

  const cig = pick(F, "All Cigarette Leaf Tobacco").total;
  const qPhrase = changePhrase(cig.qtyYtd, cig.qtyPrev, "creased");
  let vPhrase = changePhrase(cig.valYtd, cig.valPrev, "creased");
  // "decreased 12.6 percent in volume ... and 6.3 percent in value" when both move the same way.
  if (qPhrase.split(" ")[0] === vPhrase.split(" ")[0]) vPhrase = vPhrase.replace(/^\S+ /, "");
  b.push(h("Cigarette Leaf Tobacco"));
  b.push(para(
    `For ${p.ytd()}, imports of cigarette leaf tobacco for consumption (${share(cig.qtyYtd, t.qtyYtd, "pct")} of total leaf consumption imports) `
    + `${qPhrase} in volume to ${quantity(cig.qtyYtd, "KG")} and ${vPhrase} in value to ${money(cig.valYtd)} `
    + `from the ${p.like} figures of ${quantity(cig.qtyPrev, "KG")} valued at ${money(cig.valPrev)}.`,
  ));
  const or = pick(F, "Oriental Cigarette Tobacco").total;
  const orG = pick(G, "Oriental Cigarette Tobacco").total, cigG = pick(G, "All Cigarette Leaf Tobacco").total;
  b.push(h("Oriental, Flue-Cured & Burley Tobacco"));
  b.push(para(
    `Oriental (aromatic) leaf imports, which accounted for ${share(or.qtyYtd, cig.qtyYtd)} of all cigarette leaf tobacco consumption imports for ${p.ytd()} `
    + `(${share(orG.qtyYtd, cigG.qtyYtd, "pct")} of general imports) totaled ${quantity(or.qtyYtd, "KG")} valued at ${money(or.valYtd)}, ${deltaPair(or, "KG")} when compared with ${p.like}. `
    + comparisons([
      { noun: "stemmed flue-cured imports", f: pick(F, "Flue-Cured Tobacco Stemmed") },
      { noun: "unstemmed flue-cured imports", f: pick(F, "Flue-Cured Tobacco Unstemmed") },
      { noun: "stemmed burley imports", f: pick(F, "Burley Tobacco Stemmed") },
      { noun: "unstemmed burley imports", f: pick(F, "Burley Tobacco Unstemmed") },
    ], p),
  ));
  const oth = pick(F, "Other Cigarette Leaf Tobacco Unstemmed and Stemmed").total;
  const scrap = pick(F, "Scrap Tobacco Other Than Cigar Leaf").total;
  b.push(para(
    (isEmpty(oth) ? noneSentence("imports of other cigarette leaf tobacco", p)
      : `Imports of other cigarette leaf tobacco for ${p.ytd()} ${ytdTotals(oth, "KG")}, ${volValPhrase(oth)} compared with ${p.like}.`)
    + " " + (isEmpty(scrap) ? noneSentence("imports of scrap tobacco other than cigar leaf", p)
      : `Imports of scrap tobacco other than cigar leaf for ${p.ytd()} ${ytdTotals(scrap, "KG")}, ${volValPhrase(scrap)} compared with ${p.like}.`),
  ));
  b.push(h("Cigar and Other Leaf Tobacco"));
  b.push(para(comparisons([
    { noun: "cigar filler tobacco imports", f: pick(F, "Cigar Filler Tobacco Unstemmed and Stemmed") },
    { noun: "consumption imports of cigar wrapper tobacco", f: pick(F, "Cigar Wrapper Tobacco Unstemmed and Stemmed") },
    { noun: "mixed cigar wrapper and filler tobacco imports", f: pick(F, "Mixed Cigar Wrapper and Filler") },
    { noun: "cigar leaf scrap tobacco imports", f: pick(F, "Cigar Leaf Scrap Tobacco") },
    { noun: "tobacco stem imports", f: pick(F, "Tobacco Stems") },
    { noun: "imports of dark-fired, fire-/sun-cured and black fat tobaccos", f: pick(F, "Dark-Fired, Fire/Sun-Cured and Blackfat") },
  ], p)));
  b.push(para(await specialProgramNote(ctx, "IMPORT_LEAF", "All Leaf Tobacco", "leaf")));
  released(ctx, b);
  return chapterOf(ctx, 4, "Imports of Leaf Tobacco", b,
    [...detailTables("Consumption Imports", F, true, p), ...detailTables("General Imports", G, true, p)]);
}

/**
 * Duty-free entries under special programs (Census rate provision 18) by country.
 * Report the recorded rate-provision category without inferring a specific program.
 */
async function specialProgramNote(ctx: Ctx, chapterId: string, description: string, what: string): Promise<string> {
  const line = ctx.lines.get(chapterId)!.find((l) => l.description === description)!;
  const { rows } = await ctx.c.query(
    `select coalesce(ct.name, f.cty_code::text) as country, sum(f.con_qy1_mo) q, sum(f.con_val_mo) v
       from report.line_member m join trade.import_fact f on f.hts = m.hts
       left join ref.country ct on ct.cty_code = f.cty_code
      where m.line_id = $1 and f.yr = $2 and f.mo = $3 and f.rate_prov = 18
        and (m.valid_from is null or make_date(f.yr, f.mo, 1) >= m.valid_from)
        and (m.valid_to is null or make_date(f.yr, f.mo, 1) <= m.valid_to)
      group by 1 having sum(f.con_val_mo) > 0 order by 3 desc limit 8`,
    [line.lineId, ctx.yr, ctx.mo],
  );
  const list = rows.map((r) => `${r.country} (${quantity(tradeNumber(r.q, 'duty-free quantity'), line.unit ?? "KG", false)}, valued at ${money(tradeNumber(r.v, 'duty-free value'), false)})`).join("; ");
  return list
    ? `In ${ctx.p.month}, the leading suppliers of ${what} imports for consumption recorded as duty-free under special provisions (Census rate provision 18) were: ${list}.`
    : `No ${what} imports for consumption were recorded under the special duty-free provisions (Census rate provision 18) in ${ctx.p.month}.`;
}

// ------------------------------------------------------------------ Part 5: product imports

async function part5(ctx: Ctx): Promise<Chapter> {
  const { p } = ctx;
  const F = await figures(ctx, "IMPORT_PRODUCT", "consumption");
  const G = await figures(ctx, "IMPORT_PRODUCT", "general");
  const t = pick(F, "All Tobacco Products").total;
  const b: Block[] = [h("Total Imports")];
  b.push(para(
    `The customs value of tobacco products imported for consumption into the U.S. totaled ${money(t.valMo)} in ${p.month}${p.single ? "" : ` and ${money(t.valYtd)} for ${p.ytd()}`}. `
    + `This ${p.single ? "" : `${p.ytdAdj} `}figure was ${money(Math.abs(t.valYtd - t.valPrev))} ${pctParen(t.valYtd, t.valPrev)} ${t.valYtd >= t.valPrev ? "more" : "less"} than the comparable ${p.prevYr} figure of ${money(t.valPrev)}.`,
  ));
  b.push(await groupChart(ctx, "IMPORT_PRODUCT", "general", "val", 1000, "General Imports of Tobacco Products", "Thousands of Dollars"));

  const cig = pick(F, "Cigarettes"), ct = cig.total;
  const top = topCountries(cig, 4);
  b.push(h("Cigarettes"));
  b.push(para(
    `Consumption imports of cigarettes for ${p.ytd()} totaled ${quantity(ct.qtyYtd, "THS")} worth ${money(ct.valYtd)}, ${deltaPair(ct, "THS")} compared with the same period in ${p.prevYr}. `
    + `For the year-to-date, the U.S. imported the largest quantity of cigarettes (in descending order) from: `
    + `${listJoin(top.ranked.slice(0, 4).map((c, i) => `${c.country} (${(c.qtyYtd / ct.qtyYtd * 100).toFixed(1)}%${i ? "" : " of total"})`))} `
    + `with these ${["", "one", "two", "three", "four", "five"][top.names.length] ?? top.names.length} destinations accounting for ${top.share} of all cigarette imports, compared with ${top.prevShare} for the comparable period a year ago.`,
  ));
  const lg = pick(F, "Large Cigars including Cigarillos").total, hh = pick(F, "Large Cigars ATF H").total;
  b.push(h("Large Cigars"));
  b.push(para(
    `Large cigar imports for ${p.ytd()} totaled ${quantity(lg.qtyYtd, "THS")} valued at ${money(lg.valYtd)}, ${pctFirstPair(lg, "THS")} from ${p.like}. `
    + `For the year-to-date, ATF class H cigars, which accounted for ${share(hh.qtyYtd, lg.qtyYtd)} of total large cigars imported for consumption, `
    + `totaled ${quantity(hh.qtyYtd, "THS")}, valued at ${money(hh.valYtd)}. Compared with ${p.like}, class H cigars ${deltaPair(hh, "THS").replace(/^up/, "increased").replace(/^down/, "decreased").replace(/, but up/, ", but increased").replace(/, but down/, ", but decreased")}.`,
  ));
  b.push(await groupChart(ctx, "IMPORT_PRODUCT", "general", "qty", 1000, "General Imports of Tobacco Products", "Millions of Pieces", ["Cigarettes", "Cigars/Little Cigars"]));
  b.push(h("Duty-Free Cigars"));
  b.push(para(await specialProgramNote(ctx, "IMPORT_PRODUCT", "Large Cigars including Cigarillos", "large cigar")));

  const otp: [string, string][] = [
    ["little cigars", "Little Cigars"], ["water pipe (hookah) tobacco", "Water Pipe Tobacco"],
    ["packaged smoking tobacco", "Packaged Smoking Tobacco"], ["bulk and strip tobacco", "Bulk and Strip Smoking"],
    ["chewing tobacco", "Chewing Tobacco"], ["snuff and snuff flour", "Snuff and Snuff Flour"],
    ["homogenized tobacco", "Homogenized Tobacco"], ["novel tobacco products", "Novel Tobacco Products (No Combustion)"],
    ["other manufactured tobacco NESOI", "Other Manufactured Tobacco NESOI"],
  ];
  const tag = (noun: string, d: string) => { const f = pick(F, d).total; return { noun, f, ch: change(f.valYtd, f.valPrev) }; };
  const items = otp.map(([n, d]) => tag(n, d));
  const ups = items.filter((i) => i.ch.kind === "up" || i.ch.kind === "new");
  const downs = items.filter((i) => i.ch.kind === "down" || i.ch.kind === "gone");
  const fmt = (xs: typeof items) => listJoin(xs.map((i) => `${i.noun} ${pctParen(i.f.valYtd, i.f.valPrev)}`));
  b.push(h("Other Tobacco Products"));
  b.push(para(
    `For ${p.ytd()}, ${ups.length ? `consumption imports of ${fmt(ups)} showed increases in value when compared with ${p.like}` : `no other tobacco product category showed an increase in value compared with ${p.like}`}`
    + `${downs.length ? `, while consumption imports of ${fmt(downs)} showed decreases in value` : ""}.`,
  ));
  b.push(h("E-Liquid & Electronic Cigarettes"));
  const el = pick(F, "E-Liquid").total, ec = pick(F, "Electronic Cigarettes").total, onp = pick(F, "Other Nicotine Products").total;
  b.push(para([
    isEmpty(el) ? noneSentence("e-liquid imports", p) : `E-liquid imports ${ytdTotals(el, "KG")} in ${p.ytd()}, ${volValPhrase(el)} when compared with ${p.like}.`,
    isEmpty(ec) ? noneSentence("electronic cigarette imports", p) : `Electronic cigarette imports ${ytdTotals(ec, "NO")} in ${p.ytd()}, ${deltaPair(ec, "NO")} when compared with ${p.like}.`,
    isEmpty(onp) ? noneSentence("other nicotine product imports", p) : `Other nicotine products ${ytdTotals(onp, "KG")} in ${p.ytd()}, ${deltaPair(onp, "KG")} when compared with ${p.like}.`,
  ].join(" ")));
  released(ctx, b);
  return chapterOf(ctx, 5, "Imports of Tobacco Products", b,
    [...detailTables("Consumption Imports of", F, true, p), ...detailTables("General Imports of", G, true, p)]);
}

// ------------------------------------------------------------------ Part 6: accessories

async function part6(ctx: Ctx): Promise<Chapter> {
  const { p } = ctx;
  const F = await figures(ctx, "IMPORT_ACCESSORY", "consumption");
  const G = await figures(ctx, "IMPORT_ACCESSORY", "general");
  const t = pick(F, "All Smoker's Accessories").total;
  const b: Block[] = [h("Total Imports")];
  b.push(para(
    `The value of accessory product imports for consumption totaled ${money(t.valMo)} in ${p.month}${p.single ? "" : ` and aggregated to ${money(t.valYtd)} for ${p.ytd()}`}. `
    + `This ${p.single ? "" : `${p.ytdAdj} `}figure was ${money(Math.abs(t.valYtd - t.valPrev))} ${pctParen(t.valYtd, t.valPrev)} ${t.valYtd >= t.valPrev ? "more" : "less"} than the comparable ${p.prevYr} figure of ${money(t.valPrev)}.`,
  ));
  b.push(await groupChart(ctx, "IMPORT_ACCESSORY", "general", "val", 1000, "General Imports of Smokers’ Accessories", "Thousands of Dollars"));

  /** "totaled X, valued at Y, down 9.3 percent (-483,758 kilograms) in volume and ... from the comparable figures of ...". */
  const detailed = (subject: string, f: Figures, unit: string, noun?: string) => {
    if (isEmpty(f)) return noneSentence(subject.toLowerCase(), p);
    return `${capitalise(subject)} for ${p.ytd()} totaled ${quantity(f.qtyYtd, unit, true, noun)}, valued at ${money(f.valYtd)}, ${pctFirstPair(f, unit, noun)} `
      + `from the comparable ${p.prevYr} figures of ${quantity(f.qtyPrev, unit, true, noun)}, valued at ${money(f.valPrev)}.`;
  };
  const brief = (subject: string, f: Figures, unit: string, noun?: string) =>
    isEmpty(f) ? noneSentence(subject.toLowerCase(), p)
      : `${capitalise(subject)} totaled ${quantity(f.qtyYtd, unit, true, noun)}, valued at ${money(f.valYtd)} in ${p.ytd()}, ${volValPhrase(f)} when compared to ${p.like}.`;

  b.push(h("Cigarette Paper"));
  b.push(para(`${detailed("imports of cut cigarette papers", pick(F, "Cut Cigarette Papers").total, "KG")} ${brief("uncut cigarette paper imports", pick(F, "Uncut Cigarette Papers").total, "KG")}`));
  b.push(await groupChart(ctx, "IMPORT_ACCESSORY", "general", "qty", 1, "General Cigarette Paper Imports", "Kilograms", ["Cigarette Paper"]));
  b.push(h("Lighters"));
  b.push(para(`${detailed("imports of pocket lighters less than $5 per dozen", pick(F, "Pocket Lighters < $5/dozen").total, "DOZ")} ${brief("imports of pocket lighters greater than $5 per dozen", pick(F, "Pocket Lighters > $5/dozen").total, "DOZ")}`));
  b.push(h("Other Smokers’ Accessories"));
  b.push(para([
    brief("imports of briar and wood pipes", pick(F, "Briar And Wood Pipes").total, "NO"),
    brief("imports of briarroot rough in blocks", pick(F, "Brierroot Rough In Blocks").total, "GRS"),
    brief("imports of pipes of clay and other materials", pick(F, "Pipes Of Clay And Other Materials").total, "NO"),
  ].join(" ")));
  const parts = pick(F, "Parts of Electronic Cigarettes").total;
  b.push(para(isEmpty(parts) ? noneSentence("imports of parts of electronic cigarettes", p)
    : `Parts of electronic cigarette imports ${ytdTotals(parts, "NO")} for ${p.ytd()}, ${deltaPair(parts, "NO")} when compared to ${p.like}.`));
  released(ctx, b);
  return chapterOf(ctx, 6, "Imports of Smokers’ Accessories", b,
    [...detailTables("Consumption Imports", F, true, p), ...detailTables("General Imports", G, true, p)]);
}

// ------------------------------------------------------------------ assembly

function released(ctx: Ctx, b: Block[]) {
  b.push({ kind: "para", text: `Released ${ctx.releaseDate}`, italic: true });
}

function chapterOf(ctx: Ctx, partNo: number, title: string, narrative: Block[], tables: Block[]): Chapter {
  const sections: Section[] = [{ landscape: false, header: `US Trade Barometer: ${title} | ${ctx.p.month}`, blocks: narrative }];
  if (tables.length) sections.push({ landscape: true, header: `TMA Tobacco Trade Barometer Part ${partNo} ${title} | Month of ${ctx.p.month}`, blocks: tables });
  return { partNo, title, sections };
}

export async function buildReport(c: pg.ClientBase, yr: number, mo: number, inputs: Inputs, generatedAt = new Date()): Promise<Report> {
  assertReportInputs(inputs, yr, mo);
  const ctx: Ctx = { c, yr, mo, p: period(yr, mo), lines: await loadLines(c), inputs, cache: new Map(), releaseDate: generationDate(generatedAt) };
  const notes: string[] = [];
  for (const [label, t] of [["exports", "trade.export_fact"], ["imports", "trade.import_fact"]] as const) {
    for (const y of [yr, yr - 1]) {
      const { rows } = await c.query(`select 1 from ${t} where yr = $1 and mo = $2 limit 1`, [y, mo]);
      if (!rows.length) throw new Error(`Cannot generate a complete report: no ${label} loaded for ${monthName(mo)} ${y}.`);
    }
  }
  const chapters: Chapter[] = [];
  for (const build of [part1, part2, part3, part4, part5, part6]) {
    // Each chapter rotates its period wording from the start, like the published parts.
    ctx.p = period(yr, mo);
    chapters.push(await build(ctx));
  }
  const report = { title: "US Tobacco Trade Barometer", subtitle: period(yr, mo).month, chapters, notes };
  assertReportReady(report);
  return report;
}
