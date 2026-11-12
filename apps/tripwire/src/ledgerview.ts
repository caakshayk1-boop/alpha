/** THE ledger layer (12 Nov 2026, Tripwire 2.0 phase 1). Every view reads its populations, its P&L split and its coverage from here; none computes its own.
 *  Pure: no React, no clock. Display and accounting only: no rule, threshold, cost, fill or stored ledger shape changes.
 *
 *  POPULATIONS (never interchangeable)
 *    observation   one engine naming one company on one night (a ledger pick). Repeats and picks the book did not take are observations. Voided picks and retired engines are out.
 *    resolved      an observation whose replay closed with an R. It is research history, NOT a trade: "5 resolved observations", never "5 closed trades".
 *    selected      a pick the engine book accepted that night (autobook `taken`). It is a selection, not yet a position: a pick whose next open gapped over 2% is selected and then skipped.
 *    position      a selected pick that entered or is waiting to: awaiting entry + open + closed. Skipped picks are NOT positions.
 *    closed        the whole position has gone (remaining shares zero). A partial exit at Target 1 is open, never closed.
 *  selected = skipped + awaiting + open + closed, and observations = selected + notTaken. `invariants()` states both. */
import type { Ledger, LedgerPick, Outcome } from './ledger.ts';
import { RETIRED, MIN_TRADES } from './ledger.ts';
import type { AutoPlan } from './autobook.ts';
import { bookRulesOf } from './autobook.ts';
import { resultBasis, type ResultBasis } from './provenance.ts';
import { rulesFor } from './rules.ts';
import { lifecycleIdFor, lifecycleIdOf } from './lifecycle.ts';
export { lifecycleIdFor, lifecycleIdOf, normalizeLifecycles } from './lifecycle.ts';

export type LifeState = 'awaiting' | 'open' | 'closed' | 'skipped';
/** The state of a position from its view. `closed` needs a confirmed exit AND no shares left: a closed view that still holds shares is open (a malformed or half-written state never inflates the count). */
export function lifeStateOf(v: { status: string; ladder?: { qtyLeft: number } | null }): LifeState {
  if (v.status === 'skipped') return 'skipped';
  if (v.status === 'closed') return v.ladder && v.ladder.qtyLeft > 0 ? 'open' : 'closed';
  if (v.status === 'open') return 'open';
  return 'awaiting';
}
const stateOfOutcome = (o: Outcome | undefined): LifeState => (!o ? 'awaiting' : o.status === 'closed' && o.final ? 'closed' : o.status === 'open' ? 'open' : o.status === 'skipped' ? 'skipped' : 'awaiting');

export interface Lifecycle {
  id: string; pickId: string; sym: string; engine: string; owner: 'engine' | 'you'; asOf: string; state: LifeState;
  /** the observation ids behind this position: its own pick first, then later looks at the same company while it was held */
  observationIds: string[]; exitDay: string | null; r: number | null; basis: ResultBasis | null; rules: string;
}
export interface Validation {
  /** the rule version in force on the newest recorded night */
  rules: string; needed: number;
  /** closed book lifecycles filed under that version, as filed: the ones that can count towards a minimum sample */
  qualifying: number; qualifyingTotalR: number | null;
  /** all closed book lifecycles by the rule they were produced under; never added into one like-for-like figure */
  byBasis: { asFiled: number; restated: number; original: number };
}
export interface LedgerView {
  observations: number; resolvedObservations: number; resolvedNames: number; notTaken: number;
  selected: number; skipped: number; awaiting: number; open: number; closed: number;
  user: { awaiting: number; open: number; closed: number; skipped: number };
  lifecycles: Lifecycle[]; validation: Validation;
}
export interface UserRow { p: { id: string; lifecycleId?: unknown; sym: string; engine: string; asOf: string }; v: { status: string; ladder?: { qtyLeft: number } | null; r: number | null } }

