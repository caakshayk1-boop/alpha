/** The rule board: ten plain rules run on every liquid stock at the last close. Each rule is a fixed, public test on fields the screen
 *  already publishes (moving averages, the 52-week range, RSI, volume against its recent average, the 3-month gap to the Nifty); each
 *  says in words what it checks and shows the figure that put a stock on it. Pure functions, tested in tests/lib.test.ts.
 *
 *  A rule firing is an observation about price and volume at one close. It is not a recommendation, carries no target and no
 *  probability, and has no relation to Swing v2's paper setups, which follow their own tested rulebook. A field the feed does not carry
 *  makes the stock unmeasured for that rule (counted, never treated as a miss or a hit); illiquid stocks are left out of every rule.
 *  A rule that fires on a quarter of the market or more describes the market, and the board says so. */
import type { Row } from './types.ts';

export type Theme = 'Trend' | 'Momentum' | 'Volume' | 'Range';
export type RuleId = 'near-high' | 'aligned' | 'pullback' | 'surge-up' | 'surge-down' | 'oversold' | 'hot' | 'near-low' | 'big-move' | 'rs-leader';
type R = Row & { vol_spike?: number | null; liquid?: boolean | null };
export interface Rule {
  id: RuleId; theme: Theme; title: string;
  /** what it checks, with its numbers */
  check: string;
  /** the figure that puts a stock on it, and how that figure is printed */
  measure: { label: string; of: (r: R) => number | null; unit: '%' | 'x' | 'pts' | ''; dp: number; sign?: boolean };
  /** most notable first */
  order: 'desc' | 'asc';
  /** null when a field the rule needs is missing */
  test: (r: R) => boolean | null;
}
const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const all = (...v: unknown[]) => v.every(n);

export const WIDE_SHARE = 0.25;      // a rule on at least this share of liquid names describes the market, not the stock

export const RULES: readonly Rule[] = [
  { id: 'near-high', theme: 'Range', title: 'Near a 52-week high', check: 'Closed within 2% of its 52-week high.',
    measure: { label: 'From the high', of: (r) => (n(r.from_high) ? r.from_high : null), unit: '%', dp: 1, sign: true }, order: 'desc',
    test: (r) => (n(r.from_high) ? r.from_high >= -2 : null) },
  { id: 'aligned', theme: 'Trend', title: 'Price and averages in order', check: 'Price above its 20-day average, which is above its 50-day, which is above its 200-day.',
    measure: { label: 'Above the 200-day', of: (r) => (all(r.price, r.sma200) && r.sma200! > 0 ? (r.price! / r.sma200! - 1) * 100 : null), unit: '%', dp: 1, sign: true }, order: 'desc',
    test: (r) => (all(r.price, r.sma20, r.sma50, r.sma200) ? r.price! > r.sma20! && r.sma20! > r.sma50! && r.sma50! > r.sma200! : null) },
  { id: 'pullback', theme: 'Trend', title: 'Pullback inside an uptrend', check: 'Above its 200-day average with the 50-day above the 200-day, now between the 50-day and 20-day averages after a falling week.',
    measure: { label: 'Week', of: (r) => (n(r.r1w) ? r.r1w : null), unit: '%', dp: 1, sign: true }, order: 'asc',
    test: (r) => (all(r.price, r.sma20, r.sma50, r.sma200, r.r1w) ? r.price! > r.sma200! && r.sma50! > r.sma200! && r.price! <= r.sma20! && r.price! >= r.sma50! && r.r1w! < 0 : null) },
  { id: 'surge-up', theme: 'Volume', title: 'Volume surge, price up', check: 'Volume at 2x its recent average or more, on a day the price rose 2% or more.',
    measure: { label: 'Volume', of: (r) => (n(r.vol_spike) ? r.vol_spike : null), unit: 'x', dp: 1 }, order: 'desc',
    test: (r) => (all(r.vol_spike, r.r1d) ? r.vol_spike! >= 2 && r.r1d! >= 2 : null) },
  { id: 'surge-down', theme: 'Volume', title: 'Volume surge, price down', check: 'Volume at 2x its recent average or more, on a day the price fell 2% or more.',
    measure: { label: 'Volume', of: (r) => (n(r.vol_spike) ? r.vol_spike : null), unit: 'x', dp: 1 }, order: 'desc',
    test: (r) => (all(r.vol_spike, r.r1d) ? r.vol_spike! >= 2 && r.r1d! <= -2 : null) },
  { id: 'oversold', theme: 'Momentum', title: 'RSI at or below 30', check: 'The screen’s RSI at 30 or lower: a measure of how one-sided recent closes were, not a call that a rebound is due.',
    measure: { label: 'RSI', of: (r) => (n(r.rsi) ? r.rsi : null), unit: '', dp: 0 }, order: 'asc',
    test: (r) => (n(r.rsi) ? r.rsi <= 30 : null) },
  { id: 'hot', theme: 'Momentum', title: 'RSI at or above 70', check: 'The screen’s RSI at 70 or higher: recent closes were strongly one-sided, which is not a call that a fall is due.',
    measure: { label: 'RSI', of: (r) => (n(r.rsi) ? r.rsi : null), unit: '', dp: 0 }, order: 'desc',
    test: (r) => (n(r.rsi) ? r.rsi >= 70 : null) },
  { id: 'near-low', theme: 'Range', title: 'Near a 52-week low', check: 'Closed within 5% above its 52-week low.',
    measure: { label: 'Above the low', of: (r) => (all(r.price, r.low52) && r.low52! > 0 ? (r.price! / r.low52! - 1) * 100 : null), unit: '%', dp: 1, sign: true }, order: 'asc',
    test: (r) => (all(r.price, r.low52) && r.low52! > 0 ? r.price! <= r.low52! * 1.05 : null) },
  { id: 'big-move', theme: 'Momentum', title: 'A move of 5% or more in a day', check: 'The latest session closed 5% or more above or below the one before.',
    measure: { label: 'Day', of: (r) => (n(r.r1d) ? r.r1d : null), unit: '%', dp: 1, sign: true }, order: 'desc',
    test: (r) => (n(r.r1d) ? Math.abs(r.r1d) >= 5 : null) },
  { id: 'rs-leader', theme: 'Momentum', title: 'Ahead of the Nifty over 3 months', check: 'Its 3-month return is 15 percentage points or more above the Nifty’s.',
    measure: { label: 'Against the Nifty', of: (r) => (n(r.rs3m) ? r.rs3m : null), unit: 'pts', dp: 1, sign: true }, order: 'desc',
    test: (r) => (n(r.rs3m) ? r.rs3m >= 15 : null) },
];

