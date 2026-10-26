/** Discover: filtering and sorting over the published screen rows. Missing is never zero: a row with no figure for a filter
 *  is excluded from that filter and counted, and sorts last in either direction. */
import { eligibilityOf, isFinancialSector, meaningful } from './eligibility.ts';
export interface Row {
  sym: string; name: string; sector?: string | null; tier?: string | null; price?: number | null; r1d?: number | null; r1w?: number | null; r1m?: number | null; r3m?: number | null; rs3m?: number | null;
  from_high?: number | null; high52?: number | null; low52?: number | null; sma20?: number | null; sma50?: number | null; sma200?: number | null; rsi?: number | null; vol_spike?: number | null;
  liquid?: boolean | null; turnover_cr?: number | null; pe?: number | null; pb?: number | null; roce_med?: number | null; rev_cagr?: number | null; eps_cagr?: number | null; de?: number | null;
  comp?: number | null; q?: number | null; g?: number | null; v?: number | null; tech?: number | null; pe_pctile?: number | null; roe?: number | null; icover?: number | null; cfo_pat?: number | null; fcf_margin?: number | null; margin_delta?: number | null; em_label?: string | null; rank_move?: number | null; insiders?: number | null; instis?: number | null; shares_changed?: boolean | null; atr_pct?: number | null; sd1y?: number | null; r6m?: number | null; r1y?: number | null; piotroski?: number | null;
  net_margin?: number | null; ebit_margin?: number | null; div_yield?: number | null; risk_lvl?: string | null; risk_top?: string | null; next_earnings?: string | null; last_date?: string | null; fy?: string | null; has_stmts?: boolean | null;
}
export type Trend = 'up' | 'down' | 'mixed';
export interface Filters { q: string; sector: string; tier: string; value: '' | 'cheap' | 'rich'; quality: '' | 'high'; momentum: '' | 'strong' | 'weak' | 'near-high'; trend?: '' | Trend }
export const NO_FILTER: Filters = { q: '', sector: '', tier: '', value: '', quality: '', momentum: '', trend: '' };
export type SortKey = 'name' | 'r1d' | 'r3m' | 'rs3m' | 'pe' | 'roce_med' | 'from_high' | 'turnover_cr';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** The trend tag, with one rule used everywhere (the company page, Discover, the trend map, the Worker's live map).
 *  UPTREND needs all four: the price above its 20-day average, the 20-day above the 50-day, the 50-day at least 1% above the 200-day (a clear gap, not a tangle
 *  of averages crossing), and a positive 3-month return. DOWNTREND is the exact mirror. Anything else is SIDEWAYS: it meets neither rule, and the page says
 *  which condition it misses. This is stricter than "price above the 50-day above the 200-day": a pullback through the 20-day, or a stack that has only just
 *  crossed, or a rally that has not yet lifted the 3-month return, is not called a trend. A name missing a figure is untagged (null), never "sideways". */
export const TREND_GAP = 0.01;
export interface TrendIn { price?: number | null; sma20?: number | null; sma50?: number | null; sma200?: number | null; r3m?: number | null }
export function trendChecks(r: TrendIn): { up: [string, boolean][]; down: [string, boolean][] } | null {
  const pos = (v: unknown): v is number => num(v) && v > 0;
  if (!pos(r.price) || !pos(r.sma20) || !pos(r.sma50) || !pos(r.sma200) || !num(r.r3m)) return null;
  const { price: p, sma20: a, sma50: b, sma200: c, r3m: m } = r as Required<{ [K in keyof TrendIn]: number }>;
  return {
    up: [['the price is above the 20-day average', p > a], ['the 20-day is above the 50-day', a > b], ['the 50-day is at least 1% above the 200-day', b >= c * (1 + TREND_GAP)], ['the 3-month return is positive', m > 0]],
    down: [['the price is below the 20-day average', p < a], ['the 20-day is below the 50-day', a < b], ['the 50-day is at least 1% below the 200-day', c >= b * (1 + TREND_GAP)], ['the 3-month return is negative', m < 0]],
  };
}
export function trendOf(r: TrendIn): { trend: Trend | null; detail: string } {
  const k = trendChecks(r); if (!k) return { trend: null, detail: 'Needs the price, the 20, 50 and 200-day averages and the 3-month return; one is missing.' };
  const d = `price ${r.price!.toFixed(2)}, 20-day ${r.sma20!.toFixed(2)}, 50-day ${r.sma50!.toFixed(2)}, 200-day ${r.sma200!.toFixed(2)}, 3-month ${r.r3m! > 0 ? '+' : r.r3m! < 0 ? '−' : ''}${Math.abs(r.r3m!).toFixed(1)}%`;
  if (k.up.every(([, ok]) => ok)) return { trend: 'up', detail: `Uptrend: all four hold. The price is above the 20-day, the 20-day above the 50-day, the 50-day at least 1% above the 200-day, and the 3-month return is positive (${d}).` };
  if (k.down.every(([, ok]) => ok)) return { trend: 'down', detail: `Downtrend: all four hold, mirrored. The price is below the 20-day, the 20-day below the 50-day, the 50-day at least 1% below the 200-day, and the 3-month return is negative (${d}).` };
  const nUp = k.up.filter(([, ok]) => ok).length, nDown = k.down.filter(([, ok]) => ok).length; const side = nDown > nUp ? k.down : k.up; const miss = side.filter(([, ok]) => !ok).map(([t]) => t);
  return { trend: 'mixed', detail: `Sideways: it meets neither rule. Closest to a${nDown > nUp ? ' downtrend' : 'n uptrend'}, but ${miss.join(' and ')} is not so (${d}).` };
}
/** The one description of the rule, printed wherever a trend is filtered or counted, so no screen paraphrases it. */
export const TREND_RULE_TEXT = {
  up: 'price above the 20-day, 20-day above the 50-day, 50-day at least 1% above the 200-day, 3-month return positive',
  down: 'the mirror: price below the 20-day, 20-day below the 50-day, 50-day at least 1% below the 200-day, 3-month return negative',
  mixed: 'meets neither rule (a name with any average or return missing is left out, not guessed)',
};
/** "Sideways" is the plain word for the third state: the price and the two averages are not in one order, so there is no clear trend either way. */
export const TREND_WORD: Record<Trend, string> = { up: 'Uptrend', down: 'Downtrend', mixed: 'Sideways' };
const sma = (c: readonly number[], n: number) => (c.length >= n ? c.slice(-n).reduce((a, b) => a + b, 0) / n : null);
/** The same tag for anything with a daily close series (an index, gold, a currency): the last close against its own 20, 50 and 200-day averages and its 63-session (about 3-month) return. */
export const trendOfCloses = (c: readonly number[]) => trendOf({ price: c.length ? c[c.length - 1] : null, sma20: sma(c, 20), sma50: sma(c, 50), sma200: sma(c, 200), r3m: c.length > 63 ? (c[c.length - 1] / c[c.length - 64] - 1) * 100 : null });
/** The financial sector (banks, lenders, brokers, advisers, insurers share one sector in the feed). Statement ratios built on capital employed do not compare across it.
 *  The single definition lives in eligibility.ts; this name is kept for the callers that still say lender. */
export { isFinancialSector as isLender, isFinancialSector } from './eligibility.ts';

export function filterRows(rows: readonly Row[], f: Filters): { rows: Row[]; unmeasured: number; notApplicable: number } {
  const q = f.q.trim().toLowerCase();
  let unmeasured = 0, notApplicable = 0;
  const out = rows.filter((r) => {
    if (q && !(r.sym.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))) return false;
    if (f.sector && r.sector !== f.sector) return false;
    if (f.tier && r.tier !== f.tier) return false;
    const need = (v: unknown) => { if (!num(v)) { unmeasured++; return false; } return true; };
    if (f.value === 'cheap') { if (!need(r.pe)) return false; if (!(r.pe! > 0 && r.pe! <= 15)) return false; }
    if (f.value === 'rich') { if (!need(r.pe)) return false; if (!(r.pe! >= 40)) return false; }
    if (f.quality === 'high') { if (isFinancialSector(r)) { notApplicable++; return false; } if (!meaningful(eligibilityOf(r), 'roce')) { notApplicable++; return false; } if (!need(r.roce_med)) return false; if (!(r.roce_med! >= 20)) return false; }
    if (f.momentum === 'strong') { if (!need(r.rs3m)) return false; if (!(r.rs3m! > 0)) return false; }
    if (f.momentum === 'weak') { if (!need(r.rs3m)) return false; if (!(r.rs3m! < 0)) return false; }
    if (f.trend) { if (trendOf(r).trend === null) { unmeasured++; return false; } if (trendOf(r).trend !== f.trend) return false; }
    if (f.momentum === 'near-high') { if (!need(r.from_high)) return false; if (!(r.from_high! >= -5)) return false; }
    return true;
  });
  return { rows: out, unmeasured, notApplicable };
}
export function sortRows(rows: readonly Row[], key: SortKey, dir: 'asc' | 'desc'): Row[] {
  const s = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'name') return s * a.name.localeCompare(b.name);
    const x = a[key], y = b[key];
    if (!num(x) && !num(y)) return a.sym.localeCompare(b.sym);
    if (!num(x)) return 1;                       // missing last in either direction
    if (!num(y)) return -1;
    return x === y ? a.sym.localeCompare(b.sym) : s * (x - y);
  });
}
export const describeFilters = (f: Filters): string[] => [
  f.sector && `Sector: ${f.sector}`, f.tier && `Size: ${f.tier}`,
  f.value === 'cheap' && 'PE 15 or less', f.value === 'rich' && 'PE 40 or more', f.quality === 'high' && 'Median ROCE 20%+ (financial sector left out)',
  f.trend && `Trend: ${TREND_WORD[f.trend]}`,
  f.momentum === 'strong' && 'Ahead of the Nifty, 3 months', f.momentum === 'weak' && 'Behind the Nifty, 3 months', f.momentum === 'near-high' && 'Within 5% of the 52-week high',
].filter(Boolean) as string[];
