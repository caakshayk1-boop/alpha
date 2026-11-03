/** The forward ledger: every pick every engine makes, every night, whether or not anyone took it. This is the only unbiased record:
 *  the engines' thresholds were chosen with no backtest, so what counts is what happens AFTER a pick is written down.
 *  Append-only. A night is recorded once; picks are never edited, and a stale data day is refused. Outcomes are replayed from real
 *  daily bars with the same rules the in-app tracker uses (`evaluatePaper`), so the two can never disagree. */
import type { Bar, Paper } from './tracker.ts';
import { ENGINES, type Run } from './quant.ts';
import { targetsFor } from './exits.ts';
import { rulesFor } from './rules.ts';
import { outcomeView, preservePosition } from './positionstate.ts';

export interface LedgerPick { id: string; engine: string; sym: string; asOf: string; ref: number; stop: number; horizon: number; score: number; rank: number; sector?: string | null; targets?: import('./tracker.ts').PaperTargets | null; agreement?: import('./agreement.ts').Agreement }
export interface Outcome { status: 'pending' | 'open' | 'closed' | 'skipped' | 'void'; final: boolean; entry?: number; entryDay?: string; exit?: number; exitDay?: string; reason?: string; r?: number | null; pct?: number | null; sessions?: number; mark?: number; niftyPct?: number | null; skipReason?: string; /** the profit ladder, when the pick traded under one */ t1Hit?: boolean; t2Hit?: boolean; /** the session (India date) and the price at which each target filled */ t1Day?: string; t1Px?: number; t2Day?: string; t2Px?: number; /** the India date of the last daily bar this outcome was replayed against: the session the outcome stage reached (absent on outcomes written before this field) */ markDay?: string }
export interface Day { asOf: string; recorded: string; /** the eligibility rule version this night was written under; absent on nights written before versions existed (those are elig-1) */ rules?: string; engines: Record<string, { eligible: number; passed: number; picked: number; skippedWideStop: number }> }
export interface Ledger { schema: 'tripwire-ledger/1'; started: string; updated: string; cost: number; days: Day[]; picks: LedgerPick[]; outcomes: Record<string, Outcome>;
  transitions?: { id: string; at: string; from: string; to: string; reason: string }[];
  /** picks struck from the record, with the reason. A pick is never deleted or edited: it is voided in the open and left out of every total. */
  voided?: Record<string, string> }
export interface Correction { engine: string; asOf: string; reason: string }
export const MIN_TRADES = 30;

export const emptyLedger = (now: string, cost = 0.25): Ledger => ({ schema: 'tripwire-ledger/1', started: now.slice(0, 10), updated: now, cost, days: [], picks: [], outcomes: {} });
export const pickId = (asOf: string, engine: string, sym: string) => `${asOf}|${engine}|${sym}`;