const live = (l: Ledger): LedgerPick[] => l.picks.filter((p) => !l.voided?.[p.id] && !RETIRED.has(p.engine));
export function buildLedgerView(l: Ledger, plan: Pick<AutoPlan, 'taken'> | null, user: readonly UserRow[] = []): LedgerView {
  const obs = live(l); const resolved = obs.filter((p) => { const o = l.outcomes[p.id]; return !!o && o.status === 'closed' && typeof o.r === 'number'; });
  const takenIds = new Set((plan?.taken ?? []).map((t) => t.pick.id));
  const lifecycles: Lifecycle[] = (plan?.taken ?? []).map((t) => {
    const o = l.outcomes[t.pick.id]; const state = stateOfOutcome(o); const exitDay = state === 'closed' ? o?.exitDay ?? null : null;
    const same = obs.filter((p) => p.sym === t.pick.sym && p.id !== t.pick.id && !takenIds.has(p.id) && p.asOf >= t.pick.asOf && (exitDay == null || p.asOf <= exitDay)).sort((a, b) => a.asOf.localeCompare(b.asOf) || a.id.localeCompare(b.id));
    const basis = state === 'closed' && o ? resultBasis(t.pick, true, o) : null;
    return { id: lifecycleIdFor(t.pick.id), pickId: t.pick.id, sym: t.pick.sym, engine: t.pick.engine, owner: 'engine' as const, asOf: t.pick.asOf, state, observationIds: [t.pick.id, ...same.map((p) => p.id)], exitDay,
      r: state === 'closed' && typeof o?.r === 'number' ? o.r : null, basis: basis?.basis ?? null, rules: `${rulesFor(t.pick.asOf)} · ${bookRulesOf(t.pick.asOf)}` };
  });
  const count = (s: LifeState) => lifecycles.filter((x) => x.state === s).length;
  const last = l.days.length ? l.days.reduce((m, d) => (d.asOf > m ? d.asOf : m), l.days[0].asOf) : null;
  const rules = last ? `${rulesFor(last)} · ${bookRulesOf(last)}` : '—';
  const closedLc = lifecycles.filter((x) => x.state === 'closed' && x.r != null);
  const qual = closedLc.filter((x) => x.basis === 'as-filed' && x.rules === rules);
  const us = { awaiting: 0, open: 0, closed: 0, skipped: 0 }; for (const r of user) us[lifeStateOf(r.v)]++;
  return { observations: obs.length, resolvedObservations: resolved.length, resolvedNames: new Set(resolved.map((p) => p.sym)).size, notTaken: Math.max(0, obs.length - lifecycles.length),
    selected: lifecycles.length, skipped: count('skipped'), awaiting: count('awaiting'), open: count('open'), closed: count('closed'), user: us, lifecycles,
    validation: { rules, needed: MIN_TRADES, qualifying: qual.length, qualifyingTotalR: qual.length ? Math.round(qual.reduce((a, x) => a + x.r!, 0) * 100) / 100 : null,
      byBasis: { asFiled: closedLc.filter((x) => x.basis === 'as-filed').length, restated: closedLc.filter((x) => x.basis === 'restated').length, original: closedLc.filter((x) => x.basis === 'original').length } } };
}

/* The five selectors every view reads. Not interchangeable: each answers one question. */
export const bookClosedCount = (v: LedgerView): number => v.closed;
export const bookOpenCount = (v: LedgerView): number => v.open;
export const resolvedObservationCount = (v: LedgerView): number => v.resolvedObservations;
export const userClosedCount = (v: LedgerView): number => v.user.closed;
export const validationClosedCount = (v: LedgerView): number => v.validation.qualifying;
/** Positions the book holds, in the sense of the partition: awaiting entry + open + closed. Skipped picks are not positions. */
export const bookPositionCount = (v: LedgerView): number => v.awaiting + v.open + v.closed;

export function invariants(v: LedgerView): { ok: boolean; failed: string[] } {
  const failed: string[] = [];
  if (v.selected !== v.skipped + v.awaiting + v.open + v.closed) failed.push('selected picks do not partition into skipped, awaiting entry, open and closed');
  if (v.observations !== v.selected + v.notTaken) failed.push('observations are not selected plus not taken');
  if (v.resolvedObservations < v.closed) failed.push('fewer resolved observations than closed book positions');
  if (new Set(v.lifecycles.map((x) => x.id)).size !== v.lifecycles.length) failed.push('duplicate lifecycle ids');
  return { ok: !failed.length, failed };
}

