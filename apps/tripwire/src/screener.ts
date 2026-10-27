/** The screener's own layer on top of the filters: numeric conditions on any measured figure, the columns of the table view, and the CSV export.
 *  Pure. A name with no figure for a condition does NOT pass it (and is counted); a figure that is not meaningful for the company (a ratio built on
 *  capital employed, for a financial-sector name) counts as no figure, by the same eligibility rule as everywhere else. */
import type { Row } from './screen.ts';
import { eligibilityOf, meaningful, type MetricId } from './eligibility.ts';

export type MetricKey = 'price' | 'r1d' | 'r1m' | 'r3m' | 'rs3m' | 'from_high' | 'rsi' | 'vol_spike' | 'turnover_cr' | 'pe' | 'pb' | 'roce_med' | 'roe' | 'rev_cagr' | 'eps_cagr' | 'de' | 'net_margin' | 'piotroski' | 'comp' | 'atr_pct' | 'r1w' | 'r6m' | 'r1y' | 'dist20' | 'dist50' | 'dist200' | 'from_low' | 'pe_pctile' | 'ebit_margin' | 'fcf_margin' | 'icover' | 'cfo_pat' | 'insiders' | 'instis' | 'sd1y' | 'q' | 'g' | 'v' | 'tech';
export interface Metric { id: MetricKey; label: string; short: string; unit: string; dp: number; hint: string; presets: number[]; /** returns "this ratio is not meaningful for this company" */ elig?: MetricId; signed?: boolean; /** a figure worked out from the row's own published numbers */ derive?: (r: Row) => number | null; group?: string }
const rel = (a?: number | null, b?: number | null) => (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && b > 0 ? Math.round(((a / b - 1) * 100) * 100) / 100 : null);
export const METRICS: Metric[] = [
  { id: 'price', label: 'Price', short: 'PRICE', unit: '₹', dp: 2, hint: 'last close', presets: [100, 500, 1000] },
  { id: 'r1d', label: 'Day change', short: '1D', unit: '%', dp: 1, hint: 'last session', presets: [-3, 3, 5], signed: true },
  { id: 'r1m', label: 'Return, 1 month', short: '1M', unit: '%', dp: 1, hint: '21 sessions', presets: [-10, 0, 10], signed: true },
  { id: 'r3m', label: 'Return, 3 months', short: '3M', unit: '%', dp: 1, hint: '63 sessions', presets: [-10, 0, 20], signed: true },
  { id: 'rs3m', label: 'Against the Nifty, 3 months', short: 'VS NIFTY', unit: ' pts', dp: 1, hint: 'stock minus Nifty, 3 months', presets: [0, 10, 25], signed: true },
  { id: 'from_high', label: 'From the 52-week high', short: 'FROM HIGH', unit: '%', dp: 1, hint: 'always zero or below; -5 is within 5% of the high', presets: [-5, -15, -30], signed: true },
  { id: 'rsi', label: 'RSI (14)', short: 'RSI', unit: '', dp: 0, hint: '0 to 100; above 70 stretched, below 30 weak', presets: [30, 50, 70] },
  { id: 'vol_spike', label: 'Volume against its average', short: 'VOL X', unit: '×', dp: 1, hint: 'today over the 20-day average', presets: [1.5, 2, 3] },
  { id: 'turnover_cr', label: 'Traded value a day', short: 'TURNOVER', unit: ' cr', dp: 0, hint: 'rupees crore', presets: [5, 25, 100] },
  { id: 'pe', label: 'PE (trailing)', short: 'PE', unit: '', dp: 1, hint: 'absent for loss-makers', presets: [15, 25, 40] },
  { id: 'pb', label: 'Price to book', short: 'PB', unit: '', dp: 1, hint: '', presets: [1, 3, 5] },
  { id: 'roce_med', label: 'ROCE, median of up to 4 years', short: 'ROCE', unit: '%', dp: 0, hint: 'not defined for the financial sector', presets: [10, 15, 20], elig: 'roce' },
  { id: 'roe', label: 'ROE', short: 'ROE', unit: '%', dp: 0, hint: '', presets: [10, 15, 20] },
  { id: 'rev_cagr', label: 'Sales growth, 3-year compound', short: 'SALES 3Y', unit: '%', dp: 0, hint: 'per year', presets: [5, 10, 20], signed: true },
  { id: 'eps_cagr', label: 'EPS growth, 3-year compound', short: 'EPS 3Y', unit: '%', dp: 0, hint: 'withheld when the share count moved', presets: [5, 10, 20], signed: true },
  { id: 'de', label: 'Debt to equity', short: 'D/E', unit: '', dp: 2, hint: 'not defined for the financial sector; negative means negative equity', presets: [0.1, 0.5, 1], elig: 'leverage' },
  { id: 'net_margin', label: 'Net margin', short: 'NET MARGIN', unit: '%', dp: 0, hint: '', presets: [5, 10, 20], elig: 'margin' },
  { id: 'piotroski', label: 'Piotroski F-score', short: 'F-SCORE', unit: '', dp: 0, hint: '0 to 9 accounting-strength checks', presets: [5, 7, 8] },
  { id: 'comp', label: 'Screen composite', short: 'COMPOSITE', unit: '', dp: 0, hint: '0 to 100, quality, growth, value and technicals together', presets: [50, 65, 80] },
  { id: 'atr_pct', label: 'Daily range (ATR %)', short: 'ATR %', unit: '%', dp: 1, hint: 'how far it moves in a day; bigger means a wider stop', presets: [2, 3, 5] },
  { id: 'r1w', label: 'Return, 1 week', short: '1W', unit: '%', dp: 1, hint: '5 sessions', presets: [-5, 0, 5], signed: true },
  { id: 'r6m', label: 'Return, 6 months', short: '6M', unit: '%', dp: 1, hint: '126 sessions', presets: [-10, 0, 30], signed: true },
  { id: 'r1y', label: 'Return, 1 year', short: '1Y', unit: '%', dp: 1, hint: '252 sessions', presets: [-10, 10, 50], signed: true },
  { id: 'dist20', label: 'Price against its 20-day average', short: 'VS 20D', unit: '%', dp: 1, hint: 'positive means above the average', presets: [-5, 0, 5], signed: true, derive: (r) => rel(r.price, r.sma20) },
  { id: 'dist50', label: 'Price against its 50-day average', short: 'VS 50D', unit: '%', dp: 1, hint: 'positive means above the average', presets: [-5, 0, 10], signed: true, derive: (r) => rel(r.price, r.sma50) },
  { id: 'dist200', label: 'Price against its 200-day average', short: 'VS 200D', unit: '%', dp: 1, hint: 'positive means above the average', presets: [-10, 0, 20], signed: true, derive: (r) => rel(r.price, r.sma200) },
  { id: 'from_low', label: 'Above the 52-week low', short: 'FROM LOW', unit: '%', dp: 0, hint: 'zero or above; 100 means doubled from the low', presets: [10, 50, 100], derive: (r) => rel(r.price, r.low52) },
  { id: 'pe_pctile', label: 'PE against its own history', short: 'PE PCTILE', unit: '', dp: 0, hint: '0 is its cheapest PE on record here, 100 its dearest', presets: [20, 50, 80] },
  { id: 'ebit_margin', label: 'Operating margin', short: 'EBIT MARGIN', unit: '%', dp: 0, hint: '', presets: [5, 15, 25], elig: 'margin' },
  { id: 'fcf_margin', label: 'Free cash flow margin', short: 'FCF MARGIN', unit: '%', dp: 0, hint: 'free cash flow over sales', presets: [0, 5, 15], signed: true },
  { id: 'icover', label: 'Interest cover', short: 'INT COVER', unit: '×', dp: 1, hint: 'operating profit over interest; not defined for lenders', presets: [2, 4, 8], elig: 'cover' },
  { id: 'cfo_pat', label: 'Cash profit against reported profit', short: 'CFO/PAT', unit: '×', dp: 2, hint: 'above 1 means profit is backed by cash', presets: [0.5, 1, 1.2], elig: 'cash' },
  { id: 'insiders', label: 'Insider holding', short: 'INSIDERS', unit: '%', dp: 0, hint: "Yahoo's insiders bucket, a proxy and not promoter holding", presets: [25, 50, 70] },
  { id: 'instis', label: 'Institutional holding', short: 'INSTIS', unit: '%', dp: 0, hint: '', presets: [5, 15, 30] },
  { id: 'sd1y', label: 'Yearly volatility', short: 'VOL 1Y', unit: '%', dp: 0, hint: 'annualised standard deviation of daily returns', presets: [20, 35, 50] },
  { id: 'q', label: 'Quality score', short: 'QUALITY', unit: '', dp: 0, hint: '0 to 100, the screen\'s own', presets: [40, 60, 80] },
  { id: 'g', label: 'Growth score', short: 'GROWTH', unit: '', dp: 0, hint: '0 to 100, the screen\'s own', presets: [40, 60, 80] },
  { id: 'v', label: 'Value score', short: 'VALUE', unit: '', dp: 0, hint: '0 to 100, the screen\'s own', presets: [40, 60, 80] },
  { id: 'tech', label: 'Technical score', short: 'TECH', unit: '', dp: 0, hint: '0 to 100, the screen\'s own', presets: [20, 40, 70] },
];
export const metricOf = (id: string) => METRICS.find((m) => m.id === id);
export interface Cond { m: MetricKey; op: 'gte' | 'lte'; v: number }
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** The figure for a row, or null when there is none or it is not meaningful for this company. */
export function valueOf(r: Row, id: MetricKey): number | null {
  const m = metricOf(id); const v = m?.derive ? m.derive(r) : (r as unknown as Record<string, unknown>)[id]; if (!num(v)) return null;
  if (m?.elig && !meaningful(eligibilityOf(r), m.elig)) return null;
  return v;
}
export function applyConds(rows: readonly Row[], conds: readonly Cond[] | undefined): { rows: Row[]; noFigure: number } {
  if (!conds?.length) return { rows: [...rows], noFigure: 0 };
  let noFigure = 0; const out: Row[] = [];
  for (const r of rows) {
    let ok = true, missing = false;
    for (const c of conds) { const v = valueOf(r, c.m); if (v === null) { missing = true; ok = false; break; } if (c.op === 'gte' ? v < c.v : v > c.v) { ok = false; break; } }
    if (ok) out.push(r); else if (missing) noFigure++;
  }
  return { rows: out, noFigure };
}
export const fmtMetric = (m: Metric, v: number | null) => (v === null ? '—' : `${m.signed && v > 0 ? '+' : ''}${m.unit === '₹' ? '₹' : ''}${v.toLocaleString('en-IN', { minimumFractionDigits: m.dp, maximumFractionDigits: m.dp })}${m.unit === '₹' ? '' : m.unit}`);
/** A condition is read back with every digit it was set with (up to two decimals), so "RSI around 47" never reads as a rounded threshold it is not. */
export const describeCond = (c: Cond) => { const m = metricOf(c.m); if (!m) return ''; const dec = Math.min(2, (String(c.v).split('.')[1] ?? '').length); return `${m.short} ${c.op === 'gte' ? '≥' : '≤'} ${fmtMetric({ ...m, signed: false, dp: Math.max(m.dp, dec) }, c.v)}`; };
export const sameCond = (a: Cond, b: Cond) => a.m === b.m && a.op === b.op && a.v === b.v;

