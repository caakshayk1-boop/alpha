/** The Lab's back-test. PRE-DECLARED RULES (changing any of them is a new version, and the numbers are not comparable across versions):
 *   - the rule is read at the close of day i, every STEP sessions; the order is placed for the next close (i+1), a day of delay a reader can obey;
 *   - at most `positions` names are held at once, one position per name, equal weight (1/positions of the book each), no leverage, long only;
 *   - the fill is that close plus 0.1% slippage; costs are 0.25% of the entry for the round trip; every market exit gives up 0.1% more;
 *   - the stop is stopPct below the fill and the targets are the style's two multiples of that risk (the same ladder the app's paper book uses): at Target 1 half
 *     is sold and the stop on the rest moves to the fill; at Target 2 the rest is sold; the time limit ends whatever is left;
 *   - DAILY CLOSES ONLY: a stop is seen only when a close is beyond it (the exit is that close, worse than the stop on a gap), and a target is taken at its
 *     price when a close has reached it. An intraday touch that closed back inside is invisible. This is stated on the page.
 *  Excess is the trade's return minus the average name's own return over the same days (buy and hold, see benchOver). Nothing here is fitted: there is nothing to fit. */
import { STYLES, styleOf } from '../exits.ts';
import type { Cond, MetricKey } from '../screener.ts';
import { LAB_KEYS, feature, type Ctx } from './features.ts';
import { HOLDOUT_FROM, type Edge, type Slice } from './verdict.ts';

export const STEP = 5, SLIP = 0.001, COST_RT = 0.0025, START = 253;
export interface Strategy { conds: Cond[]; rankBy: MetricKey; rankDir: 'desc' | 'asc'; positions: number; horizon: number; stopPct: number; /** the control: ignore the rule and pick among all names that have history, in a fixed pseudo-random order */ random?: boolean }
export type Why = 'stop' | 'break-even' | 'T2' | 'time' | 'end';
export interface Trade { j: number; sym: string; entryI: number; exitI: number; exitDate: string; ret: number; excess: number; r: number; why: Why; t1: boolean }
export interface Result { trades: Trade[]; equity: Float64Array; bench: Float64Array; from: number; maxDrawdown: number; exposure: number }

/** A stable key for a strategy, so the same rule run twice counts as one variant. */
export const strategyKey = (s: Strategy) => JSON.stringify([s.random ? 1 : 0, [...s.conds].map((c) => [c.m, c.op, c.v]).sort(), s.rankBy, s.rankDir, s.positions, s.horizon, s.stopPct]);

