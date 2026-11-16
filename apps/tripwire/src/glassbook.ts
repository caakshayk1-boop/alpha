/** The Glass Book (Tripwire 4.0, 15 Nov 2026): F1 timelines and traces, F2 the sit-out log, F3 the scoreboard.
 *  Pure: no React, no clock, no network. Every figure is derived from the ONE ledger view (ledgerview.ts) and the auto-book plan (autobook.ts) the Book and Record already read.
 *  Nothing here changes a rule, a threshold, a cost or a stored shape. A feature that needs a number the ledger does not hold shows it as missing (null), never as an estimate. */
import type { Ledger, LedgerPick, Outcome } from './ledger.ts';
import { MIN_TRADES, RETIRED } from './ledger.ts';
import { realised, type AutoPlan } from './autobook.ts';
import { buildLedgerView, type LedgerView, type Lifecycle } from './ledgerview.ts';
import { realisedCurve, type Curve } from './attribution.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const mean = (a: readonly number[]): number | null => (a.length ? r2(a.reduce((s, x) => s + x, 0) / a.length) : null);

/* ---------------- F1: the position timeline and the trace ---------------- */

export type EventKind = 'signal' | 'taken' | 'awaiting' | 'skipped' | 'entry' | 't1' | 't2' | 'exit';
export interface GlassEvent {
  kind: EventKind; /** India date the event happened; null while the event has not happened (awaiting entry) */ day: string | null; title: string; detail: string;
  px: number | null; /** where the fact comes from, in words */ source: string; /** how firm it is: a recorded fact, a selection, or a fill simulated from completed daily bars */ basis: 'recorded' | 'selection' | 'simulated fill';
}
export interface Timeline { lifecycle: Lifecycle; pick: LedgerPick; qty: number | null; outcome: Outcome | null; events: GlassEvent[] }

const inr = (v: number): string => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const SRC_PICK = 'the nightly ledger (pick written at the close)';
const SRC_BOOK = 'the paper book selection (autobook rules)';
const SRC_REPLAY = 'the ledger outcome, replayed from completed daily bars';

