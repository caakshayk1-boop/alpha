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
import { lifecycleIdFor } from './lifecycle.ts';
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
  if (v.status !== 'open' || v.entry == null) return null;
  return splitOpen({ qty0, fill: v.entry, stop, qtyLeft: v.ladder ? v.ladder.qtyLeft : qty0, booked: v.ladder?.booked ?? 0, mark: v.mark, costPct });
}
export const OPEN_TRADE_LABEL = 'Open-trade P&L, includes booked partials';
export const COST_CONVENTION = 'Costs are allocated by shares: the shares already sold carry their part of the round-trip cost, the shares still held carry the rest, so the cost is charged once. Unrealised marks the shares still held at the observed price against the same fill, after the exit slippage the tracker assumes. R is the total over the original risk (fill minus the filed stop, times the original shares); it does not change after a partial exit.';