export interface Hit { sym: string; name: string; price: number | null; day: number | null; value: number; sector?: string }
export interface RuleResult { rule: Rule; hits: Hit[]; eligible: number; unmeasured: number; share: number | null; wide: boolean }

/** Run every rule over the liquid stocks. `eligible` is the liquid stocks the rule could be measured on, `unmeasured` those it could not. */
export function runRules(rows: readonly Row[]): { results: RuleResult[]; liquid: number; total: number } {
  const liquid = (rows as R[]).filter((r) => r.liquid === true);
  const results = RULES.map((rule) => {
    const hits: Hit[] = [];
    let measured = 0;
    for (const r of liquid) {
      const t = rule.test(r);
      if (t === null) continue;
      measured++;
      const v = rule.measure.of(r);
      if (t && v !== null) hits.push({ sym: r.sym, name: r.name, price: n(r.price) ? r.price : null, day: n(r.r1d) ? r.r1d : null, value: v, sector: r.sector });
    }
    hits.sort((a, b) => (rule.order === 'desc' ? b.value - a.value : a.value - b.value) || a.sym.localeCompare(b.sym));
    const share = measured > 0 ? hits.length / measured : null;
    return { rule, hits, eligible: measured, unmeasured: liquid.length - measured, share, wide: share !== null && share >= WIDE_SHARE };
  });
  return { results, liquid: liquid.length, total: rows.length };
}

export const THEMES: readonly Theme[] = ['Trend', 'Momentum', 'Volume', 'Range'];

export function printValue(rule: Rule, v: number): string {
  const m = rule.measure, a = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: m.dp, maximumFractionDigits: m.dp });
  const sign = m.sign ? (v > 0 ? '+' : v < 0 ? '−' : '') : (v < 0 ? '−' : '');
  return `${sign}${a}${m.unit === 'x' ? 'x' : m.unit === '%' ? '%' : m.unit === 'pts' ? ' pts' : ''}`;
}