/* Words. One place, so the strip, the Record and the Picks header cannot phrase the same count differently. */
const pl = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
export const bookClosedWord = (v: LedgerView): string => pl(bookClosedCount(v), 'closed book position');
export const resolvedWord = (v: LedgerView): string => `${pl(resolvedObservationCount(v), 'resolved observation')} · includes repeated and not-taken signals`;
export function partitionWord(v: LedgerView): string {
  return `${pl(v.selected, 'pick')} selected by the book = ${pl(bookPositionCount(v), 'position')} (${v.awaiting} awaiting entry, ${v.open} open, ${v.closed} closed)${v.skipped ? ` + ${v.skipped} skipped at the open, never entered` : ''}. ${v.notTaken.toLocaleString('en-IN')} other observations were not taken.`;
}
export function validationLines(v: LedgerView): string[] {
  const x = v.validation; const b = x.byBasis;
  const lines = [`${x.qualifying} of ${x.needed} qualifying lifecycles under ${x.rules}. A lifecycle is one position from entry to exit; ${pl(v.resolvedObservations, 'resolved observation')} overlap and are not that many independent trials.`,
    'A minimum sample is not proof: it only lets an average and a win rate be shown.'];
  if (b.restated + b.original > 0) lines.push(`Closed book positions by rule: ${b.asFiled} as filed, ${b.restated} restated, ${b.original} original rule. They are counted separately; their total is not a like-for-like result for the current strategy.`);
  return lines;
}

/* ---- P&L accounting (Tripwire 2.0, 1.2) ------------------------------------------------------------------------------------------------------------------------------------------------
 *  Realised, unrealised, total and open-trade P&L are worked out here, independently of `View.pnl`, from the position's shares, fill, booked partial exits and mark.
 *  CONVENTION (stated on the page): the round-trip cost is `cost% x fill x shares`, allocated pro rata by shares, so the shares already sold carry their part and the shares still held carry the rest:
 *  the whole is charged exactly once. Target fills are limit orders and carry no slippage; the shares still held are marked as if sold at the observed price, with the tracker's exit slippage on that value
 *  (the tracker's own open-position formula). Realised = booked exits net of their share of costs. Unrealised = remaining shares marked at the observed price against the SAME fill, net of their share of costs.
 *  Total = realised + unrealised, added in whole paise. Open-trade P&L = booked partials + the remaining mark, for a position still open; it is never called unrealised.
 *  R keeps the ORIGINAL filled-position risk: (fill - the stop it was filed with) x the original shares. A partial exit, a raised break-even stop or fewer shares left never change it. */
const paise = (x: number) => Math.round(x * 100);
export interface SplitIn { qty0: number; fill: number; stop: number; qtyLeft: number; /** profit already booked by partial exits, (price - fill) x shares, BEFORE costs */ booked: number; mark: number | null; costPct: number; slipPct?: number }
export interface Split { realised: number; unrealised: number | null; total: number | null; /** booked partials + the remaining mark, for an open position; null for a finished one */ openTrade: number | null; risk: number; r: number | null }
export function splitOpen(i: SplitIn): Split {
  const slip = (i.slipPct ?? 0.1) / 100; const sold = Math.max(0, i.qty0 - i.qtyLeft); const perShare = (i.costPct / 100) * i.fill;
  const realised = paise(i.booked - perShare * sold) / 100; const risk = paise((i.fill - i.stop) * i.qty0) / 100;
  if (i.mark == null || !(i.mark > 0)) return { realised, unrealised: null, total: null, openTrade: null, risk, r: null };
  const u = paise((i.mark - i.fill) * i.qtyLeft - perShare * i.qtyLeft - slip * i.mark * i.qtyLeft);
  const total = (paise(realised) + u) / 100;
  return { realised, unrealised: u / 100, total, openTrade: total, risk, r: risk > 0 ? Math.round((total / risk) * 100) / 100 : null };
}
/** A finished position: every share has gone, so the whole result is realised and nothing is unrealised. `pnl` is the tracker's own total after costs (null = R only, no rupee figure). */
export function splitClosed(pnl: number | null, risk: number): Split {
  return pnl == null ? { realised: NaN, unrealised: null, total: null, openTrade: null, risk, r: null } : { realised: pnl, unrealised: 0, total: pnl, openTrade: null, risk, r: risk > 0 ? Math.round((pnl / risk) * 100) / 100 : null };
}
export interface SplitRow { p: { qty: number; stop: number }; v: { status: string; entry?: number; mark: number | null; pnl: number | null; adjFactor?: number; ladder?: { qtyLeft: number; booked: number } | null } }
/** The split of one book row, on the same basis the card draws (after a split or bonus the stop and the share count move with the bars). `null` for a position with no P&L to split (waiting, skipped, R only). */
export function splitOfRow(row: SplitRow, costPct: number): Split | null {
  const { p, v } = row; const adj = v.adjFactor && v.adjFactor !== 1 ? v.adjFactor : 1; const qty0 = p.qty / adj; const stop = Math.round(p.stop * adj * 100) / 100;
  if (v.status === 'closed') { const s = splitClosed(v.pnl, v.entry != null ? (v.entry - stop) * qty0 : 0); return s.total == null ? null : s; }
  if (v.status !== 'open' || v.entry == null || !(Number.isFinite(v.entry) && v.entry > 0)) return null;
  /* a ladder with a missing share count or booked figure (a partial or damaged saved state) cannot be split: it is NOT measured, never guessed as a full position */
  if (v.ladder && !(Number.isFinite(v.ladder.qtyLeft) && Number.isFinite(v.ladder.booked))) return null;
  return splitOpen({ qty0, fill: v.entry, stop, qtyLeft: v.ladder ? v.ladder.qtyLeft : qty0, booked: v.ladder?.booked ?? 0, mark: v.mark, costPct });
}
/* ---- Snapshot, coverage, totals (Tripwire 2.0, 1.3, 2.1) --------------------------------------------------------------------------------------------------------------------------------
 *  ONE snapshot per render of the book: Book, the P&L page, the insights and the export all read the same object and carry its id, so two numbers on one screen cannot come from two moments.
 *  Rounding is done once, here, in whole paise. A missing mark is never a zero: one missing mark makes the total a PARTIAL SUBTOTAL that says how many positions it covers; no mark at all makes it unavailable. */
