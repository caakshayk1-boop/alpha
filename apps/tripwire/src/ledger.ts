/** The forward ledger: every pick every engine makes, every night, whether or not anyone took it. This is the only unbiased record:
 *  the engines' thresholds were chosen with no backtest, so what counts is what happens AFTER a pick is written down.
 *  Append-only. A night is recorded once; picks are never edited, and a stale data day is refused. Outcomes are replayed from real
 *  daily bars with the same rules the in-app tracker uses (`evaluatePaper`), so the two can never disagree. */
import { evaluatePaper, type Bar, type Paper } from './tracker.ts';
import type { Run } from './quant.ts';
import { targetsFor } from './exits.ts';

export interface LedgerPick { id: string; engine: string; sym: string; asOf: string; ref: number; stop: number; horizon: number; score: number; rank: number; sector?: string | null }
export interface Outcome { status: 'pending' | 'open' | 'closed' | 'skipped'; final: boolean; entry?: number; entryDay?: string; exit?: number; exitDay?: string; reason?: string; r?: number | null; pct?: number | null; sessions?: number; mark?: number; niftyPct?: number | null; skipReason?: string; /** the profit ladder, when the pick traded under one */ t1Hit?: boolean; t2Hit?: boolean }
export interface Day { asOf: string; recorded: string; engines: Record<string, { eligible: number; passed: number; picked: number; skippedWideStop: number }> }
export interface Ledger { schema: 'tripwire-ledger/1'; started: string; updated: string; cost: number; days: Day[]; picks: LedgerPick[]; outcomes: Record<string, Outcome>;
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
  const picks: LedgerPick[] = runs.flatMap((r) => r.picks.map((p) => ({ id: pickId(asOf, p.engine, p.sym), engine: p.engine, sym: p.sym, asOf, ref: p.ref, stop: p.stop, horizon: p.horizon, score: p.score, rank: p.rank, sector: p.sector ?? null })));
  const engines: Day['engines'] = {}; for (const r of runs) engines[r.id] = { eligible: r.funnel.eligible, passed: r.funnel.passed, picked: r.funnel.picked, skippedWideStop: r.funnel.skippedWideStop };
  return { ledger: { ...l, updated: now, days: [...l.days, { asOf, recorded: now, engines }], picks: [...l.picks, ...picks] }, added: picks.length, skipped: null };
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
  for (const p of l.picks) {
    if (outcomes[p.id]?.final) continue;
    const b = bars[p.sym]; if (!b) { outcomes[p.id] = outcomes[p.id] ?? { status: 'pending', final: false }; continue; }
    const paper: Paper = { id: p.id, sym: p.sym, engine: p.engine, asOf: p.asOf, ref: p.ref, stop: p.stop, horizon: p.horizon, qty: 100, takenAt: takenAtFor(p.asOf), targets: targetsFor(p) };
    const v = evaluatePaper(paper, b, null, l.cost);
    const o: Outcome = { status: v.status === 'waiting' || v.status === 'pending' ? 'pending' : v.status, final: v.status === 'closed' || v.status === 'skipped' };
    if (v.status === 'skipped') o.skipReason = v.skipReason;
    if (v.ladder) { o.t1Hit = v.ladder.t1Hit; o.t2Hit = v.ladder.t2Hit; }
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
    outcomes[p.id] = o;
  }
  return { ...l, updated: now, outcomes };
}
export interface EngineRecord { engine: string; days: number; picks: number; closed: number; open: number; skipped: number; pending: number; totalR: number; avgR: number | null; winRate: number | null; avgExcess: number | null; enough: boolean }
export function summarizeLedger(l: Ledger): { all: EngineRecord; engines: EngineRecord[]; first: string | null; last: string | null } {
  const one = (engine: string | null): EngineRecord => {
    const ps = l.picks.filter((p) => (!engine || p.engine === engine) && !l.voided?.[p.id]); const os = ps.map((p) => l.outcomes[p.id]).filter(Boolean);
    const closed = os.filter((o) => o.status === 'closed' && typeof o.r === 'number'); const totalR = closed.reduce((s, o) => s + o.r!, 0);
    const ex = closed.filter((o) => typeof o.pct === 'number' && typeof o.niftyPct === 'number'); const enough = closed.length >= MIN_TRADES;
    return { engine: engine ?? 'ALL', days: l.days.length, picks: ps.length, closed: closed.length, open: os.filter((o) => o.status === 'open').length, skipped: os.filter((o) => o.status === 'skipped').length,
      pending: ps.length - os.filter((o) => o.status !== 'pending').length,
      totalR: Math.round(totalR * 100) / 100, avgR: enough ? Math.round((totalR / closed.length) * 100) / 100 : null, winRate: enough ? Math.round((closed.filter((o) => o.r! > 0).length / closed.length) * 100) : null,
      avgExcess: ex.length >= MIN_TRADES ? Math.round((ex.reduce((s, o) => s + (o.pct! - o.niftyPct!), 0) / ex.length) * 100) / 100 : null, enough };
  };
  return { all: one(null), engines: ['MOM', 'QLT', 'LVT'].map(one), first: l.days[0]?.asOf ?? null, last: l.days[l.days.length - 1]?.asOf ?? null };
}
