/** rulebook-ledger/1: the only source of every public number. buildNext(prev, inputs) -> next; history is append-only (assertAppendOnly).
 *  Pick mechanics (ADR-006): a name first listed in a run opens a paper position of NOTIONAL rupees at the NEXT session's open; it exits at the
 *  next open after the first run where it no longer passes; initial risk (R) is measured to a fixed STOP_PCT below entry; a daily low at or under
 *  the stop exits at the stop, or at the open if it gapped through. Bars missing for a session leave the pick pending/open: nothing is invented. */
import { evaluate, type Fill, r2 } from './accounting.ts';
import { chargesFor, CHARGES_VERSION } from './charges.ts'; import { ruleFor, timeLimit, type ExitRule } from './exitrules.ts'; import { CAPITAL, MAX_OPEN, SECTOR_CAP, TICKET } from './book.ts';
export const SCHEMA = 'rulebook-ledger/1';
export const NOTIONAL = 100000, STOP_PCT = 20, SMALL_N = 30;   // NOTIONAL is the legacy position size, used only when a ledger's config has no ticket
/** 'signal-close' (ADR-013, owner request): a pick fills at the CLOSE of the day it is listed, and a dropped pick exits at the close of the run that drops it. 'next-open' (ADR-006): the next session's open. */
export type EntryBasis = 'signal-close' | 'next-open';
export interface Bar { o: number; h: number; l: number; c: number }
export type Bars = Record<string, Record<string, Bar>>;       // symbol -> date -> bar (a missing date is missing)
export interface RunIn { screen_id: string; run_date: string; passed: string[]; /** the passers the book took as calls (ADR-014); absent = every passer is taken */ taken?: string[]; /** the screen's own list (its best passers); v2 */ listed?: string[]; skipped?: { symbol: string; why: string }[]; near_miss?: { symbol: string; failed_rule: string; gap: string }[]; refused?: string[]; universe_n: number; not_scorable_n: number }
export interface Pick { id: string; screen_id: string; symbol: string; first_listed_run: string; status: 'pending' | 'open' | 'closed' | 'voided';
  fills: Fill[]; stop: number | null; exit_after: string | null; exit_reason: 'dropped' | 'stop' | 'gap-stop' | 'target' | 'gap-target' | 'time' | null; /** the exit rule in force (ADR-017); added to a pick when it is entered */ rule?: ExitRule; voided: { date: string; reason: string } | null }
export interface BookDay { date: string; screen_id: string; equity: number; committed: number; realised: number; unrealised: number; open_n: number; benchmark_close: number | null }
export interface Aggregate { screen_id: string; as_of: string; n_picks: number; n_open: number; n_closed: number; n_void: number; win_rate: number | null; expectancy_r: number | null;
  avg_win: number | null; avg_loss: number | null; max_drawdown: number; longest_losing_streak: number; honesty: string | null }
export interface Ledger { schema: string; as_of: string | null; built_on: string | null;
  config: { charges_version: string; stop_pct: number; notional: number; benchmark: string; entry_basis?: EntryBasis; capital?: number; ticket?: number; max_open?: number; sector_cap?: number };
  screens: { id: string; name: string; version: number; started_on: string }[]; runs: RunIn[]; picks: Pick[];
  voids: { pick_id: string; date: string; reason: string }[]; transitions: { screen_id: string; run_date: string; entered: string[]; exited: string[]; still_in: string[] }[];
  refusals: { screen_id: string; symbol: string; refused_on: string; price_at_refusal: number | null }[]; book_days: BookDay[]; aggregates: Aggregate[];
  /** The benchmark's close on the record's first book day, written ONCE (22 Nov 2026). The first night's build did not store it, and book_days are append-only, so it lives beside them: the chart's Nifty 500 line starts from it. Never changed once set (assertAppendOnly). */
  benchmark_start?: { date: string; close: number; source: string } }
export interface Inputs { as_of: string; built_on: string; runs: RunIn[]; bars: Bars; benchmark_close: number | null; screens?: Ledger['screens'] }

