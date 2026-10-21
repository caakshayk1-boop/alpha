/** The Trades page: every engine signal that has been entered, marked through the day, and the decision its rules give for
 *  the next session. Built on lib/positions.ts (the exit rule, reproduced from engines/common.py walk) and lib/price.ts.
 *
 *  Three things are computed here, all pure and tested in tests/lib.test.ts:
 *    - dayR(): how much of a trade's marked R came from the latest session (from the previous close, or from the entry when the
 *      trade was entered at that session's open).
 *    - bookCurve(): the open book's day R at every five-minute bar of the session (/api/intraday), so the P&L across the day is
 *      drawn from the exchange's own bars, not only from the moment the page was opened.
 *    - decide(): the next-session decision for each signal: enter, exit, modify (sell a third and move the stop), hold, or the
 *      ones the evening run closed or voided on the latest session.
 *  Nothing here is a fill or advice. Alpha places no order. */
import type { Position } from './positions.ts';
import { sessionLabel } from './price.ts';

const SPLIT = 1 / 3;
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const money = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface TradeSignal {
  id: string; sym: string; status: 'pending' | 'open' | 'closed' | 'void';
  date: string; ref_price: number; sl: number; targets: number[];
  entry?: number | null; entry_date?: string | null;
  events: { date: string; kind: string; price: number; fraction: number }[];
  closed_date?: string | null; exit_reason?: string | null; r_net?: number | null; void_reason?: string | null;
}

/** The trade's R at the close BEFORE `session`: booked thirds dated before it plus the rest at `prevClose`. 0 when the trade was
 *  entered on `session` or later (it held nothing at that close). null when it cannot be known. */
export function rAtPrevClose(s: TradeSignal, session: string, prevClose: number | null | undefined): number | null {
  if (!ok(s.entry) || !s.entry_date) return null;
  if (s.entry_date >= session) return 0;
  const risk = s.entry - s.sl;
  if (!(risk > 0) || !ok(prevClose)) return null;
  const before = s.events.filter((e) => /^t[123]$/.test(e.kind) && e.date < session);
  const realised = before.reduce((a, e) => a + SPLIT * (e.price - s.entry!), 0);
  const remaining = Math.max(0, 1 - SPLIT * before.length);
  return (realised + remaining * (prevClose - s.entry)) / risk;
}

/** R made on `session`: the marked R now minus the R at the previous close. */
export function dayR(s: TradeSignal, pos: Pick<Position, 'r' | 'session'>, prevClose: number | null | undefined): number | null {
  if (!ok(pos.r) || !pos.session) return null;
  const before = rAtPrevClose(s, pos.session, prevClose);
  return before === null ? null : pos.r - before;
}

export interface Intraday { prev: number; t: number[]; c: number[] }
export interface CurvePoint { t: number; r: number; n: number }

/** The book's R made today at each five-minute bar. Each trade contributes remaining x (close_t - base) / risk, where base is the
 *  previous close (held overnight) or the entry (entered at today's open, so it contributes from the first bar). Between a
 *  stock's bars its last close carries forward; before its first bar it contributes nothing. `n` = trades priced at t. */
export function bookCurve(trades: { s: TradeSignal; session: string }[], bars: Record<string, Intraday | undefined>): CurvePoint[] {
  const legs = trades.flatMap(({ s, session }) => {
    const b = bars[s.sym];
    if (!b || !ok(s.entry) || !s.entry_date || !b.t.length) return [];
    const risk = s.entry - s.sl;
    if (!(risk > 0)) return [];
    const heldOvernight = s.entry_date < session;
    const booked = s.events.filter((e) => /^t[123]$/.test(e.kind) && e.date < session).length;
    const remaining = Math.max(0, 1 - SPLIT * booked);
    return [{ b, base: heldOvernight ? b.prev : s.entry, remaining, risk }];
  });
  const grid = Array.from(new Set(legs.flatMap((l) => l.b.t))).sort((a, z) => a - z);
  const idx = legs.map(() => -1);
  return grid.map((t) => {
    let r = 0, n = 0;
    legs.forEach((l, k) => {
      while (idx[k] + 1 < l.b.t.length && l.b.t[idx[k] + 1] <= t) idx[k]++;
      if (idx[k] < 0) return;
      r += (l.remaining * (l.b.c[idx[k]] - l.base)) / l.risk;
      n++;
    });
    return { t, r: Math.round(r * 1000) / 1000, n };
  });
}

export type DecisionKind = 'enter' | 'exit' | 'modify' | 'hold' | 'closed' | 'void';
export interface Decision { kind: DecisionKind; id: string; sym: string; headline: string; detail: string }
export const DECISION_ORDER: DecisionKind[] = ['exit', 'modify', 'enter', 'hold', 'closed', 'void'];
export const DECISION_TEXT: Record<DecisionKind, string> = { exit: 'Exit', modify: 'Modify', enter: 'Enter', hold: 'Hold', closed: 'Closed', void: 'Skipped' };

