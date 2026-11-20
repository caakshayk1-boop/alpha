/** Pure helpers for the stock price chart (ADR-020). No DOM. Everything the chart draws comes from the daily candles the Worker returns; nothing is invented. */
export interface C { t: string; o: number; h: number; l: number; c: number; v: number | null }
export type Interval = 'D' | 'W' | 'M';
export type Range = '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';
export const RANGE_DAYS: Record<Range, number | null> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '5Y': 1826, MAX: null };
export const MAX_CANDLES = 120;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayMs = (t: string) => Date.parse(t + 'T00:00:00Z');
/** Weekly and monthly candles built from the same daily candles: first open, highest high, lowest low, last close, summed volume (null if any day lacks one). */
export function roll(d: C[], key: (t: string) => string): C[] {
  const out: C[] = []; let k = '';
  for (const x of d) { const kk = key(x.t); if (kk !== k) { k = kk; out.push({ ...x, t: x.t }); } else { const a = out[out.length - 1]; a.h = Math.max(a.h, x.h); a.l = Math.min(a.l, x.l); a.c = x.c; a.t = x.t; a.v = a.v == null || x.v == null ? null : a.v + x.v; } }
  return out;
}
export const weekKey = (t: string) => { const d = new Date(dayMs(t)); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
export const monthKey = (t: string) => t.slice(0, 7);
export const byInterval = (daily: C[], i: Interval): C[] => (i === 'W' ? roll(daily, weekKey) : i === 'M' ? roll(daily, monthKey) : daily);
/** The bars inside the range, counted back from the last bar's date. MAX keeps everything. */
export function inRange(bars: C[], r: Range): C[] {
  const days = RANGE_DAYS[r]; if (days == null || !bars.length) return bars;
  const from = dayMs(bars[bars.length - 1].t) - days * 86400000; const i = bars.findIndex((b) => dayMs(b.t) >= from); return i <= 0 ? bars : bars.slice(i);
}
/** Round-number axis values covering [min, max]: steps of 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceTicks(min: number, max: number, count = 5): { ticks: number[]; step: number } {
  if (!(max > min)) { const v = min; return { ticks: [v], step: 1 }; }
  const raw = (max - min) / Math.max(1, count - 1), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag; const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return { ticks: out, step };
}
export const priceLabel = (v: number, step: number) => (Math.abs(v) < 1e-9 ? 0 : v).toLocaleString('en-IN', { minimumFractionDigits: step < 1 ? 2 : 0, maximumFractionDigits: step < 1 ? 2 : step < 10 ? 1 : 0 });
export const money = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
/** Min and max per pixel column so a wide history draws fast and every peak and trough survives. Returns indices into bars, in order. */
export function decimate(n: number, cols: number, hi: (i: number) => number, lo: (i: number) => number): number[] {
  if (n <= cols * 2) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [0]; const size = n / cols;
  for (let k = 0; k < cols; k++) { const a = Math.max(1, Math.floor(k * size)), b = Math.min(n - 1, Math.floor((k + 1) * size)); if (a >= b) continue; let imax = a, imin = a; for (let i = a; i < b; i++) { if (hi(i) > hi(imax)) imax = i; if (lo(i) < lo(imin)) imin = i; } const pair = imin < imax ? [imin, imax] : [imax, imin]; for (const i of pair) if (i !== out[out.length - 1]) out.push(i); }
  if (out[out.length - 1] !== n - 1) out.push(n - 1); return out;
}
/** About five date labels along the bottom. Short spans name the day, a year or so names month and year, long spans name years. */
export function dateTicks(bars: C[]): { i: number; label: string }[] {
  const n = bars.length; if (n < 2) return n ? [{ i: 0, label: shortDate(bars[0].t, 'd') }] : [];
  const span = (dayMs(bars[n - 1].t) - dayMs(bars[0].t)) / 86400000;
  if (span > 900) { const idx: number[] = []; for (let i = 1; i < n; i++) if (bars[i].t.slice(0, 4) !== bars[i - 1].t.slice(0, 4)) idx.push(i); const step = Math.max(1, Math.ceil(idx.length / 6)); return idx.filter((_, k) => (idx.length - 1 - k) % step === 0).map((i) => ({ i, label: bars[i].t.slice(0, 4) })); }
  const mode = span <= 45 ? 'd' : 'm'; const out: { i: number; label: string }[] = [];
  for (let k = 0; k < 5; k++) { const i = Math.round((k / 4) * (n - 1)); const label = shortDate(bars[i].t, mode); if (!out.length || out[out.length - 1].label !== label) out.push({ i, label }); }
  return out;
}
export function shortDate(t: string, mode: 'd' | 'm' | 'full'): string { const [y, m, d] = t.split('-').map(Number); return mode === 'd' ? `${d} ${MON[m - 1]}` : mode === 'm' ? `${MON[m - 1]} '${String(y).slice(2)}` : `${d} ${MON[m - 1]} ${y}`; }
/** Change over the bars shown, in percent, from the first close to the last. */
export const changeOver = (bars: C[]): number | null => (bars.length > 1 && bars[0].c > 0 ? (bars[bars.length - 1].c / bars[0].c - 1) * 100 : null);
export const signedPct = (x: number | null, d = 2) => (x == null ? '—' : `${x > 0 ? '▲ +' : x < 0 ? '▼ −' : ''}${Math.abs(x).toFixed(d)}%`);
/** Infer observation spacing, never call monthly samples daily sessions. */
export function historyInterval(d: C[]): Interval {
  const gaps = d.slice(1).map((b, i) => (dayMs(b.t) - dayMs(d[i].t)) / 864e5).filter((n) => n > 0).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)] ?? 1;
  return median > 20 ? 'M' : median > 4 ? 'W' : 'D';
}
/** Calendar-year return uses a dated close near the anniversary, not 252 arbitrary observations. */
export function yearChange(d: C[]): number | null {
  if (d.length < 2) return null;
  const last = d.at(-1)!, anniversary = new Date(dayMs(last.t)); anniversary.setUTCFullYear(anniversary.getUTCFullYear() - 1);
  const at = anniversary.getTime(), base = d.filter((b) => dayMs(b.t) <= at).at(-1);
  const tolerance = historyInterval(d) === 'D' ? 7 : historyInterval(d) === 'W' ? 10 : 35;
  return base && base.c > 0 && at - dayMs(base.t) <= tolerance * 864e5 ? (last.c / base.c - 1) * 100 : null;
}
export function trendWords(d: C[]): string {
  if (!d.length) return '';
  const daily = historyInterval(d) === 'D';
  const avg = (n: number) => (daily && d.length >= n ? d.slice(-n).reduce((a, x) => a + x.c, 0) / n : null);
  const last = d.at(-1)!.c, a50 = avg(50), a200 = avg(200), yr = yearChange(d);
  let w = daily ? 'Trend unclear: not enough history' : 'Daily trend unavailable: the source supplied weekly or monthly observations';
  if (a50 != null && a200 != null) w = last > a50 && last > a200 ? 'Uptrend: above its 50 and 200-day averages' : last < a50 && last < a200 ? 'Downtrend: below its 50 and 200-day averages' : 'Mixed: between its 50 and 200-day averages';
  else if (a50 != null) w = last > a50 ? 'Above its 50-day average' : 'Below its 50-day average';
  return w + (yr == null ? '' : ` · ${signedPct(yr, 1)} price change over the last calendar year (this chart's closes)`);
}