export const emptyLedger = (basis: EntryBasis = 'signal-close', ticket: number = TICKET): Ledger => ({ schema: SCHEMA, as_of: null, built_on: null, config: { charges_version: CHARGES_VERSION, stop_pct: STOP_PCT, notional: ticket, benchmark: '^CRSLDX (Nifty 500 price index, no dividends)', entry_basis: basis, capital: CAPITAL, ticket, max_open: MAX_OPEN, sector_cap: SECTOR_CAP },
  screens: [], runs: [], picks: [], voids: [], transitions: [], refusals: [], book_days: [], aggregates: [] });

/** Honesty label for any statistic. */
export const honesty = (n: number): string | null => (n < SMALL_N ? `n = ${n} — too few to conclude anything` : null);

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const dates = (b: Record<string, Bar> | undefined, after: string) => Object.keys(b ?? {}).filter((d) => d > after).sort();
const buyFill = (date: string, px: number, ticket: number): Fill => { const qty = Math.floor(ticket / px); return { date, side: 'buy', qty, price: px, charges: chargesFor('buy', qty, px) }; };
const sellFill = (date: string, qty: number, px: number): Fill => ({ date, side: 'sell', qty, price: px, charges: chargesFor('sell', qty, px) });

/** One share costs more than the position size: the pick is voided with its reason (it stays on the record), never bought as an oversized single share. */
function unaffordable(p: Pick, px: number, date: string, ticket: number): boolean { if (Math.floor(ticket / px) >= 1) return false; p.status = 'voided'; p.voided = { date, reason: `one share costs ₹${px.toLocaleString('en-IN')}, more than the ₹${ticket.toLocaleString('en-IN')} position size, so no whole share could be bought` }; return true; }
/** Advance one pick through every bar it has not yet seen. Deterministic: depends only on the pick and the bars. */
function advance(p: Pick, bars: Record<string, Bar> | undefined, asOf: string, basis: EntryBasis, ticket: number): void {
  if (p.status === 'closed' || p.status === 'voided') return;
  const close = basis === 'signal-close';
  if (p.status === 'pending') {
    if (close) { const d = p.first_listed_run, b = bars?.[d]; if (!b || d > asOf || !(b.c > 0)) return; if (unaffordable(p, b.c, d, ticket)) return; p.fills.push(buyFill(d, b.c, ticket)); p.rule = ruleFor(p.screen_id); p.stop = r2(b.c * (1 - p.rule.stop_pct / 100)); p.status = 'open'; }
    else { const d = dates(bars, p.first_listed_run)[0]; if (!d || d > asOf) return; const px = bars![d].o; if (!(px > 0)) return; if (unaffordable(p, px, d, ticket)) return; p.fills.push(buyFill(d, px, ticket)); p.rule = ruleFor(p.screen_id); p.stop = r2(px * (1 - p.rule.stop_pct / 100)); p.status = 'open'; }
  }
  const entryDate = p.fills[0].date; const qty = p.fills.reduce((a, f) => a + (f.side === 'buy' ? f.qty : -f.qty), 0); const entryPx = p.fills[0].price;
  // Calls entered before ADR-017 get the rule of their screen once, before any of them had exited (n closed was 0); the fills are untouched
  if (!p.rule) { p.rule = ruleFor(p.screen_id); p.stop = r2(entryPx * (1 - p.rule.stop_pct / 100)); }
  const rule = p.rule, target = r2(entryPx * (1 + rule.target_pct / 100)), limit = timeLimit(entryDate); let peak = entryPx;
  // signal-close: the entry day itself cannot hit the stop (filled at its close); next-open: from the entry day (filled at its open, so its low can breach)
  for (const d of Object.keys(bars ?? {}).filter((x) => (close ? x > entryDate : x >= entryDate)).sort()) {
    if (d > asOf) break; const b = bars![d];
    const level = rule.trailing ? Math.max(p.stop!, r2(peak * (1 - rule.stop_pct / 100))) : p.stop!;     // trailing: from the highest close up to the PREVIOUS session
    if (b.l <= level) { p.fills.push(sellFill(d, qty, Math.min(level, b.o))); p.status = 'closed'; p.exit_reason = b.o <= level ? 'gap-stop' : 'stop'; return; }
    if (b.h >= target) { p.fills.push(sellFill(d, qty, Math.max(target, b.o))); p.status = 'closed'; p.exit_reason = b.o >= target ? 'gap-target' : 'target'; return; }
    if (p.exit_after && (close ? d >= p.exit_after : d > p.exit_after)) { p.fills.push(sellFill(d, qty, close ? b.c : b.o)); p.status = 'closed'; p.exit_reason = 'dropped'; return; }
    if (d >= limit) { p.fills.push(sellFill(d, qty, b.c)); p.status = 'closed'; p.exit_reason = 'time'; return; }
    peak = Math.max(peak, b.c);
  }
}
/** The bar the position is marked on: its latest close on or before as_of; null if none. */
const markOf = (bars: Record<string, Bar> | undefined, asOf: string) => { const d = Object.keys(bars ?? {}).filter((x) => x <= asOf).sort().pop(); return d ? bars![d].c : null; };