/** The events behind one position, oldest first, each with its date, its source and how firm it is. A missing fact is left out, never filled. */
export function lifecycleTimeline(l: Ledger, plan: Pick<AutoPlan, 'taken'>, lifecycleId: string, lv: LedgerView = buildLedgerView(l, plan)): Timeline | null {
  const lc = lv.lifecycles.find((x) => x.id === lifecycleId); if (!lc) return null;
  const t = plan.taken.find((x) => x.pick.id === lc.pickId); if (!t) return null;
  const p = t.pick; const o = l.outcomes[p.id] ?? null; const ev: GlassEvent[] = [];
  ev.push({ kind: 'signal', day: p.asOf, title: `${p.engine} fired on ${p.sym}`, detail: `Score ${p.score}, rank ${p.rank}. Signal close ${inr(p.ref)}, stop ${inr(p.stop)}.`, px: p.ref, source: SRC_PICK, basis: 'recorded' });
  ev.push({ kind: 'taken', day: p.asOf, title: 'Taken by the paper book', detail: `${t.qty} shares planned. This is a selection, not a fill: the entry is the next session's open.`, px: null, source: SRC_BOOK, basis: 'selection' });
  if (!o || o.status === 'pending' || o.status === 'void') ev.push({ kind: 'awaiting', day: null, title: 'Awaiting entry', detail: 'No completed session has confirmed the entry yet.', px: null, source: SRC_REPLAY, basis: 'simulated fill' });
  else if (o.status === 'skipped') ev.push({ kind: 'skipped', day: o.entryDay ?? null, title: 'Skipped at the open', detail: `${(o.skipReason ?? 'The entry rule was not met').replace(/\.$/, '')}. No trade was opened.`, px: null, source: SRC_REPLAY, basis: 'simulated fill' });
  else {
    if (o.entryDay && typeof o.entry === 'number') ev.push({ kind: 'entry', day: o.entryDay, title: 'Entered', detail: `Simulated fill at ${inr(o.entry)}: the next open plus slippage, from completed bars. A quote is not a fill.`, px: o.entry, source: SRC_REPLAY, basis: 'simulated fill' });
    if (o.t1Hit && o.t1Day) ev.push({ kind: 't1', day: o.t1Day, title: 'Target 1 filled', detail: `Half sold${typeof o.t1Px === 'number' ? ` at ${inr(o.t1Px)}` : ''}; the stop moved to the entry price. The position is still open.`, px: typeof o.t1Px === 'number' ? o.t1Px : null, source: SRC_REPLAY, basis: 'simulated fill' });
    if (o.t2Hit && o.t2Day) ev.push({ kind: 't2', day: o.t2Day, title: 'Target 2 filled', detail: `The rest sold${typeof o.t2Px === 'number' ? ` at ${inr(o.t2Px)}` : ''}.`, px: typeof o.t2Px === 'number' ? o.t2Px : null, source: SRC_REPLAY, basis: 'simulated fill' });
    if (o.status === 'closed' && o.exitDay && typeof o.exit === 'number') ev.push({ kind: 'exit', day: o.exitDay, title: `Closed${o.reason ? `: ${o.reason.replace(/\.$/, '')}` : ''}`, detail: `Exit ${inr(o.exit)}${typeof o.r === 'number' ? `, ${fmtR(o.r)}` : ''}${typeof o.pct === 'number' ? ` (${o.pct > 0 ? '+' : ''}${o.pct}% on the entry)` : ''}.`, px: o.exit, source: SRC_REPLAY, basis: 'simulated fill' });
  }
  const order: Record<EventKind, number> = { signal: 0, taken: 1, awaiting: 2, skipped: 2, entry: 3, t1: 4, t2: 5, exit: 6 };
  ev.sort((a, b) => (a.day ?? '9999').localeCompare(b.day ?? '9999') || order[a.kind] - order[b.kind]);
  return { lifecycle: lc, pick: p, qty: t.qty, outcome: o, events: ev };
}
export const fmtR = (v: number | null | undefined): string => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`);

export type TraceMetric = 'closed' | 'open' | 'totalR' | 'realisedInr';
export interface TraceRow { lifecycleId: string; sym: string; engine: string; day: string | null; /** the amount this row adds to the headline (1 for a count) */ value: number; formula: string }
export interface Trace { metric: TraceMetric; /** the headline as the Book shows it */ value: number | null; rows: TraceRow[]; /** the sum of the rows, recomputed; equals value or the trace is wrong */ recomputed: number | null }

/** The events behind a headline number. `value` is the figure the Book states; `recomputed` is the rows added up again from their own quantities and prices. They must agree. */
export function traceOf(l: Ledger, plan: Pick<AutoPlan, 'taken'>, metric: TraceMetric, lv: LedgerView = buildLedgerView(l, plan)): Trace {
  const qty = new Map(plan.taken.map((x) => [x.pick.id, x.qty]));
  const closedLc = lv.lifecycles.filter((x) => x.state === 'closed');
  if (metric === 'closed' || metric === 'open') {
    const rows = lv.lifecycles.filter((x) => x.state === metric).map((x): TraceRow => ({ lifecycleId: x.id, sym: x.sym, engine: x.engine, day: metric === 'closed' ? x.exitDay : x.asOf, value: 1, formula: metric === 'closed' ? 'closed: the whole position has gone under a confirmed exit' : 'open: entered, shares still held (a partial exit stays open)' }));
    return { metric, value: metric === 'closed' ? lv.closed : lv.open, rows, recomputed: rows.length };
  }
  if (metric === 'totalR') {
    const rows = closedLc.filter((x) => x.r != null).map((x): TraceRow => ({ lifecycleId: x.id, sym: x.sym, engine: x.engine, day: x.exitDay, value: x.r!, formula: `${fmtR(x.r)} as recorded on the outcome` }));
    const sum = rows.length ? r2(rows.reduce((s, x) => s + x.value, 0)) : null;
    return { metric, value: sum, rows, recomputed: sum };
  }
  const rows: TraceRow[] = [];
  for (const x of closedLc) {
    const o = l.outcomes[x.pickId]; const q = qty.get(x.pickId); const pnl = o && q != null ? realised(o, q) : null;
    if (pnl != null && o) rows.push({ lifecycleId: x.id, sym: x.sym, engine: x.engine, day: x.exitDay, value: pnl, formula: `${o.pct}% × ${inr(o.entry ?? 0)} × ${q} shares` });
  }
  const sum = rows.length ? r2(rows.reduce((s, x) => s + x.value, 0)) : null;
  return { metric, value: sum, rows, recomputed: sum };
}

/* ---------------- F2: the sit-out log ---------------- */

export type SitReason = 'duplicate' | 'risk-cap' | 'size' | 'not-selected';
export interface SitOutRow { pickId: string; sym: string; engine: string; asOf: string; reason: SitReason; /** the book's own words for why, verbatim */ why: string; /** what the observation did next: an observation outcome, never a trade */ r: number | null; exitDay: string | null; ended: string | null }
export interface SitOutLog { /** resolved observations the book did not take: the rows below */ rows: SitOutRow[]; /** resolved observations the book DID take (they are lifecycles, in the book's own figures) */ resolvedTaken: number; /** every resolved observation: equals rows.length + resolvedTaken */ resolved: number; /** not-taken observations whose replay has not closed yet: not listed, counted */ stillRunning: number; byReason: Record<SitReason, number> }

const reasonOf = (why: string): SitReason => (/already held/i.test(why) ? 'duplicate' : /book is full|already running in/i.test(why) ? 'risk-cap' : /costs more than/i.test(why) ? 'size' : 'not-selected');

export function sitOutLog(l: Ledger, plan: Pick<AutoPlan, 'taken'> & { refused?: AutoPlan['refused'] }): SitOutLog {
  const live = l.picks.filter((p) => !l.voided?.[p.id] && !RETIRED.has(p.engine));
  const taken = new Set(plan.taken.map((t) => t.pick.id)); const why = new Map((plan.refused ?? []).map((x) => [x.pick.id, x.why]));
  const isResolved = (p: LedgerPick) => { const o = l.outcomes[p.id]; return !!o && o.status === 'closed' && typeof o.r === 'number'; };
  const rows: SitOutRow[] = []; let resolvedTaken = 0, stillRunning = 0;
  for (const p of live) {
    if (taken.has(p.id)) { if (isResolved(p)) resolvedTaken++; continue; }
    if (!isResolved(p)) { stillRunning++; continue; }
    const o = l.outcomes[p.id]; const w = why.get(p.id) ?? 'The book did not select this pick.';
    rows.push({ pickId: p.id, sym: p.sym, engine: p.engine, asOf: p.asOf, reason: why.has(p.id) ? reasonOf(w) : 'not-selected', why: w, r: o.r ?? null, exitDay: o.exitDay ?? null, ended: o.reason ?? null });
  }
  rows.sort((a, b) => b.asOf.localeCompare(a.asOf) || a.sym.localeCompare(b.sym) || a.engine.localeCompare(b.engine));
  const byReason: Record<SitReason, number> = { duplicate: 0, 'risk-cap': 0, size: 0, 'not-selected': 0 }; for (const r of rows) byReason[r.reason]++;
  return { rows, resolvedTaken, resolved: rows.length + resolvedTaken, stillRunning, byReason };
}

/* ---------------- F3: the honest scoreboard ---------------- */

export interface Bin { label: string; lo: number | null; hi: number | null; n: number }
const EDGES: [string, number | null, number | null][] = [['−1R or worse', null, -1], ['−1R to −0.5R', -1, -0.5], ['−0.5R to 0', -0.5, 0], ['0 to +0.5R', 0, 0.5], ['+0.5R to +1R', 0.5, 1], ['+1R to +2R', 1, 2], ['+2R or better', 2, null]];
export interface EngineLine { engine: string; n: number; avgR: number | null; winRate: number | null; totalR: number | null }
export interface Scoreboard {
  /** closed book lifecycles with a result in R */ n: number; needed: number; enough: boolean; sampleLine: string;
  expectancy: number | null; winRate: number | null; avgWin: number | null; avgLoss: number | null; totalR: number | null;
  bins: Bin[]; engines: EngineLine[];
  /** the largest fall of the running R total from its peak, over the book's closed trades. The ledger holds exits, not daily marks, so open positions are not in it. */
  drawdown: { r: number; from: string | null; to: string | null } | null; curve: Curve; drawdownBasis: string;
}
export function scoreboard(l: Ledger, plan: Pick<AutoPlan, 'taken'>, lv: LedgerView = buildLedgerView(l, plan)): Scoreboard {
  const cl = lv.lifecycles.filter((x) => x.state === 'closed' && typeof x.r === 'number');
  const rs = cl.map((x) => x.r!); const n = rs.length; const wins = rs.filter((r) => r > 0); const losses = rs.filter((r) => r < 0);
  const bins: Bin[] = EDGES.map(([label, lo, hi]) => ({ label, lo, hi, n: rs.filter((r) => (lo == null || r >= lo) && (hi == null || r < hi)).length }));
  const engines: EngineLine[] = [...new Set(cl.map((x) => x.engine))].sort().map((e) => { const r = cl.filter((x) => x.engine === e).map((x) => x.r!); return { engine: e, n: r.length, avgR: mean(r), winRate: r.length ? r2((r.filter((x) => x > 0).length / r.length) * 100) : null, totalR: r.length ? r2(r.reduce((s, x) => s + x, 0)) : null }; });
  const curve = realisedCurve(cl.map((x) => ({ id: x.id, exitDay: x.exitDay, r: x.r })));
  const enough = n >= MIN_TRADES;
  return {
    n, needed: MIN_TRADES, enough, sampleLine: enough ? `${n} closed book positions. The minimum sample of ${MIN_TRADES} is reached; it is still a paper record, not proof of an edge.` : `${n} closed book positions of the ${MIN_TRADES} the minimum sample needs. A minimum sample is not proof, and fewer than that is only a start.`,
    expectancy: mean(rs), winRate: n ? r2((wins.length / n) * 100) : null, avgWin: mean(wins), avgLoss: mean(losses), totalR: n ? r2(rs.reduce((s, x) => s + x, 0)) : null,
    bins, engines, drawdown: n ? curve.maxDrop : null, curve, drawdownBasis: 'From the closed book positions in exit order. The ledger records exits, not daily marks, so open positions and the days between exits are not in this figure.',
  };
}
