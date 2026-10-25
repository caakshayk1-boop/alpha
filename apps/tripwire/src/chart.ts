/** Price-chart maths. Pure, so every number on the chart can be tested.
 *  Input is daily closes (split-adjusted, dividends NOT reinvested): the price that traded, which is what the exchange publishes. */
/** `n` is the Nifty 50 close on the same day, or null/absent when it is not held for that day. */
export interface Pt { t: number; c: number; n?: number | null }
export type RangeId = '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
export const RANGES: { id: RangeId; years: number | null }[] = [{ id: '1Y', years: 1 }, { id: '3Y', years: 3 }, { id: '5Y', years: 5 }, { id: '10Y', years: 10 }, { id: 'Max', years: null }];
const DAY = 86400;
const ist = (t: number) => new Date((t + 19800) * 1000);

/** The window ending at the last point. A range longer than the history is the whole history, and says so (see `covers`). */
export function sliceRange(pts: readonly Pt[], id: RangeId): { pts: Pt[]; covers: boolean } {
  if (!pts.length) return { pts: [], covers: false };
  const years = RANGES.find((r) => r.id === id)!.years;
  if (years === null) return { pts: [...pts], covers: true };
  const end = pts[pts.length - 1].t; const from = end - years * 365.25 * DAY;
  const out = pts.filter((p) => p.t >= from);
  return { pts: out, covers: pts[0].t <= from + 7 * DAY };
}
/** The last close of each calendar month (Indian date). The final, unfinished month keeps its latest close. */
export function monthly(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = []; let key = '';
  for (const p of pts) { const d = ist(p.t); const k = `${d.getUTCFullYear()}-${d.getUTCMonth()}`; if (k === key) out[out.length - 1] = p; else { out.push(p); key = k; } }
  return out;
}
/** Keep at most about `max` points without losing a peak or a trough: each bucket keeps its lowest and highest close, in time order. */
export function downsample(pts: readonly Pt[], max: number): Pt[] {
  if (pts.length <= max) return [...pts];
  const per = Math.ceil(pts.length / (max / 2)); const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i += per) {
    const b = pts.slice(i, Math.min(i + per, pts.length - 1)); if (!b.length) continue;
    let lo = b[0], hi = b[0]; for (const p of b) { if (p.c < lo.c) lo = p; if (p.c > hi.c) hi = p; }
    for (const p of lo.t <= hi.t ? [lo, hi] : [hi, lo]) if (p !== out[out.length - 1]) out.push(p);
  }
  out.push(pts[pts.length - 1]); return out;
}
export interface Stats { first: Pt; last: Pt; ret: number; hi: Pt; lo: Pt; cagr: number | null; years: number }
export function stats(pts: readonly Pt[]): Stats | null {
  if (pts.length < 2) return null;
  const first = pts[0], last = pts[pts.length - 1]; let hi = first, lo = first;
  for (const p of pts) { if (p.c > hi.c) hi = p; if (p.c < lo.c) lo = p; }
  const years = (last.t - first.t) / (365.25 * DAY);
  return { first, last, ret: (last.c / first.c - 1) * 100, hi, lo, years, cagr: years >= 2 && first.c > 0 && last.c > 0 ? (Math.pow(last.c / first.c, 1 / years) - 1) * 100 : null };
}
export interface Geo { line: string; area: string; xs: number[]; ys: number[]; W: number; H: number; yOf: (c: number) => number; xOf: (t: number) => number }
/** SVG paths in a W by H box. x is proportional to TIME (a weekend is a gap, not a point). `log` plots the percentage move, which is the honest view over ten years. */
export function geometry(pts: readonly Pt[], log: boolean, W = 1000, H = 300, pad = 12): Geo | null {
  if (pts.length < 2) return null;
  const f = (c: number) => (log ? Math.log(c) : c);
  const cs = pts.map((p) => f(p.c)); let lo = Math.min(...cs), hi = Math.max(...cs); if (hi === lo) { hi += 1; lo -= 1; }
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(1, t1 - t0);
  const xOf = (t: number) => ((t - t0) / span) * W;
  const yOf = (c: number) => pad + (1 - (f(c) - lo) / (hi - lo)) * (H - 2 * pad);
  const xs = pts.map((p) => xOf(p.t)), ys = pts.map((p) => yOf(p.c));
  const r = (v: number) => Math.round(v * 10) / 10;
  const line = xs.map((x, i) => `${i ? 'L' : 'M'}${r(x)} ${r(ys[i])}`).join('');
  return { line, area: `${line}L${r(xs[xs.length - 1])} ${H}L${r(xs[0])} ${H}Z`, xs, ys, W, H, yOf, xOf };
}
/** The point closest in time to a fraction (0..1) of the way across the window. */
export function nearest(pts: readonly Pt[], frac: number): number {
  if (!pts.length) return -1;
  const t = pts[0].t + Math.min(1, Math.max(0, frac)) * (pts[pts.length - 1].t - pts[0].t);
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= t) lo = m; else hi = m; }
  return Math.abs(pts[lo].t - t) <= Math.abs(pts[hi].t - t) ? lo : hi;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateLabel(t: number, monthlyView = false): string { const d = ist(t); return monthlyView ? `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` : `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }

/** Stock against the Nifty over the same window, both indexed to 100 at the first day the Nifty is held. A missing Nifty day carries the
 *  previous close forward on the plot (a holiday the stock did not share); days before the first Nifty figure are left out and reported. */
export interface Compare { a: Pt[]; b: Pt[]; from: Pt; trimmed: boolean; stock: number; nifty: number; diff: number }
export function compareSeries(pts: readonly Pt[]): Compare | null {
  const k = pts.findIndex((p) => typeof p.n === 'number' && p.n > 0);
  if (k < 0 || pts.length - k < 2) return null;
  const w = pts.slice(k), c0 = w[0].c, n0 = w[0].n as number; let carry = n0;
  const a = w.map((p) => ({ t: p.t, c: (p.c / c0) * 100 }));
  const b = w.map((p) => { if (typeof p.n === 'number' && p.n > 0) carry = p.n; return { t: p.t, c: (carry / n0) * 100 }; });
  const stock = a[a.length - 1].c - 100, nifty = b[b.length - 1].c - 100;
  return { a, b, from: w[0], trimmed: k > 0, stock, nifty, diff: stock - nifty };
}
/** Two lines on one shared scale and one shared time axis. */
export function geometryPair(a: readonly Pt[], b: readonly Pt[], log: boolean, W = 1000, H = 300, pad = 12): { lineA: string; lineB: string; area: string; xs: number[]; ysA: number[]; ysB: number[]; W: number; H: number } | null {
  if (a.length < 2 || a.length !== b.length) return null;
  const f = (c: number) => (log ? Math.log(c) : c); const all = [...a, ...b].map((p) => f(p.c));
  let lo = Math.min(...all), hi = Math.max(...all); if (hi === lo) { hi += 1; lo -= 1; }
  const t0 = a[0].t, t1 = a[a.length - 1].t, span = Math.max(1, t1 - t0); const r = (v: number) => Math.round(v * 10) / 10;
  const xs = a.map((p) => ((p.t - t0) / span) * W); const y = (c: number) => pad + (1 - (f(c) - lo) / (hi - lo)) * (H - 2 * pad);
  const ysA = a.map((p) => y(p.c)), ysB = b.map((p) => y(p.c));
  const path = (ys: number[]) => xs.map((x, i) => `${i ? 'L' : 'M'}${r(x)} ${r(ys[i])}`).join('');
  const lineA = path(ysA);
  return { lineA, lineB: path(ysB), area: `${lineA}L${r(xs[xs.length - 1])} ${H}L${r(xs[0])} ${H}Z`, xs, ysA, ysB, W, H };
}