/** The table view's column sets: each a reading of the screen from one angle. */
export const COLUMN_SETS: { id: string; label: string; cols: MetricKey[] }[] = [
  { id: 'momentum', label: 'Momentum', cols: ['price', 'r1d', 'r1m', 'r3m', 'rs3m', 'rsi', 'from_high', 'vol_spike'] },
  { id: 'value', label: 'Value', cols: ['price', 'pe', 'pb', 'roce_med', 'roe', 'rev_cagr', 'eps_cagr', 'turnover_cr'] },
  { id: 'quality', label: 'Quality', cols: ['roce_med', 'de', 'net_margin', 'piotroski', 'comp', 'rev_cagr', 'atr_pct'] },
  { id: 'trend', label: 'Trend', cols: ['price', 'dist20', 'dist50', 'dist200', 'from_low', 'from_high', 'r6m', 'r1y'] },
  { id: 'cash', label: 'Cash and holders', cols: ['ebit_margin', 'fcf_margin', 'cfo_pat', 'icover', 'insiders', 'instis', 'sd1y'] },
];
export function sortByMetric(rows: readonly Row[], id: MetricKey | 'name', dir: 'asc' | 'desc'): Row[] {
  const s = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (id === 'name') return s * a.sym.localeCompare(b.sym);
    const x = valueOf(a, id), y = valueOf(b, id);
    if (x === null && y === null) return a.sym.localeCompare(b.sym);
    if (x === null) return 1; if (y === null) return -1;          // no figure sorts last in either direction
    return x === y ? a.sym.localeCompare(b.sym) : s * (x - y);
  });
}
const q = (t: string) => (/[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
/** CSV of the current result: symbol, name, sector, then the chosen columns. A missing figure is an empty cell, never a zero. */
export function toCsv(rows: readonly Row[], cols: readonly MetricKey[]): string {
  const head = ['symbol', 'name', 'sector', ...cols.map((c) => metricOf(c)?.label ?? c)].map(q).join(',');
  return [head, ...rows.map((r) => [r.sym, r.name, r.sector ?? '', ...cols.map((c) => { const v = valueOf(r, c); return v === null ? '' : String(v); })].map(q).join(','))].join('\n') + '\n';
}

/** What a figure looks like across the universe: the typical range, the middle, and a histogram clipped to the 1st-99th percentile so one absurd ratio
 *  cannot flatten it. Names with no figure are counted, not placed. Everything is read from the same valueOf as the filter, so the picture and the result agree. */
export interface Dist { n: number; missing: number; min: number; max: number; p1: number; p99: number; median: number; bins: number[]; lo: number; hi: number }
export function distribution(rows: readonly Row[], id: MetricKey, nbins = 24): Dist | null {
  const xs = rows.map((r) => valueOf(r, id)).filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (xs.length < 2) return null;
  const at = (p: number) => xs[Math.min(xs.length - 1, Math.max(0, Math.round(p * (xs.length - 1))))];
  const lo = at(0.01), hi = at(0.99), w = hi > lo ? (hi - lo) / nbins : 1; const bins = new Array(nbins).fill(0);
  for (const v of xs) { if (v < lo || v > hi) continue; bins[Math.min(nbins - 1, Math.floor((v - lo) / w))]++; }
  return { n: xs.length, missing: rows.length - xs.length, min: xs[0], max: xs[xs.length - 1], p1: lo, p99: hi, median: at(0.5), bins, lo, hi };
}
/** The condition(s) a chosen mode stands for. 'around' is the value plus or minus a tolerance, written as two conditions so they are removable one by one. */
export type RangeMode = 'gte' | 'lte' | 'between' | 'around';
export function condsFor(m: MetricKey, mode: RangeMode, a: number, b: number): Cond[] {
  if (mode === 'gte') return [{ m, op: 'gte', v: a }];
  if (mode === 'lte') return [{ m, op: 'lte', v: a }];
  if (mode === 'around') { const t = Math.abs(b); return [{ m, op: 'gte', v: round(a - t) }, { m, op: 'lte', v: round(a + t) }]; }
  const [lo, hi] = a <= b ? [a, b] : [b, a]; return [{ m, op: 'gte', v: lo }, { m, op: 'lte', v: hi }];
}
const round = (x: number) => Math.round(x * 1e6) / 1e6;