/** Record one night's picks. Idempotent per data day; refuses a day older than the newest recorded one (the data did not move). */
export function record(l: Ledger, runs: readonly Run[], asOf: string, now: string): { ledger: Ledger; added: number; skipped: null | 'already recorded' | 'stale data' } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return { ledger: l, added: 0, skipped: 'stale data' };
  if (l.days.some((d) => d.asOf === asOf)) return { ledger: l, added: 0, skipped: 'already recorded' };
  if (l.days.length && asOf < l.days[l.days.length - 1].asOf) return { ledger: l, added: 0, skipped: 'stale data' };
  const picks: LedgerPick[] = runs.flatMap((r) => r.picks.map((p) => ({ id: pickId(asOf, p.engine, p.sym), engine: p.engine, sym: p.sym, asOf, ref: p.ref, stop: p.stop, horizon: p.horizon, score: p.score, rank: p.rank, sector: p.sector ?? null, targets: targetsFor(p), ...(p.agreement ? { agreement: p.agreement } : {}) })));
  const engines: Day['engines'] = {}; for (const r of runs) engines[r.id] = { eligible: r.funnel.eligible, passed: r.funnel.passed, picked: r.funnel.picked, skippedWideStop: r.funnel.skippedWideStop };
  return { ledger: { ...l, updated: now, days: [...l.days, { asOf, recorded: now, rules: runs[0]?.rules ?? rulesFor(asOf), engines }], picks: [...l.picks, ...picks], transitions: [...(l.transitions ?? []), ...picks.map((p) => ({ id: p.id, at: now, from: 'candidate', to: 'pending', reason: 'Entry qualification passed; fixed stop, horizon and targets recorded' }))] }, added: picks.length, skipped: null };
}
/** Void the picks a correction names. Idempotent; nothing is removed, and the reason is kept beside the pick. */
export function applyCorrections(l: Ledger, fixes: readonly Correction[]): Ledger {
  const voided = { ...(l.voided ?? {}) }; let added = false;
  for (const f of fixes) for (const p of l.picks) if (p.engine === f.engine && p.asOf === f.asOf && !voided[p.id]) { voided[p.id] = f.reason; added = true; }
  return added ? { ...l, voided } : l;
}
/** The moment a pick could first be acted on: the close of its data day, 15:30 India time (10:00 UTC). */
export const takenAtFor = (asOf: string): number => { const [y, m, d] = asOf.split('-').map(Number); return Date.UTC(y, m - 1, d, 10, 0) / 1000; };
const dayKey = (t: number) => Math.floor((t + 19800) / 86400);
const isoOf = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);

/** Replay every pick that is not final. `bars` has a key per symbol it could fetch; a missing symbol leaves its pick untouched, never zero. */
export function evaluateLedger(l: Ledger, bars: Record<string, Bar[] | null>, nifty: Bar[] | null, now: string): Ledger {
  const outcomes = { ...l.outcomes };
  const transitions = [...(l.transitions ?? [])];
  for (const p of l.picks) {
    if (l.voided?.[p.id]) continue;                       // struck from the record: never replayed, and voidOutcomes() below leaves it with no live outcome
    if (outcomes[p.id]?.final) continue;
    const b = bars[p.sym]; if (!b) { outcomes[p.id] = outcomes[p.id] ?? { status: 'pending', final: false }; continue; }
    const paper: Paper = { id: p.id, sym: p.sym, engine: p.engine, asOf: p.asOf, ref: p.ref, stop: p.stop, horizon: p.horizon, qty: 100, takenAt: takenAtFor(p.asOf), targets: targetsFor(p) };
    const previous = outcomes[p.id];
    const v = preservePosition(paper, b, null, l.cost, outcomeView(paper, previous));
    if (v.dataNote) continue;
    const markDay = b.length ? isoOf(b[b.length - 1].t) : undefined;
    const o: Outcome = { status: v.status === 'waiting' || v.status === 'pending' ? 'pending' : v.status, final: v.status === 'closed' || v.status === 'skipped' };
    if (markDay) o.markDay = markDay;
    if (v.status === 'skipped') o.skipReason = v.skipReason;
    if (v.ladder) { o.t1Hit = v.ladder.t1Hit; o.t2Hit = v.ladder.t2Hit; if (v.ladder.t1T != null) { o.t1Day = isoOf(v.ladder.t1T); o.t1Px = v.ladder.t1Px; } if (v.ladder.t2T != null) { o.t2Day = isoOf(v.ladder.t2T); o.t2Px = v.ladder.t2Px; } }
    if (v.status === 'open' || v.status === 'closed') {
      Object.assign(o, { entry: v.entry, entryDay: isoOf(v.entryT!), sessions: v.sessions, r: v.r, pct: v.pct });
      if (v.status === 'closed') Object.assign(o, { exit: v.exit, exitDay: isoOf(v.exitT!), reason: v.reason }); else o.mark = v.mark ?? undefined;
      // the Nifty over the same days: from the open of the entry day to the close of the exit day (or the latest close while open)
      if (nifty && nifty.length) {
        const eb = nifty.find((x) => dayKey(x.t) === dayKey(v.entryT!));
        const xb = v.status === 'closed' ? nifty.find((x) => dayKey(x.t) === dayKey(v.exitT!)) : nifty[nifty.length - 1];
        o.niftyPct = eb && xb && eb.o > 0 ? Math.round(((xb.c / eb.o) - 1) * 10000) / 100 : null;
      }
    }
    if ((!previous || previous.status === 'pending') && ['open', 'closed'].includes(o.status)) transitions.push({ id: p.id, at: now, from: 'pending', to: 'open', reason: `Confirmed next-session entry on ${o.entryDay}` });
    if (o.t1Hit && !previous?.t1Hit) transitions.push({ id: p.id, at: now, from: 'open', to: 'partial', reason: `Target 1 filled on ${o.t1Day}; stop moved to the entry price` });
    if ((previous?.status ?? 'pending') !== o.status && o.status !== 'open') transitions.push({ id: p.id, at: now, from: o.status === 'closed' ? 'open' : previous?.status ?? 'pending', to: o.status, reason: o.reason ?? o.skipReason ?? 'Explicit entry rule' });
    outcomes[p.id] = o;
  }
  return voidOutcomes({ ...l, updated: now, outcomes, transitions });
}
/** A voided pick carries NO outcome: status 'void', final, and none of the live fields (entry, mark, r, pct, ladder). It was struck from the record, so a price, a mark or an R beside it would read as a live result.
 *  Applied by the writer (evaluateLedger) and again by the reader (useLedger), so a file written before this rule is also served clean. Idempotent; a pick that is not voided is untouched. */
