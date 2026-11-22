/** Breakout confirmation, version 1 (22 Nov 2026): a daily list of stocks that closed above their prior 50-session high AND pass seven confirming checks, read from technical fields the daily feed already carries.
 *  The parameters below were fixed BEFORE any outcome was looked at, from conventional values (150% volume, RSI 55 to 80, 3 ATRs of extension, a 6% ATR cap), and are not tuned to results. Changing one is a new version.
 *  It is an observation list, not a book: it files no calls, sets no stop or target, and ranks nothing (names are alphabetical). A missing input makes a rule "can't tell" (null), never a pass. */
import { num, type Row, type Feed } from './feed.ts';
import type { RuleResult } from './screens.ts';

export const BREAKOUT = { id: 'breakout-confirmation', name: 'Breakout confirmation', version: 1, started_on: '2026-11-20',
  min_mcap_cr: 2000, min_turnover_cr: 10, vol_x: 1.5, rsi_lo: 55, rsi_hi: 80, ext_atrs: 3, atr_cap_pct: 6 } as const;

const g = (x: number, d = 0) => x.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const R = (id: string, label: string, threshold: string, pass: boolean | null, value: string): RuleResult => ({ id, label, pass, value: pass === null ? 'missing' : value, threshold });

/** The universe gate, before any breakout rule: size, liquidity and a price that is current to the feed's day. Returns why a name is out, or null when it is in. */
export function outOfUniverse(r: Row, asOf: string): string | null {
  const mc = num(r, 'mcap_cr'), t = num(r, 'turnover_cr');
  if (mc == null || mc < BREAKOUT.min_mcap_cr) return 'size';
  if (r.liquid !== true || t == null || t < BREAKOUT.min_turnover_cr) return 'liquidity';
  if (r.last_date !== asOf) return 'stale price';
  return null;
}
export function breakoutRules(r: Row): RuleResult[] {
  const px = num(r, 'price'), s20 = num(r, 'sma20'), s50 = num(r, 'sma50'), s200 = num(r, 'sma200'), rsi = num(r, 'rsi'), mh = num(r, 'macd_h'), rs = num(r, 'rs3m'), atr = num(r, 'atr_pct'), vs = num(r, 'vol_spike');
  const ext = px != null && s20 != null && s20 > 0 ? (px / s20 - 1) * 100 : null, atrs = ext != null && atr != null && atr > 0 ? ext / atr : null;
  return [
    R('b1', 'Closed above the highest close of the previous 50 sessions', 'new 50-session closing high', typeof r.brk50 === 'boolean' ? r.brk50 : null, 'yes'),
    R('b2', 'Volume is well above its 20-day average', `≥ ${BREAKOUT.vol_x}×`, vs == null ? null : vs >= BREAKOUT.vol_x, vs == null ? '' : `${vs.toFixed(2)}×`),
    R('b3', 'Trend is aligned: close above the 50-day and 200-day averages, 50-day above 200-day', 'close > 50-day > 200-day', px == null || s50 == null || s200 == null ? null : px > s50 && px > s200 && s50 > s200, px == null || s50 == null || s200 == null ? '' : `₹${g(px, 1)} · 50-day ₹${g(s50, 1)} · 200-day ₹${g(s200, 1)}`),
    R('b4', 'RSI (14) is firm but not extreme', `${BREAKOUT.rsi_lo} to ${BREAKOUT.rsi_hi}`, rsi == null ? null : rsi >= BREAKOUT.rsi_lo && rsi <= BREAKOUT.rsi_hi, rsi == null ? '' : rsi.toFixed(1)),
    R('b5', 'MACD histogram is positive', '> 0', mh == null ? null : mh > 0, mh == null ? '' : mh.toFixed(2)),
    R('b6', 'Ahead of the Nifty over 3 months', '> 0 points', rs == null ? null : rs > 0, rs == null ? '' : `${rs > 0 ? '+' : ''}${rs.toFixed(1)} points`),
    R('b7', 'Not stretched: close is within 3 ATRs of its 20-day average', `≤ ${BREAKOUT.ext_atrs} ATRs`, atrs == null ? null : atrs <= BREAKOUT.ext_atrs, atrs == null ? '' : `${ext!.toFixed(1)}% above, ${atrs.toFixed(1)} ATRs`),
    R('b8', 'Daily range is not erratic', `ATR ≤ ${BREAKOUT.atr_cap_pct}% of price`, atr == null ? null : atr <= BREAKOUT.atr_cap_pct, atr == null ? '' : `ATR ${atr.toFixed(1)}%`),
  ];
}
export interface BreakoutRow { sym: string; name: string; sector: string; price: number; r1d: number | null; vol_x: number | null; rsi: number | null; atr_pct: number | null; tag: '52-week high' | '50-session high'; rules: RuleResult[] }
export interface NearMiss { sym: string; name: string; failed: string }
export interface BreakoutScan { as_of: string; version: number; universe_n: number; excluded: Record<string, number>; listed: BreakoutRow[]; near_misses: NearMiss[]; pass_counts: Record<string, number> }
export function scanBreakouts(F: Pick<Feed, 'rows' | 'asOf'>): BreakoutScan {
  const asOf = F.asOf, excluded: Record<string, number> = {}, listed: BreakoutRow[] = [], near: NearMiss[] = [], counts: Record<string, number> = {}; let universe = 0;
  for (const r of F.rows) {
    const why = outOfUniverse(r, asOf); if (why) { excluded[why] = (excluded[why] ?? 0) + 1; continue; }
    universe++; const rules = breakoutRules(r);
    for (const x of rules) if (x.pass === true) counts[x.id] = (counts[x.id] ?? 0) + 1;
    const fails = rules.filter((x) => x.pass === false), blank = rules.filter((x) => x.pass === null);
    if (fails.length === 0 && blank.length === 0) listed.push({ sym: r.sym, name: String(r.name ?? r.sym), sector: String(r.sector ?? ''), price: r.price, r1d: num(r, 'r1d'), vol_x: num(r, 'vol_spike'), rsi: num(r, 'rsi'), atr_pct: num(r, 'atr_pct'), tag: r.brk52w === true ? '52-week high' : '50-session high', rules });
    else if (fails.length === 1 && blank.length === 0) near.push({ sym: r.sym, name: String(r.name ?? r.sym), failed: fails[0].label });
  }
  const by = (a: { sym: string }, b: { sym: string }) => a.sym.localeCompare(b.sym);
  return { as_of: asOf, version: BREAKOUT.version, universe_n: universe, excluded, listed: listed.sort(by), near_misses: near.sort(by), pass_counts: counts };
}
