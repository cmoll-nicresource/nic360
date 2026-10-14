import type pg from "pg";

/** Which set of measures a figure comes from. */
export type Basis = "export" | "consumption" | "general";

export interface Line {
  lineId: number;
  chapterId: string;
  sortOrder: number;
  description: string;
  part1Desc: string;
  shortName: string;
  indent: number;
  chartGroup: string | null;
  qtyDivisor: number;
  isTotal: boolean;
  /** Census quantity unit shared by the line's members (KG, THS, NO, DOZ, GRS), or null when mixed. */
  unit: string | null;
}

/** Month, year-to-date and prior year-to-date figures for one line (optionally one country). */
export interface Figures {
  qtyMo: number; valMo: number; cifMo: number;
  qtyYtd: number; valYtd: number; cifYtd: number;
  qtyPrev: number; valPrev: number; cifPrev: number;
  /** Same month a year earlier. */
  qtyPrevMo: number; valPrevMo: number;
}

export interface CountryFigures extends Figures {
  ctyCode: number;
  country: string;
}

export interface LineFigures {
  line: Line;
  total: Figures;
  countries: CountryFigures[];
}

export const zero = (): Figures => ({
  qtyMo: 0, valMo: 0, cifMo: 0, qtyYtd: 0, valYtd: 0, cifYtd: 0, qtyPrev: 0, valPrev: 0, cifPrev: 0,
  qtyPrevMo: 0, valPrevMo: 0,
});

const flowOf = (b: Basis) => (b === "export" ? "export" : "import");

/** Column expressions for quantity, value and CIF (customs value + charges) on each basis. */
function measureSql(b: Basis, suffix: "mo" | "yr") {
  const q = (col: string) => `case when ${DOZEN_LINE} and h.unit_qy1 = 'NO' then ${col} / 12.0 else ${col} end`;
  if (b === "export") return { q: q(`f.all_qy1_${suffix}`), v: `f.all_val_${suffix}`, c: `f.all_val_${suffix}` };
  const p = b === "consumption" ? "con" : "gen";
  return { q: q(`f.${p}_qy1_${suffix}`), v: `f.${p}_val_${suffix}`, c: `f.${p}_val_${suffix} + f.${p}_cha_${suffix}` };
}

/**
 * Lines reported in dozens (pocket lighters) mix codes counted in pieces with codes counted
 * in dozens; the layout marks them with qty_multiplier 12, and pieces are divided by 12.
 */
const DOZEN_LINE = "l.qty_multiplier = 12";
const lineJoins = "join report.line l on l.line_id = m.line_id join ref.hts h on h.hts = m.hts";

function factSql(b: Basis) {
  return b === "export"
    ? "trade.export_fact f on f.hts = m.hts and f.dom_or_for = 1"
    : "trade.import_fact f on f.hts = m.hts";
}

const memberValid = `(m.valid_from is null or make_date(f.yr, f.mo, 1) >= m.valid_from)
     and (m.valid_to is null or make_date(f.yr, f.mo, 1) <= m.valid_to)`;

export async function loadLines(c: pg.ClientBase): Promise<Map<string, Line[]>> {
  const { rows } = await c.query(`
    select l.*, (select case when count(distinct h.unit_qy1) = 1 then min(h.unit_qy1) end
                   from report.line_member m join ref.hts h using (hts)
                  where m.line_id = l.line_id and h.unit_qy1 is not null) as unit
      from report.line l order by chapter_id, sort_order`);
  const out = new Map<string, Line[]>();
  for (const r of rows) {
    const line: Line = {
      lineId: r.line_id, chapterId: r.chapter_id, sortOrder: r.sort_order, description: r.description,
      part1Desc: r.part1_desc ?? r.description.toUpperCase(), shortName: r.short_name ?? r.description,
      indent: r.indent, chartGroup: r.chart_group || null, qtyDivisor: Number(r.qty_divisor ?? 1) || 1,
      isTotal: r.is_total, unit: r.unit,
    };
    if (!out.has(line.chapterId)) out.set(line.chapterId, []);
    out.get(line.chapterId)!.push(line);
  }
  return out;
}

/**
 * Month, YTD and prior-year YTD figures for every line of a chapter, by country and in total.
 * YTD figures come from the Census `_YR` columns of the as-of month in each year.
 */