export function buildNext(prev: Ledger, inp: Inputs): Ledger {
  const L = clone(prev); L.as_of = inp.as_of; L.built_on = inp.built_on;
  for (const s of inp.screens ?? []) if (!L.screens.find((x) => x.id === s.id)) L.screens.push(s);
  for (const run of inp.runs) {
    if (L.runs.find((r) => r.screen_id === run.screen_id && r.run_date === run.run_date)) continue;    // a repeated run is a no-op, never a rewrite
    L.runs.push(clone(run));
    const priorRun = L.runs.filter((r) => r.screen_id === run.screen_id && r.run_date < run.run_date).pop();
    const before = new Set(priorRun?.passed ?? []), now = new Set(run.passed);
    L.transitions.push({ screen_id: run.screen_id, run_date: run.run_date, entered: [...now].filter((s) => !before.has(s)).sort(), exited: [...before].filter((s) => !now.has(s)).sort(), still_in: [...now].filter((s) => before.has(s)).sort() });
    for (const sym of run.taken ?? run.passed) {
      const live = L.picks.find((p) => p.screen_id === run.screen_id && p.symbol === sym && (p.status === 'pending' || p.status === 'open'));
      if (live) { live.exit_after = null; continue; }
      L.picks.push({ id: `${run.screen_id}:${sym}:${run.run_date}`, screen_id: run.screen_id, symbol: sym, first_listed_run: run.run_date, status: 'pending', fills: [], stop: null, exit_after: null, exit_reason: null, voided: null });
    }
    for (const p of L.picks) if (p.screen_id === run.screen_id && (p.status === 'open' || p.status === 'pending') && !now.has(p.symbol) && !p.exit_after) {
      if (p.status === 'pending') { p.status = 'voided'; p.voided = { date: run.run_date, reason: 'dropped from the list before the entry fill' }; L.voids.push({ pick_id: p.id, date: run.run_date, reason: p.voided.reason }); }
      else if (p.rule?.exit_on_drop ?? ruleFor(p.screen_id).exit_on_drop) p.exit_after = run.run_date;
    }
    for (const sym of run.refused ?? []) L.refusals.push({ screen_id: run.screen_id, symbol: sym, refused_on: run.run_date, price_at_refusal: inp.bars[sym]?.[run.run_date]?.c ?? null });
  }
  const basis = L.config.entry_basis ?? 'next-open', ticket = L.config.ticket ?? NOTIONAL; for (const p of L.picks) { advance(p, inp.bars[p.symbol], inp.as_of, basis, ticket); if (p.status === 'voided' && p.voided && !L.voids.find((v) => v.pick_id === p.id)) L.voids.push({ pick_id: p.id, date: p.voided.date, reason: p.voided.reason }); }
  // book day: one append-only row per screen and for "all", for this as_of only; never replaced
  const ids = [...new Set(L.picks.map((p) => p.screen_id).concat(L.screens.map((s) => s.id)))].sort();
  const rows = (sid: string): BookDay => {
    let realised = 0, unrealised = 0, open = 0, committed = 0;
    for (const p of L.picks) { if (p.status === 'voided' || p.status === 'pending' || (sid !== 'all' && p.screen_id !== sid)) continue;
      const m = markOf(inp.bars[p.symbol], inp.as_of); const r = evaluate(p.fills, p.stop!, p.status === 'open' ? m : null);
      realised += r.realised; unrealised += r.unrealised; committed += p.fills[0].qty * p.fills[0].price; if (p.status === 'open') open++; }
    return { date: inp.as_of, screen_id: sid, equity: r2(realised + unrealised), committed: r2(committed), realised: r2(realised), unrealised: r2(unrealised), open_n: open, benchmark_close: inp.benchmark_close };
  };
  for (const sid of [...ids, 'all']) if (!L.book_days.find((b) => b.date === inp.as_of && b.screen_id === sid)) L.book_days.push(rows(sid));
  L.aggregates = [...ids, 'all'].map((sid) => aggregate(L, sid, inp));
  return L;
}

