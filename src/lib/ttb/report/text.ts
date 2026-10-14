// Sentence builders shared by the chapter narratives.

import type { CountryFigures, Figures, LineFigures } from "./data";
import {
  type Period, type Verbs, capitalise, change, changePhrase, listJoin, money, pctParen, quantity,
  share, volValPhrase,
} from "./format";

/** "up 13.7 million kilograms (over +38.7%) in volume and $142.8 million (+45.8%) in value". */
export function deltaPair(f: Figures, unit: string | null, noun?: string): string {
  const dq = f.qtyYtd - f.qtyPrev, dv = f.valYtd - f.valPrev;
  const q = `${quantity(Math.abs(dq), unit, true, noun)} ${pctParen(f.qtyYtd, f.qtyPrev)}`;
  const v = `${money(Math.abs(dv))} ${pctParen(f.valYtd, f.valPrev)}`;
  const qUp = dq >= 0, vUp = dv >= 0;
  if (qUp === vUp) return `${qUp ? "up" : "down"} ${q} in volume and ${v} in value`;
  return `${qUp ? "up" : "down"} ${q} in volume, but ${vUp ? "up" : "down"} ${v} in value`;
}

/** Puts a sign after any qualifier: ("nearly 130.6 million pieces", "-") -> "nearly -130.6 million pieces". */
function signed(text: string, sign: string): string {
  const m = text.match(/^(over |more than |nearly |almost )?(.*)$/)!;
  return `${m[1] ?? ""}${sign}${m[2]}`;
}

/** Percent first: "down almost 5.0 percent (nearly -130.6 million pieces) in volume, but up ...". */
export function pctFirstPair(f: Figures, unit: string | null, noun?: string): string {
  const part = (cur: number, prev: number, abs: string) =>
    `${changePhrase(cur, prev)} (${signed(abs, cur >= prev ? "+" : "-")})`;
  const q = part(f.qtyYtd, f.qtyPrev, quantity(Math.abs(f.qtyYtd - f.qtyPrev), unit, true, noun));
  const v = part(f.valYtd, f.valPrev, money(Math.abs(f.valYtd - f.valPrev)));
  const same = (f.qtyYtd >= f.qtyPrev) === (f.valYtd >= f.valPrev);
  return `${q} in volume${same ? " and " : ", but "}${v} in value`;
}

export const isEmpty = (f: Figures) => !f.qtyYtd && !f.qtyPrev && !f.valYtd && !f.valPrev;

export function noneSentence(noun: string, p: Period): string {
  return `There were no ${noun} for either year-to-date ${p.yr} or ${p.prevYr}.`;
}

export interface Item { noun: string; f: LineFigures }

/**
 * Pairs of comparisons: "For year-to-date 2024, A decreased ... compared with like 2023,
 * while B increased ...". Lines with no trade in either year get a "There were no ..." sentence.
 */
export function comparisons(items: Item[], p: Period, verbs: Verbs = "creased"): string {
  const out: string[] = [];
  const none = items.filter((i) => isEmpty(i.f.total));
  const live = items.filter((i) => !isEmpty(i.f.total));
  for (const i of none) out.push(noneSentence(i.noun, p));
  for (let k = 0; k < live.length; k += 2) {
    const a = live[k], b = live[k + 1];
    const first = `For ${p.ytd()}, ${a.noun} ${volValPhrase(a.f.total, verbs)} compared with ${p.like}`;
    out.push(b ? `${first}, while ${b.noun} ${volValPhrase(b.f.total, verbs)}.` : `${first}.`);
  }
  return out.join(" ");
}

/** "totaled 66,186 kilograms valued at nearly $1.3 million" for the YTD period. */
export function ytdTotals(f: Figures, unit: string | null, noun?: string): string {
  return `totaled ${quantity(f.qtyYtd, unit, true, noun)} valued at ${money(f.valYtd)}`;
}

export interface TopCountries { names: string[]; share: string; prevShare: string; ranked: CountryFigures[] }

/** The n largest countries by YTD quantity, their share, and the same countries' share a year earlier. */
export function topCountries(f: LineFigures, n: number): TopCountries {
  const ranked = [...f.countries].filter((c) => c.qtyYtd > 0).sort((a, b) => b.qtyYtd - a.qtyYtd);
  const top = ranked.slice(0, n);
  const sum = (k: "qtyYtd" | "qtyPrev") => top.reduce((s, c) => s + c[k], 0);
  return {
    names: top.map((c) => c.country),
    share: share(sum("qtyYtd"), f.total.qtyYtd),
    prevShare: share(sum("qtyPrev"), f.total.qtyPrev),
    ranked,
  };
}

export { capitalise, listJoin };
