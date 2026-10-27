/** Price-chart maths. Pure, so every number on the chart can be tested.
 *  Input is daily closes (split-adjusted, dividends NOT reinvested): the price that traded, which is what the exchange publishes. */
/** `n` is the Nifty 50 close on the same day, or null/absent when it is not held for that day. */
/** `o`, `h`, `l`, `v` are the day's open, high, low and volume where Yahoo printed them; absent or null otherwise, never filled from the close. */
export interface Pt { t: number; c: number; n?: number | null; o?: number | null; h?: number | null; l?: number | null; v?: number | null }
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
/** "14 months" or "5.0 years": how much history a span of `years` is, in the words the chart uses everywhere. */
export function spanWord(years: number): string { return years >= 1.5 ? `${years.toFixed(years >= 10 ? 0 : 1)} years` : `${Math.max(1, Math.round(years * 12))} months`; }
/** Which of the five ranges the history can fill. A range longer than the history is not offered: its note says how much there is instead of drawing the same line under another name. */
export function rangeAvailability(pts: readonly Pt[]): { id: RangeId; available: boolean; note: string | null }[] {
  const years = pts.length > 1 ? (pts[pts.length - 1].t - pts[0].t) / (365.25 * DAY) : 0;
  return RANGES.map((r) => { const ok = r.id === 'Max' || sliceRange(pts, r.id).covers; return { id: r.id, available: ok, note: ok ? null : `${r.id}: only ${spanWord(years)} of history` }; });
}
/** The range a chart opens on: ten years where there are ten years, otherwise everything that exists (Max). Never a range the history cannot fill. */
export function defaultRange(pts: readonly Pt[]): RangeId { return rangeAvailability(pts).find((r) => r.id === '10Y')?.available ? '10Y' : 'Max'; }
export type Frame = 'daily' | 'weekly' | 'monthly';
const dayOf = (t: number) => Math.floor((t + 19800) / 86400);
/** One bar per period. The close, time and Nifty close are the period's LAST day's; the open is the first day's; the high and low are the extremes of the days that printed one;
 *  the volume is the sum of the days that printed one. A period in which no day printed a field leaves it null. The final, unfinished period is a bar of the days so far.
 *  Weeks run Monday to Sunday by the Indian date; months are calendar months. */
export function aggregate(pts: readonly Pt[], frame: Frame): Pt[] {
  if (frame === 'daily') return [...pts];
  const keyOf = (t: number) => { if (frame === 'weekly') return String(Math.floor((dayOf(t) + 3) / 7)); const d = ist(t); return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; };
  const out: Pt[] = []; let key = '';
  for (const p of pts) {
    const k = keyOf(p.t);
    if (k !== key) { out.push({ ...p }); key = k; continue; }
    const b = out[out.length - 1];
    const hi = [b.h, p.h, p.c].filter((x): x is number => typeof x === 'number'), lo = [b.l, p.l, p.c].filter((x): x is number => typeof x === 'number');
    // the period's high and low must include every close in it even when a day printed no high or low of its own
    out[out.length - 1] = { t: p.t, c: p.c, n: p.n, o: b.o ?? null, h: b.h == null && p.h == null && b.o == null ? null : Math.max(...hi, b.o ?? -Infinity), l: b.l == null && p.l == null && b.o == null ? null : Math.min(...lo, b.o ?? Infinity), v: b.v == null && p.v == null ? null : (b.v ?? 0) + (p.v ?? 0) };
  }
  return out;
}
/** The last close of each calendar month (Indian date). The final, unfinished month keeps its latest close. */
export function monthly(pts: readonly Pt[]): Pt[] { return aggregate(pts, 'monthly'); }
/** Wilder's Relative Strength Index. `n` closes of change are averaged to seed it (a simple mean), then each later value is smoothed (previous * (n-1) + today) / n.
 *  The first value is at index n; before that, and where no price has moved at all, null. 100 = only gains in the average, 0 = only losses. */
