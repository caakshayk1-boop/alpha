/** Where the paper book's P&L came from, and how the closed record has moved. Pure: no React, no clock. Everything here is worked out from the book's own rows or from the forward ledger, with the
 *  arithmetic in whole paise (so parts add up to the total exactly, as in contribution.ts), and nothing is estimated, interpolated or filled in.
 *
 *  - `attribute` splits the total P&L (realised + open) by engine and by position, signed, with the same reconciliation `contributions()` gives. A position with no P&L figure (no quantity, no price yet)
 *    is not an item and is counted as unpriced, never as zero.
 *  - `realisedCurve` is the running total of closed trades in R by exit day, with its running peak and the drop from it. It is reproducible from the ledger alone (no prices, no quantities). It is a
 *    description of a short list of trades, not a forecast; `readRecord` says so in words.
 *  - `readRecord` turns the closed trades into a few plain sentences. It never says a strategy works: below the minimum it says the record is too short to tell, and above it still says the minimum is not proof. */
import { contributions, reconciles, type Contributions } from './contribution.ts';
import { MIN_TRADES } from './ledger.ts';

const paise = (v: number) => Math.round(v * 100);
const rupees = (p: number) => p / 100;

export interface AttrRow { id: string; sym: string; engine: string; status: string; pnl: number | null; r?: number | null }
export interface EngineShare { engine: string; label: string; n: number; open: number; closed: number; realised: number; unrealised: number; total: number; gains: number; losses: number }
export interface Attribution {
  total: number; realised: number; unrealised: number;
  byEngine: EngineShare[];
  /** positions as signed contributions, largest by size, the rest netted into Other; they add up to `total` */
  positions: Contributions;
  /** the engine rows add up to the total to the paisa */
  engineReconciles: boolean; positionsReconcile: boolean;
  /** open or closed positions that have no P&L figure and so are not in any of the above */
  unpriced: number;
}
export function attribute(rows: readonly AttrRow[], nameOf: (engine: string) => string = (e) => e, max = 8): Attribution {
  const counted = rows.filter((r) => (r.status === 'open' || (r.status === 'closed' && r.r != null)));
  const priced = counted.filter((r) => typeof r.pnl === 'number' && Number.isFinite(r.pnl));
  const by = new Map<string, { n: number; open: number; closed: number; real: number; unreal: number; gains: number; losses: number }>();
  for (const r of priced) {
    const e = by.get(r.engine) ?? { n: 0, open: 0, closed: 0, real: 0, unreal: 0, gains: 0, losses: 0 }; const p = paise(r.pnl!);
    e.n++; if (r.status === 'open') { e.open++; e.unreal += p; } else { e.closed++; e.real += p; } if (p > 0) e.gains += p; else if (p < 0) e.losses += p; by.set(r.engine, e);
  }
  const byEngine: EngineShare[] = [...by.entries()].map(([engine, e]) => ({ engine, label: nameOf(engine), n: e.n, open: e.open, closed: e.closed, realised: rupees(e.real), unrealised: rupees(e.unreal), total: rupees(e.real + e.unreal), gains: rupees(e.gains), losses: rupees(e.losses) }))
    .sort((a, b) => paise(b.total) - paise(a.total) || a.label.localeCompare(b.label));
  const realised = [...by.values()].reduce((a, e) => a + e.real, 0), unrealised = [...by.values()].reduce((a, e) => a + e.unreal, 0);
  const positions = contributions(priced.map((r) => ({ key: r.id, label: r.sym, value: r.pnl! })), max);
  return { total: rupees(realised + unrealised), realised: rupees(realised), unrealised: rupees(unrealised), byEngine,
    positions, engineReconciles: byEngine.reduce((a, e) => a + paise(e.total), 0) === realised + unrealised, positionsReconcile: reconciles(positions) && paise(positions.total) === realised + unrealised,
    unpriced: counted.length - priced.length };
}

export interface CurveIn { id: string; exitDay: string | null | undefined; r: number | null | undefined }
export interface CurvePoint { day: string; /** trades that exited on this day */ n: number; /** running total in R after the day's trades */ cum: number; /** highest running total so far (never below 0, the start) */ peak: number; /** peak minus cum, 0 or more */ drop: number }
export interface Curve { points: CurvePoint[]; trades: number; /** the largest drop from a running peak, in R, with the day it began after and the day it ended */ maxDrop: { r: number; from: string | null; to: string | null } | null; total: number | null }
const r2 = (x: number) => Math.round(x * 100) / 100;
/** The running total of closed trades in R by exit day. A trade with no exit day or no R is not on the curve (and is not counted). Within a day the order of exits is unknown, so the curve is read at the end of each day. */
export function realisedCurve(items: readonly CurveIn[]): Curve {
  const xs = items.filter((i): i is { id: string; exitDay: string; r: number } => !!i.exitDay && typeof i.r === 'number' && Number.isFinite(i.r));
  const days = [...new Set(xs.map((x) => x.exitDay))].sort();
  let cum = 0, peak = 0, peakDay: string | null = null; const points: CurvePoint[] = []; let max: Curve['maxDrop'] = null;
  for (const d of days) {
    const today = xs.filter((x) => x.exitDay === d); cum = Math.round((cum + today.reduce((a, x) => a + x.r, 0)) * 1e6) / 1e6;
    if (cum > peak) { peak = cum; peakDay = d; }
    const drop = Math.max(0, r2(peak - cum)); points.push({ day: d, n: today.length, cum: r2(cum), peak: r2(peak), drop });
    if (drop > 0 && (!max || drop > max.r)) max = { r: drop, from: peakDay, to: d };
  }
  return { points, trades: xs.length, maxDrop: max, total: xs.length ? r2(cum) : null };
}

export interface RecordRead { lines: string[]; /** true when the record has reached the minimum number of closed trades */ enough: boolean }
const R = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`;
/** A few plain sentences about the closed trades. States counts and arithmetic; never claims the rules work, and never lets a short record read as a result. */
export function readRecord(rs: readonly number[], minTrades: number = MIN_TRADES): RecordRead {
  const n = rs.length; const enough = n >= minTrades; const lines: string[] = [];
  if (n === 0) return { lines: ['Nothing has closed yet, so there is no result to read. Open positions are not in any figure here.'], enough: false };
  const total = rs.reduce((a, x) => a + x, 0); const wins = rs.filter((x) => x > 0).length; const losses = rs.filter((x) => x < 0).length;
  /* 12 Nov 2026: these are RESOLVED OBSERVATIONS (picks, repeats and not-taken ones included), not trades the book closed; ledgerview.ts holds the book's own count */
  lines.push(`${n} resolved observation${n === 1 ? ' has' : 's have'} closed: ${wins} in profit, ${losses} at a loss${n - wins - losses ? `, ${n - wins - losses} flat` : ''}, ${R(total)} in total. Open positions are not in these figures.`);
  if (n >= 3) { const best = Math.max(...rs); const without = total - best; if (best > 0) lines.push(`The best single observation is ${R(best)}. Without it the total would be ${R(without)}${without <= 0 && total > 0 ? ', so the total rests on that one trade' : ''}.`); }
  lines.push(enough ? `${n} resolved observations is past the ${minTrades}-observation minimum. A minimum is not proof: it only lets the average and the win rate be shown, and overlapping observations are not independent trials.`
    : `${n} of ${minTrades} observations. A record this short cannot show whether the rules work; a few either way would change every figure here, so average R and win rate stay hidden until ${minTrades} have resolved.`);
  return { lines, enough };
}
