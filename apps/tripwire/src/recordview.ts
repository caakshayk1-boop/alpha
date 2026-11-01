/** What the one Record screen shows, worked out from the forward ledger alone. Pure: no React, no clock of its own (the caller passes `nowMs`), so it is unit-tested.
 *
 *  ONE record. The forward ledger (every pick every engine writes, whether or not anyone took it) is the population; the paper book is a subset of it with rupee sizes. Each closed trade
 *  therefore appears once, and its rupee P&L is attached where the book took it. The totals here ARE `summarizeLedger`'s, not a second count: a number that exists in two places
 *  can disagree, and that disagreement (a Signals "record" of 0 beside 31 open positions) is the fault this screen exists to remove.
 *  Voided picks and retired engines are out of every figure, exactly as in `summarizeLedger`. A closed outcome is displayed, never rewritten. */
import type { Ledger, LedgerPick, Outcome } from './ledger.ts';
import { RETIRED, summarizeLedger, MIN_TRADES } from './ledger.ts';
import { stageSessions } from './ledgerchecks.ts';
import { statusOf, throughWord, type Status } from './freshness.ts';
import { STYLES } from './exits.ts';
import { sessionsBetween } from './calendar.ts';
import type { View } from './tracker.ts';

export interface ThroughLabel { day: string | null; word: string; status: Status; behind: number | null }
export interface Through { picks: ThroughLabel; outcomes: ThroughLabel; /** the two stages reached the same session */ agree: boolean; /** sessions the outcomes trail the picks by, when they do */ lag: number | null }
const label = (day: string | null, nowMs: number): ThroughLabel => { const s = statusOf(day, nowMs); return { day, word: day ? throughWord(day) : 'not yet', status: s.status, behind: s.behind }; };
/** "Picks through" is the last night written; "outcomes through" is the newest bar day any outcome was replayed against. Both from the ledger's own fields, judged by the one freshness module. */
export function throughOf(l: Ledger, nowMs: number): Through {
  const { pick, marked } = stageSessions(l);
  return { picks: label(pick, nowMs), outcomes: label(marked, nowMs), agree: pick === marked, lag: pick && marked && marked < pick ? sessionsBetween(marked, pick) : null };
}

export interface ClosedItem { pick: LedgerPick; outcome: Outcome }
/** Closed, counted trades, newest exit first. Voided picks and retired engines are not here. */
export function closedItems(l: Ledger): ClosedItem[] {
  return l.picks.filter((p) => !l.voided?.[p.id] && !RETIRED.has(p.engine)).map((pick) => ({ pick, outcome: l.outcomes[pick.id] }))
    .filter((x): x is ClosedItem => !!x.outcome && x.outcome.status === 'closed' && typeof x.outcome.r === 'number')
    .sort((a, b) => (b.outcome.exitDay ?? '').localeCompare(a.outcome.exitDay ?? '') || a.pick.id.localeCompare(b.pick.id));
}

export interface RecordFigures {
  closed: number; wins: number;
  /** null until 30 trades have closed: fewer says nothing */
  winRate: number | null; avgR: number | null;
  /** null when nothing has closed (a sum of nothing is not zero) */
  totalR: number | null;
  open: number; skipped: number; pending: number; picks: number; nights: number; first: string | null; last: string | null; enough: boolean; needed: number;
}
export function figuresOf(l: Ledger): RecordFigures {
  const s = summarizeLedger(l); const a = s.all; const wins = closedItems(l).filter((x) => x.outcome.r! > 0).length;
  return { closed: a.closed, wins, winRate: a.winRate, avgR: a.avgR, totalR: a.closed ? a.totalR : null, open: a.open, skipped: a.skipped, pending: a.pending, picks: a.picks, nights: l.days.length, first: s.first, last: s.last, enough: a.enough, needed: MIN_TRADES };
}

/** A closed outcome in the shape the position card reads. `qty` is the paper book's share count when it took the pick; without it there is no rupee P&L, only R. */
export function viewOfClosed(pick: LedgerPick, o: Outcome, qty: number | null, pnl: number | null): View {
  const t = (d?: string) => (d ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 10, 0) / 1000 : undefined);
  return { id: pick.id, status: 'closed', entry: o.entry, entryT: t(o.entryDay), exit: o.exit, exitT: t(o.exitDay), reason: o.reason, sessions: o.sessions ?? 0, left: 0, mark: o.exit ?? null, markKind: 'close', pnl: qty == null ? null : pnl, r: o.r ?? null, pct: o.pct ?? null };
}

/** The one definition of R and of the two targets, in words, from the style table that books them (exits.ts), so the sentence cannot differ from the rule. */
export function definitionLines(): { r: string; targets: string } {
  return {
    r: 'R is the risk actually taken: the fill (the next open plus slippage) minus the stop. A result in R is the P&L divided by that risk.',
    targets: `T1 is the fill plus ${STYLES.map((s) => `${s.t1}R`).join(' / ')} and T2 is the fill plus ${STYLES.map((s) => `${s.t2}R`).join(' / ')} (${STYLES.map((s) => s.label.toLowerCase()).join(' / ')}). At T1 half is sold and the stop moves to the fill; at T2 the rest is sold.`,
  };
}