/** A fixed pseudo-random order for the control: the same names on the same days every run, so the control never changes between looks. */
const shuffle = (j: number, i: number) => { let h = (Math.imul(j + 1, 2654435761) ^ Math.imul(i + 7, 40503)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return (h >>> 0) / 4294967296; };
interface Sim { exitI: number; ret: number; why: Why; t1: boolean; path: number[] }
function simulate(c: Ctx, j: number, entryI: number, s: Strategy): Sim | null {
  const p = c.p, T = p.T; const C = (i: number) => p.C[j * T + i]; const close = C(entryI); if (!(close > 0)) return null;
  const fill = close * (1 + SLIP), risk = fill * (s.stopPct / 100); const st = STYLES.find((x) => x.id === styleOf(s.horizon))!;
  let stop = fill - risk; const t1p = fill + st.t1 * risk, t2p = fill + st.t2 * risk;
  let booked = 0, rem = 1, t1 = false; const path = [close / fill - COST_RT];
  const last = Math.min(entryI + s.horizon, T - 1);
  for (let k = entryI + 1; k <= last; k++) {
    const cl = C(k); if (!(cl > 0)) { path.push(path[path.length - 1]); continue; }
    if (cl <= stop) { const px = cl * (1 - SLIP); const ret = booked + rem * (px / fill - 1) - COST_RT; path.push(ret); return { exitI: k, ret, why: t1 ? 'break-even' : 'stop', t1, path }; }
    if (!t1 && cl >= t1p) { booked += 0.5 * (t1p / fill - 1); rem = 0.5; t1 = true; stop = fill; }
    if (t1 && cl >= t2p) { const ret = booked + rem * (t2p / fill - 1) - COST_RT; path.push(ret); return { exitI: k, ret, why: 'T2', t1, path }; }
    if (k === last) { const px = cl * (1 - SLIP); const ret = booked + rem * (px / fill - 1) - COST_RT; path.push(ret); return { exitI: k, ret, why: k === entryI + s.horizon ? 'time' : 'end', t1, path }; }
    path.push(booked + rem * (cl / fill - 1) - COST_RT);
  }
  return null;
}

export async function runStrategy(c: Ctx, s: Strategy, progress?: (done: number, of: number) => void): Promise<Result> {
  const p = c.p, T = p.T, N = p.N; const trades: Trade[] = []; const eqDelta = new Float64Array(T); const open = new Map<number, number>();   // symbol -> exit day
    const days: number[] = []; for (let i = START; i < T - 2; i += STEP) days.push(i);
  let n = 0, busy = 0;
  for (const i of days) {
    if (++n % 20 === 0) { progress?.(n, days.length); await new Promise((r) => setTimeout(r, 0)); }
    for (const [j, x] of open) if (x <= i) open.delete(j);
    const free = s.positions - open.size; if (free <= 0) continue;
    const cand: [number, number][] = [];
    for (let j = 0; j < N; j++) {
      if (open.has(j)) continue; let pass = true;
      if (s.random) pass = feature(c, 'r1y', j, i) !== null;                  // the control may pick any name with a year of history, whatever the rule says
      else for (const cd of s.conds) { const v = feature(c, cd.m, j, i); if (v === null || (cd.op === 'gte' ? v < cd.v : v > cd.v)) { pass = false; break; } }
      if (!pass) continue; const rk = s.random ? shuffle(j, i) : feature(c, s.rankBy, j, i); if (rk === null) continue; cand.push([j, rk]);
    }
    cand.sort((a, b) => (s.rankDir === 'desc' ? b[1] - a[1] : a[1] - b[1]) || a[0] - b[0]);
    for (const [j] of cand.slice(0, free)) {
      const sim = simulate(c, j, i + 1, s); if (!sim) continue; open.set(j, sim.exitI + 1);
      for (let k = 1; k < sim.path.length; k++) eqDelta[i + 1 + k] += (sim.path[k] - sim.path[k - 1]) / s.positions;
      eqDelta[i + 1] += sim.path[0] / s.positions;
      const bench = benchOver(c, i + 1, sim.exitI); busy += sim.exitI - i;
      const risk = s.stopPct / 100;
      trades.push({ j, sym: p.syms[j], entryI: i + 1, exitI: sim.exitI, exitDate: p.dates[sim.exitI], ret: sim.ret, excess: sim.ret - bench, r: sim.ret / risk, why: sim.why, t1: sim.t1 });
    }
  }
  progress?.(days.length, days.length);
  const equity = new Float64Array(T), bench = new Float64Array(T); let e = 1, maxDd = 0, peak = 1;
  for (let i = 0; i < T; i++) { e += eqDelta[i]; equity[i] = e; bench[i] = c.ewCum[i]; if (i >= START) { peak = Math.max(peak, e); maxDd = Math.min(maxDd, e / peak - 1); } }
  return { trades, equity, bench, from: START, maxDrawdown: maxDd, exposure: Math.min(1, busy / Math.max(1, (T - START) * s.positions)) };
}

/** What holding every name equally for exactly this trade's days would have returned: the plain average of each name's own return from the entry close to the
 *  exit close, over the names that printed on both. Buy-and-hold over the window, NOT a daily-rebalanced index: rebalancing every day of a noisy, thin-traded
 *  universe adds a return that no one could collect, and measuring against it would make every rule look worse than it is. */
export function benchOver(c: Ctx, a: number, b: number): number {
  const { C, N, T } = c.p; let s = 0, n = 0;
  for (let j = 0; j < N; j++) { const x = C[j * T + a], y = C[j * T + b]; if (x > 0 && y > 0) { s += y / x - 1; n++; } }
  return n ? s / n : 0;
}

/** Mean by calendar month of exit, then t across months (needs six). The same statistic the research harness uses. */
export function monthlyT(rows: { d: string; v: number }[]): { mean: number | null; t: number | null; months: number } {
  const m = new Map<string, number[]>(); for (const r of rows) { const k = r.d.slice(0, 7); (m.get(k) ?? m.set(k, []).get(k)!).push(r.v); }
  const xs = [...m.values()].map((a) => a.reduce((x, y) => x + y, 0) / a.length), n = xs.length; if (!n) return { mean: null, t: null, months: 0 };
  const mean = xs.reduce((x, y) => x + y, 0) / n; if (n < 6) return { mean, t: null, months: n };
  const sd = Math.sqrt(xs.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1)); return { mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, months: n };
}
export interface Stats extends Slice { win: number | null; avgR: number | null; avgDays: number | null }
export function stats(trades: readonly Trade[], pick: (t: Trade) => boolean = () => true): Stats {
  const ts = trades.filter(pick); if (!ts.length) return { n: 0, meanNet: null, meanExcess: null, t: null, months: 0, win: null, avgR: null, avgDays: null };
  const ex = monthlyT(ts.map((t) => ({ d: t.exitDate, v: t.excess }))); const avg = (f: (t: Trade) => number) => ts.reduce((a, t) => a + f(t), 0) / ts.length;
  return { n: ts.length, meanNet: avg((t) => t.ret), meanExcess: avg((t) => t.excess), t: ex.t, months: ex.months, win: ts.filter((t) => t.ret > 0).length / ts.length, avgR: avg((t) => t.r), avgDays: avg((t) => t.exitI - t.entryI) };
}
export const isHoldout = (t: Trade) => t.exitDate >= HOLDOUT_FROM;

