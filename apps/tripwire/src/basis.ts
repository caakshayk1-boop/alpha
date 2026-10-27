/** The price and time basis of every figure the screen publishes. A screen is built on a close; a quote can be seconds old. Before this file a page could print a
 *  live price beside a "from high" worked out at the close (GCSL: ₹746 live, "−3.1% from its high" from ₹726), because nothing said which figures move with the
 *  price and which do not. Now every published field is declared once, and the ones that are pure functions of the price are recomputed from the live price
 *  while everything else is labelled with the close it belongs to. A field that is not declared here fails the test over the real screen, so a new figure cannot
 *  arrive unlabelled.
 *
 *    identity    names, sector, size class, dates: no price in them
 *    price       the close itself (replaced by a live print where one exists)
 *    reprice     a pure function of price and a figure that is fixed until the next close: recomputed from the live price (this file)
 *    close       built from the closing series (returns, RSI, averages, ranks, scores, volume); cannot be redone from one print, so it is shown AT THE CLOSE
 *    statement   from the latest annual accounts: fixed until the next filing, whatever the price does
 *  A 52-week high or low is an extreme of daily HIGHS and LOWS; a live print above the high means a new high and below the low a new low, but the exact extreme is
 *  unknown without the day's high, so the page says "at or above" and never invents the intraday figure. */
import type { Row } from './screen.ts';

export type Basis = 'identity' | 'price' | 'reprice' | 'close' | 'statement';
export const BASIS: Record<string, Basis> = {
  sym: 'identity', name: 'identity', sector: 'identity', tier: 'identity', fy: 'identity', last_date: 'identity', has_stmts: 'identity', liquid: 'close', next_earnings: 'statement', shares_changed: 'statement',
  price: 'price',
  from_high: 'reprice', high52: 'reprice', low52: 'reprice', pe: 'reprice', pb: 'reprice', div_yield: 'reprice',
  r1d: 'close', r1w: 'close', r1m: 'close', r3m: 'close', r6m: 'close', r1y: 'close', rs3m: 'close', rsi: 'close', rsi_w: 'close', rsi_m: 'close', sma20: 'close', sma50: 'close', sma200: 'close',
  vol_spike: 'close', turnover_cr: 'close', atr_pct: 'close', sd1y: 'close', tech: 'close', comp: 'close', v: 'close', rank_move: 'close', pe_pctile: 'close', mf: 'close',
  roce_med: 'statement', roe: 'statement', de: 'statement', net_margin: 'statement', ebit_margin: 'statement', margin_delta: 'statement', em_label: 'statement', rev_cagr: 'statement', eps_cagr: 'statement',
  icover: 'statement', cfo_pat: 'statement', fcf_margin: 'statement', piotroski: 'statement', q: 'statement', g: 'statement', insiders: 'statement', instis: 'statement', risk_lvl: 'statement', risk_top: 'statement',
};
export const basisOf = (key: string): Basis | null => BASIS[key] ?? null;
const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const r1 = (x: number) => Math.round(x * 10) / 10, r2 = (x: number) => Math.round(x * 100) / 100;

export interface Repriced {
  /** the price these figures are worked out at */ px: number | null; basis: 'live' | 'close'; fromHigh: number | null; high52: number | null; low52: number | null; fromLow: number | null;
  pe: number | null; pb: number | null; divYield: number | null;
  /** the live print is above the published 52-week high (or below the low): a new extreme, whose exact level the page does not claim */ newHigh: boolean; newLow: boolean;
}
/** Recompute the price-dependent figures at `live` (a print from the same Indian day as the screen or later), or return the close's own figures when there is none. */
export function reprice(row: Pick<Row, 'price' | 'from_high' | 'high52' | 'low52' | 'pe' | 'pb' | 'div_yield'>, live: number | null): Repriced {
  const close = row.price ?? null; const use = n(live) && live > 0 && n(close) && close > 0 ? live : null;
  if (use === null) return { px: close, basis: 'close', fromHigh: row.from_high ?? null, high52: row.high52 ?? null, low52: row.low52 ?? null, fromLow: n(close) && n(row.low52) && row.low52 > 0 ? r1((close / row.low52 - 1) * 100) : null, pe: row.pe ?? null, pb: row.pb ?? null, divYield: row.div_yield ?? null, newHigh: false, newLow: false };
  const k = use / close!; const hi = row.high52, lo = row.low52;
  const newHigh = n(hi) && use > hi, newLow = n(lo) && lo > 0 && use < lo;
  const high = n(hi) ? Math.max(hi, use) : null, low = n(lo) && lo > 0 ? Math.min(lo, use) : null;
  return { px: use, basis: 'live', high52: high, low52: low, fromHigh: high ? r1((use / high - 1) * 100) : null, fromLow: low ? r1((use / low - 1) * 100) : null,
    pe: n(row.pe) ? r1(row.pe * k) : null, pb: n(row.pb) ? r2(row.pb * k) : null, divYield: n(row.div_yield) ? r2(row.div_yield / k) : null, newHigh, newLow };
}