export async function loadChapterFigures(
  c: pg.ClientBase, lines: Line[], basis: Basis, yr: number, mo: number,
): Promise<LineFigures[]> {
  const mm = measureSql(basis, "mo");
  const yy = measureSql(basis, "yr");
  const ids = lines.map((l) => l.lineId);
  const { rows } = await c.query(
    `select m.line_id, f.cty_code, coalesce(ct.name, f.cty_code::text) as country, f.yr,
            sum(${mm.q}) q_mo, sum(${mm.v}) v_mo, sum(${mm.c}) c_mo,
            sum(${yy.q}) q_yr, sum(${yy.v}) v_yr, sum(${yy.c}) c_yr
       from report.line_member m ${lineJoins}
       join ${factSql(basis)} and ${memberValid}
       left join ref.country ct on ct.cty_code = f.cty_code
      where m.line_id = any($1) and f.mo = $3 and f.yr in ($2, $2 - 1)
      group by 1, 2, 3, 4`,
    [ids, yr, mo],
  );
  const byLine = new Map<number, Map<number, CountryFigures>>();
  for (const r of rows) {
    if (!byLine.has(r.line_id)) byLine.set(r.line_id, new Map());
    const m = byLine.get(r.line_id)!;
    if (!m.has(r.cty_code)) m.set(r.cty_code, { ctyCode: r.cty_code, country: r.country, ...zero() });
    const f = m.get(r.cty_code)!;
    if (r.yr === yr) {
      f.qtyMo += r.q_mo; f.valMo += r.v_mo; f.cifMo += r.c_mo;
      f.qtyYtd += r.q_yr; f.valYtd += r.v_yr; f.cifYtd += r.c_yr;
    } else {
      f.qtyPrev += r.q_yr; f.valPrev += r.v_yr; f.cifPrev += r.c_yr;
      f.qtyPrevMo += r.q_mo; f.valPrevMo += r.v_mo;
    }
  }
  const units = await unitsInUse(c, basis, ids, yr);
  return lines.map((line) => {
    if (units.has(line.lineId)) line = { ...line, unit: units.get(line.lineId)! };
    const countries = [...(byLine.get(line.lineId)?.values() ?? [])]
      .filter((f) => f.qtyMo || f.valMo || f.qtyYtd || f.valYtd || f.qtyPrev || f.valPrev)
      .sort((a, b) => a.country.localeCompare(b.country));
    const total = zero();
    for (const f of countries) for (const k of Object.keys(total) as (keyof Figures)[]) total[k] += f[k];
    return { line, total, countries };
  });
}

/**
 * The quantity unit of each line, looking only at commodity codes with trade in the
 * current or prior year (old codes in another unit would otherwise make a line look mixed).
 * Lines whose active codes still mix units map to null.
 */
async function unitsInUse(c: pg.ClientBase, basis: Basis, ids: number[], yr: number) {
  const t = basis === "export" ? "trade.export_fact" : "trade.import_fact";
  const { rows } = await c.query(
    `select m.line_id, array_agg(distinct case when ${DOZEN_LINE} and h.unit_qy1 = 'NO' then 'DOZ' else h.unit_qy1 end) as units
       from report.line_member m ${lineJoins}
      where m.line_id = any($1) and h.unit_qy1 is not null
        and exists (select 1 from ${t} f where f.hts = m.hts and f.yr in ($2, $2 - 1))
      group by 1`,
    [ids, yr],
  );
  return new Map<number, string | null>(rows.map((r) => [r.line_id, r.units.length === 1 ? r.units[0] : null]));
}

export interface MonthPoint { yr: number; mo: number; qty: number; val: number }

/** Monthly (not cumulative) quantity and value per line between two months inclusive. */
export async function loadMonthlySeries(
  c: pg.ClientBase, lines: Line[], basis: Basis, from: [number, number], to: [number, number],
): Promise<Map<number, MonthPoint[]>> {
  const mm = measureSql(basis, "mo");
  const { rows } = await c.query(
    `select m.line_id, f.yr, f.mo, sum(${mm.q}) q, sum(${mm.v}) v
       from report.line_member m ${lineJoins}
       join ${factSql(basis)} and ${memberValid}
      where m.line_id = any($1) and (f.yr * 12 + f.mo) between $2 and $3
      group by 1, 2, 3`,
    [lines.map((l) => l.lineId), from[0] * 12 + from[1], to[0] * 12 + to[1]],
  );
  const out = new Map<number, MonthPoint[]>();
  for (const l of lines) {
    const pts: MonthPoint[] = [];
    for (let k = from[0] * 12 + from[1]; k <= to[0] * 12 + to[1]; k++) {
      const y = Math.floor((k - 1) / 12), m = ((k - 1) % 12) + 1;
      pts.push({ yr: y, mo: m, qty: 0, val: 0 });
    }
    out.set(l.lineId, pts);
  }
  for (const r of rows) {
    const pts = out.get(r.line_id)!;
    const p = pts.find((x) => x.yr === r.yr && x.mo === r.mo);
    if (p) { p.qty = r.q; p.val = r.v; }
  }
  return out;
}

/** Months of the as-of year that have been loaded for a flow, used to warn about gaps. */
export async function loadedMonths(c: pg.ClientBase, basis: Basis, yr: number): Promise<number[]> {
  const t = flowOf(basis) === "export" ? "trade.export_fact" : "trade.import_fact";
  const { rows } = await c.query(`select distinct mo from ${t} where yr = $1 order by 1`, [yr]);
  return rows.map((r) => r.mo);
}

/** Figures for one line in a list, by description (case-insensitive). */
export function pick(figs: LineFigures[], description: string): LineFigures {
  const f = figs.find((x) => x.line.description.toLowerCase() === description.toLowerCase());
  if (!f) throw new Error(`report line not found: ${description}`);
  return f;
}