/** The sessions a night must record: every NSE session after the ledger's last day, up to and including `asOf`, that the benchmark traded; the last is always `asOf`.
 *  27 Nov 2026: the ledger used to take only the benchmark's newest day, and Yahoo posts that bar late on some nights (timely on 25 Nov, late on 24 and 26 Nov), so a night that saw
 *  a late benchmark recorded nothing new and the next night jumped over the missing session for good (book days 17, 18, 20, 23, 25 Nov, with 19, 24 and 26 missing).
 *  A first-ever ledger (no last day) and a same-day rerun record just `asOf`. */
export function sessionsToRecord(prevAsOf: string | null, asOf: string, benchmark: Record<string, number>, isSession: (d: string) => boolean): string[] {
  if (!prevAsOf || asOf <= prevAsOf) return [asOf];
  const days = Object.keys(benchmark).filter((d) => d > prevAsOf && d < asOf && isSession(d)).sort();
  return [...days, asOf];
}

export interface CatchUpInputs { as_of: string; built_on: string; runs: RunIn[]; bars: Bars; benchmark: Record<string, number>; screens?: Ledger['screens'] }
/** Records every missed session in order, exactly as an on-time night would have: each day advances the positions only as far as that day (so a stop hit on the 26th never touches the 25th's equity),
 *  gets its own book day with that day's benchmark close, and the weekly runs dated on or before it are applied first. Runs dated after the last day still apply on the last, as before.
 *  Returns every step, oldest first, so each day's file can be written; the last step is the new ledger. */
export function buildCatchUp(prev: Ledger, inp: CatchUpInputs, isSession: (d: string) => boolean): { date: string; ledger: Ledger }[] {
  const days = sessionsToRecord(prev.as_of, inp.as_of, inp.benchmark, isSession), steps: { date: string; ledger: Ledger }[] = [];
  let L = prev; const pending = [...inp.runs];
  days.forEach((d, i) => {
    const last = i === days.length - 1, take = pending.filter((r) => last || r.run_date <= d);
    for (const r of take) pending.splice(pending.indexOf(r), 1);
    L = buildNext(L, { as_of: d, built_on: inp.built_on, runs: take, bars: inp.bars, benchmark_close: inp.benchmark[d] ?? null, screens: inp.screens });
    steps.push({ date: d, ledger: L });
  });
  return steps;
}

