/** The "scrip intelligence" read-outs. Pure functions over the published screen, so each sentence is testable. Nothing here predicts: every
 *  line says what the data shows, for which period, and what it cannot tell you. Missing is never zero. */
import type { Row } from './screen.ts';
import { isLender } from './screen.ts';
import type { Inst, Season } from './data.ts';

const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface Holder { key: string; label: string; pct: number; pp: number | null }
export function holders(i: Inst | null | undefined): Holder[] {
  if (!i || i.quality === undefined) return [];
  const out: Holder[] = [
    { key: 'promoter', label: 'Promoter', pct: i.promoter as number, pp: null }, { key: 'fii', label: 'Foreign institutions (FII)', pct: i.fii as number, pp: n(i.fii_pp) ? i.fii_pp : null },
    { key: 'dii', label: 'Domestic institutions (DII)', pct: i.dii as number, pp: n(i.dii_pp) ? i.dii_pp : null }, { key: 'mf', label: 'Mutual funds', pct: i.mf as number, pp: null },
    { key: 'insurance', label: 'Insurers', pct: i.insurance as number, pp: null }, { key: 'public', label: 'Public and others', pct: i.publicHold as number, pp: null }];
  return out.filter((h) => n(h.pct));
}
/** One sentence on who has been adding or trimming, from the quarter-on-quarter changes the screen holds. */
export function ownershipRead(i: Inst | null | undefined): string | null {
  if (!i || i.quality === undefined) return null;
  const f = i.fii_pp, d = i.dii_pp; if (!n(f) && !n(d)) return null;
  const word = (v: number) => (Math.abs(v) < 0.1 ? 'unchanged' : v > 0 ? `up ${v.toFixed(2)} points` : `down ${Math.abs(v).toFixed(2)} points`);
  const per = i.period && i.prev_period ? `${i.prev_period} to ${i.period}` : 'the latest quarter';
  return `${per}: foreign institutions ${n(f) ? word(f) : 'not reported'}, domestic institutions ${n(d) ? word(d) : 'not reported'}.`;
}
export interface SeasonRead { month: string; hit: number; avg: number; years: number; best: { month: string; avg: number }; worst: { month: string; avg: number }; thin: boolean }
/** How this stock has behaved in a given calendar month over the years the screen holds (month-to-month closes). Eleven years is a small sample. */
export function seasonRead(s: Season | null | undefined, monthIdx: number): SeasonRead | null {
  if (!s || !Array.isArray(s.m) || s.m.length !== 12) return null;
  const m = s.m[monthIdx]; if (!m || !n(m[0]) || !n(m[1])) return null;
  const order = s.m.map((x, k) => ({ k, avg: x[1] })).filter((x) => n(x.avg)).sort((a, b) => b.avg - a.avg);
  return { month: MON[monthIdx], hit: m[0], avg: m[1], years: m[2], best: { month: MON[order[0].k], avg: order[0].avg }, worst: { month: MON[order[order.length - 1].k], avg: order[order.length - 1].avg }, thin: (m[2] ?? 0) < 10 };
}
export interface Ladder { label: string; rank: number; of: number; value: string; better: 'high' | 'low' }
const fmt1 = (v: number) => v.toFixed(1);
/** Where a stock stands among the same sector's measured peers, on five measures. Rank 1 is the best. A measure the stock lacks is left out. */
export function peerLadder(row: Row, rows: readonly Row[]): { sector: string | null; peers: number; lines: Ladder[] } {
  const sector = row.sector ?? null; if (!sector) return { sector, peers: 0, lines: [] };
  const peers = rows.filter((r) => r.sector === sector && r.liquid);
  const mk = (label: string, get: (r: Row) => number | null | undefined, better: 'high' | 'low', show: (v: number) => string, skipLender = false, positive = false): Ladder | null => {
    if (skipLender && isLender(row)) return null;
    const mine = get(row); if (!n(mine) || (positive && mine <= 0)) return null;
    const pool = peers.filter((r) => !(skipLender && isLender(r))).map((r) => get(r)).filter((v): v is number => n(v) && (!positive || v > 0));
    if (pool.length < 5) return null;
    const rank = 1 + pool.filter((v) => (better === 'high' ? v > mine : v < mine)).length;
    return { label, rank, of: pool.length, value: show(mine), better };
  };
  const lines = [mk('Return on capital (median)', (r) => r.roce_med, 'high', (v) => `${fmt1(v)}%`, true), mk('PE (cheaper ranks higher)', (r) => r.pe, 'low', fmt1, false, true),
    mk('Revenue growth, 3 years', (r) => r.rev_cagr, 'high', (v) => `${fmt1(v)}%`), mk('Strength against the Nifty, 3 months', (r) => r.rs3m, 'high', (v) => `${v > 0 ? '+' : '−'}${fmt1(Math.abs(v))} pts`),
    mk('Alpha composite score', (r) => r.comp, 'high', (v) => `${Math.round(v)}`)].filter((x): x is Ladder => !!x);
  return { sector, peers: peers.length, lines };
}
export interface Quality { label: string; value: string; read: string; tone: 'good' | 'warn' | 'plain' }
/** Earnings quality: does profit turn into cash, can it cover its interest, is it getting more or less profitable. Lenders are skipped (the screen's own rule). */
export function earningsQuality(r: Row): Quality[] {
  if (isLender(r)) return [];
  const out: Quality[] = [];
  if (n(r.cfo_pat)) out.push({ label: 'Cash from operations per ₹1 of profit', value: `₹${r.cfo_pat.toFixed(2)}`, read: r.cfo_pat >= 0.9 ? 'Profit is turning into cash.' : r.cfo_pat >= 0.5 ? 'Only part of reported profit is arriving as cash.' : 'Little of the reported profit is arriving as cash. Look at receivables and inventory.', tone: r.cfo_pat >= 0.9 ? 'good' : 'warn' });
  if (n(r.fcf_margin)) out.push({ label: 'Free cash flow margin', value: `${fmt1(r.fcf_margin)}%`, read: r.fcf_margin > 10 ? 'Keeps a good share of revenue after spending on the business.' : r.fcf_margin > 0 ? 'Positive, but thin.' : 'Spends more than it earns in cash after capex.', tone: r.fcf_margin > 10 ? 'good' : r.fcf_margin > 0 ? 'plain' : 'warn' });
  if (n(r.icover)) out.push({ label: 'Interest cover', value: `${r.icover >= 100 ? '100+' : fmt1(r.icover)}x`, read: r.icover >= 5 ? 'Profit covers interest comfortably.' : r.icover >= 2 ? 'Covers interest, with limited room.' : 'Interest takes most of operating profit.', tone: r.icover >= 5 ? 'good' : r.icover >= 2 ? 'plain' : 'warn' });
  if (n(r.margin_delta)) out.push({ label: 'Operating margin change, latest year', value: `${r.margin_delta > 0 ? '+' : r.margin_delta < 0 ? '−' : ''}${fmt1(Math.abs(r.margin_delta))} pts`, read: r.margin_delta > 0.5 ? 'Margins are widening.' : r.margin_delta < -0.5 ? 'Margins are narrowing.' : 'Margins are about flat.', tone: r.margin_delta > 0.5 ? 'good' : r.margin_delta < -0.5 ? 'warn' : 'plain' });
  return out;
}
export interface RiskMap { daily: number | null; swing20: number | null; fromLow: number | null; fromHigh: number | null; volAnnual: number | null; tenLakhPct: number | null; liquidity: string }
/** What size of move is ordinary for this stock, and how much of a day's trading a ₹10 lakh position would be. ATR% x sqrt(20) is a rough guide, not a forecast. */
export function riskMap(r: Row): RiskMap {
  const daily = n(r.atr_pct) ? r.atr_pct : null; const tv = n(r.turnover_cr) ? r.turnover_cr * 1e7 : null;
  const pctOfDay = tv && tv > 0 ? (1_000_000 / tv) * 100 : null;
  return { daily, swing20: daily != null ? daily * Math.sqrt(20) : null, fromLow: n(r.price) && n(r.low52) && r.low52 > 0 ? (r.price / r.low52 - 1) * 100 : null, fromHigh: n(r.from_high) ? r.from_high : null,
    volAnnual: n(r.sd1y) ? r.sd1y : null, tenLakhPct: pctOfDay, liquidity: pctOfDay == null ? 'Traded value is not available.' : pctOfDay < 0.5 ? 'Deep: a ₹10 lakh position is a rounding error in a normal day.' : pctOfDay < 2 ? 'Comfortable for a ₹10 lakh position.' : pctOfDay < 5 ? 'A ₹10 lakh position is a noticeable share of a day; use limit orders.' : 'Thin: a ₹10 lakh position would be a large share of a day.' };
}
export const FACTOR_META: Record<string, { label: string; high: string; low: string }> = {
  mom12_1: { label: '12-month momentum, skipping the last month', high: 'among the strongest 12-month risers', low: 'among the weakest 12-month performers' },
  near_high: { label: 'Nearness to the 52-week high', high: 'close to its yearly high', low: 'well below its yearly high' },
  smooth_fip: { label: 'Steadiness of the past year’s moves', high: 'mostly up days; the gain came steadily', low: 'few up days; the move came in jumps' },
  eff_ratio60: { label: 'Straightness of the last 60 sessions', high: 'moved in a near-straight line', low: 'zig-zagged, going nowhere fast' },
  resid_mom: { label: 'Momentum after removing the market', high: 'outperformed what the market alone explains', low: 'lagged what the market alone explains' },
  max5: { label: 'Calm (no lottery-like spikes) last month', high: 'no big one-day spikes lately', low: 'recent big one-day spikes (lottery-like)' },
  overnight60: { label: 'Overnight drift, 60 sessions', high: 'gains tend to come at the open gap', low: 'gaps have been against it' },
  vol_shock: { label: 'Volume surge against the last 6 months', high: 'trading far more than usual', low: 'trading less than usual' },
  ud_vol: { label: 'Volume on up days against down days', high: 'volume is heavier on up days', low: 'volume is heavier on down days' },
  clv20: { label: 'Where it closes in its daily range, 20 sessions', high: 'tends to close near the day’s high', low: 'tends to close near the day’s low' },
  coil: { label: 'Volatility coil (tight against its own past)', high: 'trading in an unusually tight range', low: 'swinging wider than usual' },
  skew60: { label: 'Skew of daily moves, 60 sessions', high: 'more large drops than large jumps', low: 'more large jumps than large drops' },
};