const EXIT_TEXT: Record<string, string> = { stop: 'stopped out', stop_after_t1: 'stopped at entry after T1', stop_after_t2: 'stopped at T1 after T2', t3: 'all three targets reached', time: 'time limit', all_targets: 'all three targets reached' };

/** The decision for the session after `session`, from the plan's rules at the latest price (`pos`, lib/positions.ts) and what the
 *  evening run booked on `session` (events, closed_date). */
export function decide(s: TradeSignal, pos: Position, session: string | null): Decision | null {
  const base = { id: s.id, sym: s.sym };
  if (s.status === 'closed') {
    if (!session || s.closed_date !== session) return null;
    return { ...base, kind: 'closed', headline: `Closed: ${EXIT_TEXT[s.exit_reason ?? ''] ?? s.exit_reason ?? 'by the rules'}`, detail: ok(s.r_net) ? `${s.r_net > 0 ? '+' : s.r_net < 0 ? '−' : ''}${Math.abs(s.r_net).toFixed(2)}R after costs. Nothing left to do.` : 'Nothing left to do.' };
  }
  if (s.status === 'void') {
    const when = s.entry_date ?? s.date;
    if (!session || when < session) return null;
    return { ...base, kind: 'void', headline: 'Entry skipped', detail: `The ${sessionLabel(when)} open was already past T1 or at/below the stop, so the plan never entered.` };
  }
  if (s.status === 'pending' || pos.state === 'awaiting-entry') {
    return { ...base, kind: 'enter', headline: `Buy at the next open`, detail: `Skip it if the open is at/above T1 ${money(s.targets[0])} or at/below the stop ${money(s.sl)}. Stop ${money(s.sl)}; targets ${s.targets.map(money).join(', ')}, one third at each.` };
  }
  const thirds = pos.remaining > 0.99 ? 'all of it' : pos.remaining > 0.6 ? 'the remaining two thirds' : 'the last third';
  switch (pos.state) {
    case 'stop-hit':
      return { ...base, kind: 'exit', headline: `Sell ${thirds}: stop ${money(pos.stop)} reached`, detail: `Price ${money(pos.price ?? pos.stop)} is at or below the stop. The plan is out at the stop, or at the open if it gapped below.` };
    case 'all-targets':
      return { ...base, kind: 'exit', headline: `Sell the last third: T3 ${money(s.targets[2])} reached`, detail: 'The trade ends with all three targets.' };
    case 'time-due':
    case 'time-passed':
      return { ...base, kind: 'exit', headline: `Sell ${thirds}: time limit`, detail: pos.timeDue ? `The time limit is the ${sessionLabel(pos.timeDue)} close.` : 'The time limit has been reached.' };
    case 'target-hit': {
      const next = pos.reachedNow >= 3 ? null : `T${pos.reachedNow + 1} ${money(s.targets[pos.reachedNow])}`;
      return { ...base, kind: 'modify', headline: `Sell a third at T${pos.reachedNow}; move the stop to ${money(pos.stop)}`, detail: `T${pos.reachedNow} ${money(s.targets[pos.reachedNow - 1])} reached at the latest price.${next ? ` Next target ${next}.` : ''}` };
    }
    default: {
      const bookedToday = session ? s.events.filter((e) => e.date === session && /^t[12]$/.test(e.kind)) : [];
      if (bookedToday.length) {
        const k = bookedToday[bookedToday.length - 1].kind;
        return { ...base, kind: 'modify', headline: `Move the stop to ${money(pos.stop)}`, detail: `${k.toUpperCase()} was booked on ${sessionLabel(session)}: one third sold, the stop on the rest now ${k === 't1' ? 'sits at the entry' : 'sits at T1'}.` };
      }
      if (session && s.entry_date === session) {
        return { ...base, kind: 'modify', headline: `Entered at ${money(s.entry!)}: place the stop at ${money(pos.stop)}`, detail: `${pos.toNext ? `First target ${pos.toNext.label} ${money(pos.toNext.price)}. ` : ''}${pos.timeDue ? `Time limit: the ${sessionLabel(pos.timeDue)} close.` : ''}`.trim() };
      }
      return { ...base, kind: 'hold', headline: `Hold ${thirds}`, detail: `Stop ${money(pos.stop)}${pos.toNext ? `, next ${pos.toNext.label} ${money(pos.toNext.price)}` : ''}${pos.timeDue ? `; time limit the ${sessionLabel(pos.timeDue)} close` : ''}. No change.` };
    }
  }
}

/** Decisions grouped in DECISION_ORDER, each group sorted by symbol. */
export function groupDecisions(ds: (Decision | null)[]): { kind: DecisionKind; items: Decision[] }[] {
  const by = new Map<DecisionKind, Decision[]>();
  for (const d of ds) if (d) by.set(d.kind, [...(by.get(d.kind) ?? []), d]);
  return DECISION_ORDER.filter((k) => by.has(k)).map((k) => ({ kind: k, items: by.get(k)!.sort((a, b) => a.sym.localeCompare(b.sym)) }));
}