export interface SnapRow {
  p: { id: string; sym: string; engine: string; qty: number; stop: number; lifecycleId?: unknown };
  v: { status: string; entry?: number; mark: number | null; markKind: 'live' | 'close' | null; pnl: number | null; r: number | null; dataNote?: string; adjFactor?: number; ladder?: { qtyLeft: number; booked: number } | null; sessions: number };
  dayPnl: number | null; markT?: number | null; owner: 'engine' | 'you';
}
export interface SnapPosition { id: string; lifecycleId: string; sym: string; engine: string; owner: 'engine' | 'you'; state: LifeState; qtyLeft: number; entry: number | null; mark: number | null; markKind: 'live' | 'close' | null; markT: number | null; split: Split | null; dayPnl: number | null; value: number | null; incompleteHistory: boolean }
export type CoverageState = 'none' | 'complete' | 'partial' | 'unavailable';
export interface Coverage {
  /** positions still open (a mark is expected for each) */
  open: number; measured: number; missing: number; state: CoverageState;
  /** open positions whose daily history is missing or incomplete: their quote is real, their exit has not been verified */
  historyIncomplete: number;
  /** closed positions with no rupee figure (R only): the totals leave them out, so the totals are a partial subtotal and this says so (12 Nov 2026, Codex on #62) */
  closedUnpriced: number;
  /** the oldest and the newest exchange print among live marks; positions marked at a daily close have no print time */
  oldestPrint: number | null; newestPrint: number | null; live: number; atClose: number;
}
export interface Totals { realised: number | null; unrealised: number | null; total: number | null; openTrade: number | null; day: number | null; /** the figures cover only the measured positions */ partial: boolean; unavailable: boolean }
export interface Snapshot {
  id: string; ledgerUpdated: string | null; positions: SnapPosition[]; totals: Totals; coverage: Coverage;
  gainers: SnapPosition[]; losers: SnapPosition[]; largest: { sym: string; pct: number } | null; exceptions: SnapPosition[];
  invariants: { ok: boolean; failed: string[] };
}
const fnv = (s: string): string => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
export function snapshotOf(rows: readonly SnapRow[], costPct: number, ledgerUpdated: string | null = null): Snapshot {
  const positions: SnapPosition[] = rows.map((r) => {
    const split = splitOfRow(r, costPct); const state = lifeStateOf(r.v); const adj = r.v.adjFactor && r.v.adjFactor !== 1 ? r.v.adjFactor : 1;
    const qtyLeft = state === 'open' ? (r.v.ladder && Number.isFinite(r.v.ladder.qtyLeft) ? r.v.ladder.qtyLeft : r.p.qty / adj) : state === 'awaiting' ? r.p.qty / adj : 0;
    return { id: r.p.id, lifecycleId: lifecycleIdOf(r.p), sym: r.p.sym, engine: r.p.engine, owner: r.owner, state, qtyLeft, entry: r.v.entry ?? null, mark: r.v.mark, markKind: r.v.markKind, markT: r.markT ?? null, split, dayPnl: r.dayPnl,
      value: state === 'open' && r.v.mark != null ? paise(r.v.mark * qtyLeft) / 100 : null, incompleteHistory: state === 'open' && !!r.v.dataNote };
  });
  const open = positions.filter((x) => x.state === 'open');
  const measured = open.filter((x) => x.split?.total != null); const prints = open.filter((x) => x.markKind === 'live' && x.markT != null).map((x) => x.markT!);
  const coverage: Coverage = { open: open.length, measured: measured.length, missing: open.length - measured.length, state: !open.length ? 'none' : !measured.length ? 'unavailable' : measured.length === open.length ? 'complete' : 'partial',
    historyIncomplete: open.filter((x) => x.incompleteHistory).length, closedUnpriced: positions.filter((x) => x.state === 'closed' && !x.split).length, oldestPrint: prints.length ? Math.min(...prints) : null, newestPrint: prints.length ? Math.max(...prints) : null, live: open.filter((x) => x.markKind === 'live').length, atClose: open.filter((x) => x.markKind === 'close').length };
  const withSplit = positions.filter((x) => x.split); const known = (f: (s: Split) => number | null) => { const v = withSplit.map((x) => f(x.split!)).filter((n): n is number => n != null && Number.isFinite(n)); return v.length ? v.reduce((a, n) => a + paise(n), 0) / 100 : null; };
  const unavailable = open.length > 0 && !measured.length; const realised = withSplit.length ? known((s) => (Number.isFinite(s.realised) ? s.realised : null)) : null;
  const unrealised = unavailable ? null : known((s) => s.unrealised); const openTrade = unavailable ? null : known((s) => s.openTrade);
  const total = realised == null && unrealised == null ? null : unavailable ? null : (paise(realised ?? 0) + paise(unrealised ?? 0)) / 100;
  const days = positions.filter((x) => x.dayPnl != null).map((x) => x.dayPnl!); const day = days.length ? days.reduce((a, n) => a + paise(n), 0) / 100 : null;
  const totals: Totals = { realised, unrealised, total, openTrade, day, partial: coverage.state === 'partial' || coverage.closedUnpriced > 0, unavailable };
  const priced = positions.filter((x) => x.split?.total != null);
  const gainers = priced.filter((x) => x.split!.total! > 0).sort((a, b) => b.split!.total! - a.split!.total! || a.sym.localeCompare(b.sym)).slice(0, 3);
  const losers = priced.filter((x) => x.split!.total! < 0).sort((a, b) => a.split!.total! - b.split!.total! || a.sym.localeCompare(b.sym)).slice(0, 3);
  const val = open.filter((x) => x.value != null); const sum = val.reduce((a, x) => a + x.value!, 0); const top = val.length ? val.reduce((a, x) => (x.value! > a.value! ? x : a), val[0]) : null;
  const failed: string[] = [];
  if (total != null && realised != null && (unrealised != null || !open.length) && paise(total) !== paise(realised) + paise(unrealised ?? 0)) failed.push('realised + unrealised is not the total');
  const rowSum = priced.reduce((a, x) => a + paise(x.split!.total!), 0); if (total != null && !totals.partial && rowSum !== paise(total)) failed.push('the position totals do not add up to the total');
  const id = `snap-${fnv([ledgerUpdated ?? '', costPct, ...positions.map((x) => `${x.id}|${x.state}|${x.mark ?? ''}|${x.split?.total ?? ''}|${x.dayPnl ?? ''}`)].join(';'))}`;
  return { id, ledgerUpdated, positions, totals, coverage, gainers, losers, largest: top && sum > 0 ? { sym: top.sym, pct: Math.round((top.value! / sum) * 1000) / 10 } : null, exceptions: positions.filter((x) => (x.state === 'open' && (x.mark == null || x.split?.total == null || x.incompleteHistory)) || (x.state === 'closed' && !x.split)), invariants: { ok: !failed.length, failed } };
}
/* Words for the two statuses. Quote freshness and exit verification are different questions and are never one "Live". */
export function coverageWords(c: Coverage, lastConfirmed: string | null): { marks: string; exit: string; exitComplete: boolean } {
  const marks = c.state === 'none' ? 'No open positions to mark' : c.state === 'unavailable' ? 'Marks unavailable: no open position has a price, so no total is shown' : `Marks: ${c.measured} of ${c.open} open position${c.open === 1 ? '' : 's'} measured${c.missing ? `; the figures below are a partial subtotal of those ${c.measured}` : ''}`;
  const marksAll = c.closedUnpriced > 0 ? `${marks}${c.state === 'none' ? '' : '. '}${c.closedUnpriced} closed position${c.closedUnpriced === 1 ? ' has' : 's have'} an R result but no rupee figure, so the totals leave ${c.closedUnpriced === 1 ? 'it' : 'them'} out` : marks;
  const complete = c.historyIncomplete === 0;
  return { marks: marksAll, exitComplete: complete, exit: complete ? `Exit verification: complete${lastConfirmed ? ` through ${lastConfirmed}` : ''}` : `Exit verification: incomplete · daily history is missing or incomplete for ${c.historyIncomplete} of ${c.open} open position${c.open === 1 ? '' : 's'}${lastConfirmed ? `; last confirmed history ${lastConfirmed}` : ''}` };
}
/* ---- Bar status (Tripwire 2.0, 2.3) ----------------------------------------------------------------------------------------------------------------------------------------------------
 *  A daily bar is CONFIRMED (its session is over and the exchange has closed it), FORMING (its session is still on, or the provider marked it so), STALE (an old confirmed bar: a newer session has finished
 *  and has no bar here) or MISSING. A forming bar is provisional: a completed-close view leaves it out, or draws it as a provisional endpoint with the time it was observed. Nothing here changes a rule. */