export function aggregate(L: Ledger, sid: string, inp: { bars: Bars; as_of: string }): Aggregate {
  const ps = L.picks.filter((p) => sid === 'all' || p.screen_id === sid), closed = ps.filter((p) => p.status === 'closed');
  const res = closed.map((p) => ({ p, r: evaluate(p.fills, p.stop!, null), exit: p.fills[p.fills.length - 1].date })).sort((a, b) => a.exit.localeCompare(b.exit));
  const wins = res.filter((x) => x.r.total > 0), losses = res.filter((x) => x.r.total <= 0), n = res.length;
  const mean = (a: number[]) => (a.length ? r2(a.reduce((x, y) => x + y, 0) / a.length) : null);
  let streak = 0, longest = 0; for (const x of res) { if (x.r.total <= 0) { streak++; longest = Math.max(longest, streak); } else streak = 0; }
  const curve = L.book_days.filter((b) => b.screen_id === sid).sort((a, b) => a.date.localeCompare(b.date)).map((b) => b.equity);
  let peak = 0, dd = 0; for (const e of curve) { peak = Math.max(peak, e); dd = Math.min(dd, e - peak); }
  return { screen_id: sid, as_of: inp.as_of, n_picks: ps.length, n_open: ps.filter((p) => p.status === 'open' || p.status === 'pending').length, n_closed: n, n_void: ps.filter((p) => p.status === 'voided').length,
    win_rate: n ? r2(wins.length / n) : null, expectancy_r: mean(res.map((x) => x.r.r ?? 0)), avg_win: mean(wins.map((x) => x.r.total)), avg_loss: mean(losses.map((x) => x.r.total)),
    max_drawdown: r2(dd), longest_losing_streak: longest, honesty: honesty(n) };
}

/** Structural validation. Returns reasons; empty means valid. */
export function validate(L: Ledger): string[] {
  const bad: string[] = [];
  if (L.schema !== SCHEMA) bad.push(`schema is ${L.schema}`);
  const ids = L.picks.map((p) => p.id); if (new Set(ids).size !== ids.length) bad.push('duplicate pick ids');
  for (const p of L.picks) {
    if (p.status === 'voided' && !(p.voided && p.voided.reason)) bad.push(`${p.id} voided without a reason`);
    if ((p.status === 'open' || p.status === 'closed') && (p.stop == null || p.fills.length === 0)) bad.push(`${p.id} ${p.status} without fills or stop`);
    if (p.status === 'closed' && p.fills.filter((f) => f.side === 'sell').length === 0) bad.push(`${p.id} closed without an exit`);
    if (p.rule && p.fills.length && p.stop != null && Math.abs(p.stop - r2(p.fills[0].price * (1 - p.rule.stop_pct / 100))) > 0.011) bad.push(`${p.id} initial stop does not match its recorded exit rule`);
    for (const f of p.fills) if (!(f.qty > 0 && f.price > 0)) bad.push(`${p.id} has a bad fill`);
  }
  for (const v of L.voids) if (!v.reason) bad.push(`void ${v.pick_id} has no reason`);
  const keys = L.book_days.map((b) => `${b.date}|${b.screen_id}`); if (new Set(keys).size !== keys.length) bad.push('duplicate book days');
  for (const a of L.aggregates) if (a.n_closed < SMALL_N && !a.honesty) bad.push(`aggregate ${a.screen_id} lacks its small-n label`);
  return bad;
}
/** History may only grow. Returns the violations; empty means next extends prev without rewriting it. */
export function assertAppendOnly(prev: Ledger, next: Ledger): string[] {
  const bad: string[] = [], same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (const k of ['runs', 'transitions', 'voids', 'book_days', 'refusals'] as const) {
    if (next[k].length < prev[k].length) bad.push(`${k} shrank`);
    prev[k].forEach((row, i) => { if (!same(row, next[k][i])) bad.push(`${k}[${i}] was rewritten`); });
  }
  if (prev.benchmark_start && !same(prev.benchmark_start, next.benchmark_start)) bad.push('benchmark_start was rewritten');
  for (const p of prev.picks) {
    const n = next.picks.find((x) => x.id === p.id); if (!n) { bad.push(`pick ${p.id} was deleted`); continue; }
    p.fills.forEach((f, i) => { if (!same(f, n.fills[i])) bad.push(`pick ${p.id} fill ${i} was rewritten`); });
    if (p.status === 'voided' && !same(p.voided, n.voided)) bad.push(`void on ${p.id} was changed`);
    if ((p.status === 'closed' || p.status === 'voided') && n.status !== p.status) bad.push(`pick ${p.id} left ${p.status}`);
  }
  return bad;
}