export function voidOutcomes(l: Ledger): Ledger {
  const ids = Object.keys(l.voided ?? {}).filter((id) => l.outcomes[id]?.status !== 'void' && (l.outcomes[id] || l.picks.some((p) => p.id === id)));
  if (!ids.length) return l;
  const outcomes = { ...l.outcomes }; for (const id of ids) outcomes[id] = { status: 'void', final: true };
  return { ...l, outcomes };
}
/** An engine that has been retired is not part of any total or list shown to the reader; its rows stay in the stored record. */
export const RETIRED = new Set(ENGINES.filter((e) => e.retired).map((e) => e.id as string));
export interface EngineRecord { engine: string; days: number; picks: number; closed: number; open: number; skipped: number; pending: number; totalR: number; avgR: number | null; winRate: number | null; avgExcess: number | null; enough: boolean }
export function summarizeLedger(l: Ledger): { all: EngineRecord; engines: EngineRecord[]; first: string | null; last: string | null } {
  const one = (engine: string | null): EngineRecord => {
    const ps = l.picks.filter((p) => (!engine || p.engine === engine) && !l.voided?.[p.id] && !RETIRED.has(p.engine)); const os = ps.map((p) => l.outcomes[p.id]).filter(Boolean);
    const closed = os.filter((o) => o.status === 'closed' && typeof o.r === 'number'); const totalR = closed.reduce((s, o) => s + o.r!, 0);
    const ex = closed.filter((o) => typeof o.pct === 'number' && typeof o.niftyPct === 'number'); const enough = closed.length >= MIN_TRADES;
    return { engine: engine ?? 'ALL', days: l.days.length, picks: ps.length, closed: closed.length, open: os.filter((o) => o.status === 'open').length, skipped: os.filter((o) => o.status === 'skipped').length,
      pending: ps.length - os.filter((o) => o.status !== 'pending').length,
      totalR: Math.round(totalR * 100) / 100, avgR: enough ? Math.round((totalR / closed.length) * 100) / 100 : null, winRate: enough ? Math.round((closed.filter((o) => o.r! > 0).length / closed.length) * 100) : null,
      avgExcess: ex.length >= MIN_TRADES ? Math.round((ex.reduce((s, o) => s + (o.pct! - o.niftyPct!), 0) / ex.length) * 100) / 100 : null, enough };
  };
  return { all: one(null), engines: ENGINES.filter((e) => !e.retired).map((e) => e.id as string).map(one), first: l.days[0]?.asOf ?? null, last: l.days[l.days.length - 1]?.asOf ?? null };
}