import { lastFinishedSession } from './calendar.ts';
export type BarStatus = 'confirmed' | 'forming' | 'stale' | 'missing';
const istDayOf = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
export function barStatus(bar: { t: number; forming?: boolean } | null | undefined, nowMs: number): BarStatus {
  if (!bar || !Number.isFinite(bar.t)) return 'missing';
  const day = istDayOf(bar.t); const last = lastFinishedSession(nowMs);
  if (bar.forming || day > last) return 'forming';
  return day < last ? 'stale' : 'confirmed';
}
/** The bars a completed-close view may use: confirmed and stale ones, never a forming bar. */
export const completedBars = <T extends { t: number; forming?: boolean }>(bars: readonly T[], nowMs: number): T[] => bars.filter((b) => barStatus(b, nowMs) !== 'forming');
/** The newest confirmed day, and, when the last bar is still forming, the provisional endpoint with the time it was observed. Never one without the other being said. */
export function barsCaption(bars: readonly { t: number; forming?: boolean }[] | null | undefined, nowMs: number): { through: string | null; provisional: string | null; status: BarStatus } {
  if (!bars || !bars.length) return { through: null, provisional: null, status: 'missing' };
  const done = completedBars(bars, nowMs); const last = bars[bars.length - 1]; const st = barStatus(last, nowMs);
  const hm = `${new Date(nowMs + 19800000).toISOString().slice(11, 16)} IST`;
  return { through: done.length ? istDayOf(done[done.length - 1].t) : null, provisional: st === 'forming' ? `Provisional: ${istDayOf(last.t)} is still forming, observed ${hm}` : null, status: st };
}
/** When the state a view reports came from a bar that is still forming, the sentence that says so; otherwise null. The tracker's own rule is unchanged (a forming bar's low can stop a position and its high can fill a target;
 *  a forming bar never produces a time exit); this only LABELS the result so a provisional exit or fill is never read as a confirmed one. */
export function provisionalOf(v: { status: string; exitT?: number; ladder?: { t1T?: number; t2T?: number } | null }, bars: readonly { t: number; forming?: boolean }[] | null | undefined): string | null {
  const f = bars?.length ? bars[bars.length - 1] : null; if (!f?.forming) return null;
  if (v.status === 'closed' && v.exitT === f.t) return `Exit on a bar still forming (${istDayOf(f.t)}): provisional until that session closes.`;
  if (v.ladder && (v.ladder.t1T === f.t || v.ladder.t2T === f.t)) return `A target fill on a bar still forming (${istDayOf(f.t)}): provisional until that session closes.`;
  return null;
}
export const HISTORY_WARNING ='Where daily history is missing or incomplete the position is kept and priced from the live quote; only a confirmed stop, target or time exit closes it. A quote is not a fill.';
export const OPEN_TRADE_LABEL ='Open-trade P&L, includes booked partials';
export const COST_CONVENTION = 'Costs are allocated by shares: the shares already sold carry their part of the round-trip cost, the shares still held carry the rest, so the cost is charged once. Unrealised marks the shares still held at the observed price against the same fill, after the exit slippage the tracker assumes. R is the total over the original risk (fill minus the filed stop, times the original shares); it does not change after a partial exit.';
