import { Resvg } from "@resvg/resvg-js";

export interface ChartSeries { name: string; values: number[] }
export interface ChartSpec {
  title: string;
  subtitle: string;
  units: string;
  labels: string[];
  series: ChartSeries[];
}

const PALETTE = ["#2E6DB4", "#8CC4EE", "#E8A33B", "#F2D17E", "#7FB069", "#9C9C9C", "#C0504D", "#6B4C9A"];
const FONT = "Calibri, Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A tidy axis step (1, 2, 2.5 or 5 times a power of ten) giving about five gridlines. */
function niceStep(range: number): number {
  const raw = range / 5 || 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)!;
}

/** Stacked monthly bar chart, positive values stacked up and negatives stacked down. */
export function stackedBarSvg(spec: ChartSpec, width = 640, height = 380): string {
  const n = spec.labels.length;
  const pos = new Array(n).fill(0), neg = new Array(n).fill(0);
  for (const s of spec.series) s.values.forEach((v, i) => (v >= 0 ? (pos[i] += v) : (neg[i] += v)));
  const max = Math.max(0, ...pos), min = Math.min(0, ...neg);
  const step = niceStep(max - min);
  const top = Math.ceil(max / step) * step || step, bottom = Math.floor(min / step) * step;

  const left = 70, right = 16, plotTop = 70, legendH = 22 + Math.ceil(spec.series.reduce((w, s) => w + 24 + s.name.length * 6.2, 0) / (width - 86)) * 18;
  const plotBottom = height - 28 - legendH;
  const plotW = width - left - right, plotH = plotBottom - plotTop;
  const y = (v: number) => plotTop + ((top - v) / (top - bottom)) * plotH;
  const band = plotW / n, barW = band * 0.6;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">`);
  out.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  out.push(`<text x="${width / 2}" y="22" text-anchor="middle" font-size="16" fill="#404040">${esc(spec.title)}</text>`);
  out.push(`<text x="${width / 2}" y="40" text-anchor="middle" font-size="12" fill="#595959">${esc(spec.subtitle)}</text>`);
  out.push(`<text x="${width / 2}" y="56" text-anchor="middle" font-size="11" fill="#7f7f7f">${esc(spec.units)}</text>`);
  for (let v = bottom; v <= top + step / 2; v += step) {
    out.push(`<line x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#808080" : "#d9d9d9"}" stroke-width="1"/>`);
    out.push(`<text x="${left - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#595959">${Math.round(v).toLocaleString("en-US")}</text>`);
  }
  for (let i = 0; i < n; i++) {
    const x = left + band * i + (band - barW) / 2;
    let up = 0, down = 0;
    spec.series.forEach((s, k) => {
      const v = s.values[i] ?? 0;
      if (!v) return;
      const from = v >= 0 ? up : down, to = from + v;
      if (v >= 0) up = to; else down = to;
      const y1 = y(Math.max(from, to)), y2 = y(Math.min(from, to));
      out.push(`<rect x="${x}" y="${y1}" width="${barW}" height="${Math.max(0.5, y2 - y1)}" fill="${PALETTE[k % PALETTE.length]}"/>`);
    });
    out.push(`<text x="${left + band * i + band / 2}" y="${plotBottom + 14}" text-anchor="middle" font-size="10" fill="#595959">${esc(spec.labels[i])}</text>`);
  }
  // Legend items flow left to right, wrapping when the row is full.
  let lx = left, ly = plotBottom + 34;
  spec.series.forEach((s, k) => {
    const w = 24 + s.name.length * 6.2;
    if (lx + w > width - right && lx > left) { lx = left; ly += 18; }
    out.push(`<rect x="${lx}" y="${ly - 9}" width="10" height="10" fill="${PALETTE[k % PALETTE.length]}"/>`);
    out.push(`<text x="${lx + 14}" y="${ly}" font-size="11" fill="#404040">${esc(s.name)}</text>`);
    lx += w;
  });
  out.push("</svg>");
  return out.join("\n");
}

export function svgToPng(svg: string, scale = 2): Buffer {
  const r = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
  });
  return Buffer.from(r.render().asPng());
}