export function rsiSeries(closes: readonly number[], n = 14): (number | null)[] {
  const out: (number | null)[] = closes.map(() => null); if (closes.length <= n) return out;
  let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n; const val = () => (g === 0 && l === 0 ? null : l === 0 ? 100 : 100 - 100 / (1 + g / l)); out[n] = val();
  for (let i = n + 1; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; g = (g * (n - 1) + (d > 0 ? d : 0)) / n; l = (l * (n - 1) + (d < 0 ? -d : 0)) / n; out[i] = val(); }
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
export interface Geo { min: number; max: number; line: string; area: string; xs: number[]; ys: number[]; W: number; H: number; yOf: (c: number) => number; xOf: (t: number) => number; barW: number; padL: number; padR: number }
/** How the x axis is inset. `bars`: candles or volume bars are drawn about each x, so the first and the last are given half a bar of room on their outer side and are drawn whole.
 *  `gutter` (in the same units as W) keeps the right-hand strip clear of data, for the price tag and the axis labels. */
export interface GeoOpts { bars?: boolean; gutter?: number }
const MAX_BAR = 18;
/** The width of one bar in W units: 62% of the usual spacing, never more than MAX_BAR and never less than 1.2. */
const barWidth = (gapFrac: number, inner: number) => Math.max(1.2, Math.min(MAX_BAR, gapFrac * inner * 0.62));
/** SVG paths in a W by H box. x is proportional to TIME (a weekend is a gap, not a point). `log` plots the percentage move, which is the honest view over ten years.
 *  With `opts.bars` the x domain is padded by half a bar at both ends (and `opts.gutter` more on the right), so every body and wick lies inside [0, W] at any range or frame. */
export function geometry(pts: readonly Pt[], log: boolean, W = 1000, H = 300, pad = 12, hl = false, opts: GeoOpts = {}): Geo | null {
  if (pts.length < 2) return null;
  const f = (c: number) => (log ? Math.log(c) : c);
  // with `hl` the scale also takes in each bar's high and low, so a candle never leaves the plot
  const cs = pts.flatMap((p) => (hl ? [p.c, p.h ?? p.c, p.l ?? p.c] : [p.c])).map(f); let lo = Math.min(...cs), hi = Math.max(...cs); if (hi === lo) { hi += 1; lo -= 1; }
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(1, t1 - t0);
  const gutter = Math.max(0, opts.gutter ?? 0);
  // the usual spacing as a share of the span: the median gap, so one long holiday does not set the bar width
  const gaps = pts.slice(1).map((p, k) => p.t - pts[k].t).sort((a, b) => a - b); const gapFrac = (gaps[Math.floor(gaps.length / 2)] ?? span) / span;
  let barW = 0, padL = 0, padR = gutter;
  if (opts.bars) {
    // half a bar and one unit of stroke on each outer side; the bar width depends on the room left, so settle it by iteration (it only shrinks)
    barW = barWidth(gapFrac, Math.max(1, W - gutter));
    for (let k = 0; k < 8; k++) { const next = barWidth(gapFrac, Math.max(1, W - gutter - barW - 2)); if (Math.abs(next - barW) < 0.01) break; barW = Math.min(barW, next); }
    padL = barW / 2 + 1; padR = gutter + barW / 2 + 1;
  }
  const inner = Math.max(1, W - padL - padR);
  const xOf = (t: number) => padL + ((t - t0) / span) * inner;
  const yOf = (c: number) => pad + (1 - (f(c) - lo) / (hi - lo)) * (H - 2 * pad);
  const xs = pts.map((p) => xOf(p.t)), ys = pts.map((p) => yOf(p.c));
  const r = (v: number) => Math.round(v * 10) / 10;
  const line = xs.map((x, i) => `${i ? 'L' : 'M'}${r(x)} ${r(ys[i])}`).join('');
  const all = pts.flatMap((p) => (hl ? [p.c, p.h ?? p.c, p.l ?? p.c] : [p.c]));
  return { min: Math.min(...all), max: Math.max(...all), line, area: `${line}L${r(xs[xs.length - 1])} ${H}L${r(xs[0])} ${H}Z`, xs, ys, W, H, yOf, xOf, barW, padL, padR };
}
/** The index of the point whose x is closest to `u` (in the same units as the xs), for a pointer that may sit in a padded margin or the gutter. */
export function nearestX(xs: readonly number[], u: number): number {
  if (!xs.length) return -1; let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= u) lo = m; else hi = m; }
  return Math.abs(xs[lo] - u) <= Math.abs(xs[hi] - u) ? lo : hi;
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

/** Several stocks on one axis, each indexed to 100 on the first day ALL of them traded in the window, with the Nifty (from the first stock's
 *  feed) indexed the same day. Only days every stock has a close are kept, so no line is filled across a day it did not trade. */
