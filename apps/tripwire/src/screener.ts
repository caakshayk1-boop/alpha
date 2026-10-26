/** The screener's own layer on top of the filters: numeric conditions on any measured figure, the columns of the table view, and the CSV export.
 *  Pure. A name with no figure for a condition does NOT pass it (and is counted); a figure that is not meaningful for the company (a ratio built on
 *  capital employed, for a financial-sector name) counts as no figure, by the same eligibility rule as everywhere else. */
import type { Row } from './screen.ts';
import { eligibilityOf, meaningful, type MetricId } from './eligibility.ts';

export type MetricKey = 'price' | 'r1d' | 'r1m' | 'r3m' | 'rs3m' | 'from_high' | 'rsi' | 'vol_spike' | 'turnover_cr' | 'pe' | 'pb' | 'roce_med' | 'roe' | 'rev_cagr' | 'eps_cagr' | 'de' | 'net_margin' | 'piotroski' | 'comp' | 'atr_pct';
export interface Metric { id: MetricKey; label: string; short: string; unit: string; dp: number; hint: string; presets: number[]; /** returns "this ratio is not meaningful for this company" */ elig?: MetricId; signed?: boolean }
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
];
export const metricOf = (id: string) => METRICS.find((m) => m.id === id);
export interface Cond { m: MetricKey; op: 'gte' | 'lte'; v: number }
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** The figure for a row, or null when there is none or it is not meaningful for this company. */
export function valueOf(r: Row, id: MetricKey): number | null {
  const v = (r as unknown as Record<string, unknown>)[id]; if (!num(v)) return null;
  const m = metricOf(id); if (m?.elig && !meaningful(eligibilityOf(r), m.elig)) return null;
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
export const describeCond = (c: Cond) => { const m = metricOf(c.m); return m ? `${m.short} ${c.op === 'gte' ? '≥' : '≤'} ${fmtMetric({ ...m, signed: false }, c.v)}` : ''; };
export const sameCond = (a: Cond, b: Cond) => a.m === b.m && a.op === b.op && a.v === b.v;

/** The table view's column sets: each a reading of the screen from one angle. */
export const COLUMN_SETS: { id: string; label: string; cols: MetricKey[] }[] = [
  { id: 'momentum', label: 'Momentum', cols: ['price', 'r1d', 'r1m', 'r3m', 'rs3m', 'rsi', 'from_high', 'vol_spike'] },
  { id: 'value', label: 'Value', cols: ['price', 'pe', 'pb', 'roce_med', 'roe', 'rev_cagr', 'eps_cagr', 'turnover_cr'] },
  { id: 'quality', label: 'Quality', cols: ['roce_med', 'de', 'net_margin', 'piotroski', 'comp', 'rev_cagr', 'atr_pct'] },
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