/** The names that pass the rule at the latest close, best first, so a rule can be read against today as well as against history. */
export function matchesNow(c: Ctx, s: Strategy): { sym: string; rank: number }[] {
  const i = c.p.T - 1; const out: { sym: string; rank: number }[] = [];
  for (let j = 0; j < c.p.N; j++) {
    if (c.p.first[j] > i || !(c.p.C[j * c.p.T + i] > 0)) continue; let pass = true;
    for (const cd of s.conds) { const v = feature(c, cd.m, j, i); if (v === null || (cd.op === 'gte' ? v < cd.v : v > cd.v)) { pass = false; break; } }
    const rk = pass ? feature(c, s.rankBy, j, i) : null; if (rk !== null) out.push({ sym: c.p.syms[j], rank: rk });
  }
  return out.sort((a, b) => (s.rankDir === 'desc' ? b.rank - a.rank : a.rank - b.rank) || a.sym.localeCompare(b.sym));
}

/** Rule minus control, by calendar month of exit: the control's monthly mean net return is subtracted from the rule's. Months where either has no trade are left out. */
export function edgeStats(rule: readonly Trade[], control: readonly Trade[], pick: (t: Trade) => boolean = () => true): Edge {
  const by = (ts: readonly Trade[]) => { const m = new Map<string, number[]>(); for (const t of ts.filter(pick)) { const k = t.exitDate.slice(0, 7); (m.get(k) ?? m.set(k, []).get(k)!).push(t.ret); } return m; };
  const a = by(rule), b = by(control); const d: number[] = [];
  for (const [k, xs] of a) { const ys = b.get(k); if (ys) d.push(xs.reduce((p, q) => p + q, 0) / xs.length - ys.reduce((p, q) => p + q, 0) / ys.length); }
  const n = d.length; if (!n) return { n: rule.filter(pick).length, mean: null, t: null, months: 0 };
  const mean = d.reduce((p, q) => p + q, 0) / n; if (n < 6) return { n: rule.filter(pick).length, mean, t: null, months: n };
  const sd = Math.sqrt(d.reduce((p, q) => p + (q - mean) ** 2, 0) / (n - 1));
  return { n: rule.filter(pick).length, mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, months: n };
}