export interface Series { id: string; t: number[]; c: number[]; n?: (number | null)[] | null }
export interface Aligned { t: number[]; lines: { id: string; v: number[] }[]; nifty: number[] | null }
export function alignIndexed(series: readonly Series[], id: RangeId): Aligned | null {
  if (series.length < 2) return null;
  const day = (x: number) => Math.floor((x + 19800) / 86400);
  const maps = series.map((s) => { const m = new Map<number, { t: number; c: number; n: number | null }>(); s.t.forEach((t, i) => { if (s.c[i] > 0) m.set(day(t), { t, c: s.c[i], n: s.n?.[i] ?? null }); }); return m; });
  let days = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b);
  if (days.length < 2) return null;
  const years = RANGES.find((r) => r.id === id)!.years;
  if (years !== null) { const from = days[days.length - 1] - Math.round(years * 365.25); days = days.filter((d) => d >= from); }
  if (days.length < 2) return null;
  const lines = series.map((s, i) => { const base = maps[i].get(days[0])!.c; return { id: s.id, v: days.map((d) => (maps[i].get(d)!.c / base) * 100) }; });
  const nv = days.map((d) => maps[0].get(d)!.n); let nifty: number[] | null = null;
  if (typeof nv[0] === 'number' && nv[0] > 0) { let carry = nv[0]; const n0 = nv[0]; nifty = nv.map((v) => { if (typeof v === 'number' && v > 0) carry = v; return (carry / n0) * 100; }); }
  return { t: days.map((d) => maps[0].get(d)!.t), lines, nifty };
}

/** Round values for the price axis: about `n` of them, at 1, 2, 2.5 or 5 times a power of ten (linear), or at 1, 2 and 5 times a power of ten (log). */
export function yTicks(lo: number, hi: number, log: boolean, n = 4): number[] {
  if (!(hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (log) {
    if (!(lo > 0)) return [];
    for (const ms of [[1, 2, 5], [1, 3], [1]]) {
      const out: number[] = []; for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of ms) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v); }
      if (out.length <= n + 1) return out;
    }
    return [];
  }
  const raw = (hi - lo) / n; const mag = 10 ** Math.floor(Math.log10(raw)); const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw)!;
  const out: number[] = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v * 1e8) / 1e8);
  return out;
}
/** Labels for the time axis, at positions proportional to time: years for a long window, months for a short one. At most `max` labels. */
export function xTicks(t0: number, t1: number, max = 5): { t: number; label: string }[] {
  if (!(t1 > t0)) return [];
  const spanY = (t1 - t0) / (365.25 * DAY); const d0 = ist(t0); const out: { t: number; label: string }[] = [];
  if (spanY >= 1.3) {
    const y0 = d0.getUTCFullYear() + 1; const y1 = ist(t1).getUTCFullYear(); const step = Math.max(1, Math.ceil((y1 - y0 + 1) / max));
    for (let y = y0; y <= y1; y += step) { const t = Date.UTC(y, 0, 1) / 1000 - 19800; if (t > t0 && t < t1) out.push({ t, label: String(y) }); }
  } else {
    const m = Math.max(1, Math.ceil((spanY * 12) / max)); let y = d0.getUTCFullYear(), mo = d0.getUTCMonth() + 1;
    for (;;) { if (mo > 11) { mo -= 12; y++; } const t = Date.UTC(y, mo, 1) / 1000 - 19800; if (t >= t1) break; if (t > t0) out.push({ t, label: `${MON[mo]}${mo === 0 ? ` ${y}` : ''}` }); mo += m; }
  }
  return out;
}

/** Simple moving average of the closes, one value per point, null until `n` closes exist. */
export function smaSeries(pts: readonly Pt[], n: number): (number | null)[] {
  const out: (number | null)[] = []; let sum = 0;
  for (let i = 0; i < pts.length; i++) { sum += pts[i].c; if (i >= n) sum -= pts[i - n].c; out.push(i >= n - 1 ? sum / n : null); }
  return out;
}
/** Percent below the running peak since the first point of the window (zero at a new high, never positive). */
export function drawdownSeries(pts: readonly Pt[]): number[] {
  let peak = -Infinity; return pts.map((p) => { peak = Math.max(peak, p.c); return peak > 0 ? (p.c / peak - 1) * 100 : 0; });
}
/** An SVG path through the non-null values at the given x and y positions; a gap (null) lifts the pen. */
export function pathThrough(xs: readonly number[], ys: readonly (number | null)[]): string {
  let d = '', pen = false; for (let i = 0; i < xs.length; i++) { const y = ys[i]; if (y === null || !Number.isFinite(y)) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${Math.round(xs[i] * 10) / 10} ${Math.round(y * 10) / 10}`; pen = true; } return d;
}
