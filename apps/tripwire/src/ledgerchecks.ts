/** Build-time assertions for the nightly ledger job. The job has two stages that must describe the same market: the PICK stage (a night's picks, written from the published
 *  screen, stamped with the screen's data day) and the OUTCOME stage (every unfinished pick replayed against daily bars fetched separately). Between 28 and 31 Oct 2026 the
 *  outcome stage ran a session behind the pick stage for three nights running (picks of 29 Oct, marks of 28 Oct; three ECLERX stops of 29 Oct still "open") and nothing said so:
 *  a symbol whose newest bar was missing simply kept its old outcome. These checks turn that into a red run with one line per fault.
 *
 *  Everything here is pure: the caller supplies the ledger, the clock and (for check c) the bars it replayed. */
import { lastFinishedSession, nextSession, sessionsBetween } from './calendar.ts';
import { rebase, type Bar, type Paper } from './tracker.ts';
import { takenAtFor, type Ledger } from './ledger.ts';

export interface Violation { check: 'a' | 'b' | 'c'; id: string; message: string }
const istDay = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
const live = (l: Ledger) => l.picks.filter((p) => !l.voided?.[p.id]);

/** The newest session each stage reached. `pick` is the last night recorded; `marked` is the newest bar day any outcome was replayed against. */
export function stageSessions(l: Ledger): { pick: string | null; marked: string | null } {
  const pick = l.days.length ? l.days.reduce((m, d) => (d.asOf > m ? d.asOf : m), l.days[0].asOf) : null;
  let marked: string | null = null;
  for (const p of live(l)) { const d = l.outcomes[p.id]?.markDay; if (d && (!marked || d > marked)) marked = d; }
  return { pick, marked };
}

/** (a) The two stages reached the same session. The pick stage is the last night recorded (P); the outcome stage is the newest bar day an outcome was replayed against (M). They must be equal.
 *  The one legitimate gap between "a pick exists" and "its outcome moved" is NOT a gap here: a pick of the latest night is `pending` until the next open, but it is still replayed against
 *  the bar of its own signal day, so its markDay is P. A pending pick that has no bar at all does not count towards M (it is caught by (b)). */
export function checkStagesAgree(l: Ledger): Violation[] {
  const { pick, marked } = stageSessions(l);
  if (!pick) return [];
  /* Only unfinished picks are replayed. When every live pick is final (or none exist) the outcome stage has nothing to advance, so a quiet night is not a fault. */
  if (!live(l).some((p) => { const o = l.outcomes[p.id]; return !o || !o.final; })) return [];
  if (!marked) return [{ check: 'a', id: 'stages', message: `the pick stage reached ${pick} but no outcome was replayed against any bar` }];
  if (marked === pick) return [];
  return [{ check: 'a', id: 'stages', message: marked < pick ? `the outcome stage is behind the pick stage: picks are written through ${pick}, outcomes were marked only through ${marked}` : `the outcome stage is ahead of the pick stage: outcomes were marked through ${marked}, the last night recorded is ${pick} (the screen is stale)` }];
}

/** (b) No open position is marked older than the newest completed NSE session, and no pick is still `pending` once the session it should have entered on has finished.
 *  A pick of the latest night is allowed to be pending: its entry session is the next one, which has not finished. */
export function checkMarksCurrent(l: Ledger, nowMs: number): Violation[] {
  const last = lastFinishedSession(nowMs); const out: Violation[] = [];
  for (const p of live(l)) {
    const o = l.outcomes[p.id];
    if (!o) { out.push({ check: 'b', id: p.id, message: `${p.id} has no outcome` }); continue; }
    if (o.final) continue;
    if (o.status === 'open') {
      if (!o.markDay) out.push({ check: 'b', id: p.id, message: `${p.id} is open but its mark has no session date` });
      else if (o.markDay < last) out.push({ check: 'b', id: p.id, message: `${p.id} is open and marked through ${o.markDay}, but the last completed session is ${last} (${sessionsBetween(o.markDay, last)} behind)` });
    } else if (o.status === 'pending' && nextSession(p.asOf) <= last) {
      out.push({ check: 'b', id: p.id, message: `${p.id} is still pending although its entry session ${nextSession(p.asOf)} has finished (last completed session ${last}); marked through ${o.markDay ?? 'no bar'}` });
    }
  }
  return out;
}

/** (c) A closed outcome must not contradict the bars it was replayed from: no bar between its entry and its recorded exit may have crossed the stop (the original stop, on the bars' own
 *  price basis; every rule this app has used only ever moves a stop UP, so a bar through the original stop ends the trade under all of them). `bars` is what the run fetched; a
 *  symbol with no bars is not checked. */
export function checkFinalsAgainstBars(l: Ledger, bars: Record<string, readonly Bar[] | null>): Violation[] {
  const out: Violation[] = [];
  for (const p of live(l)) {
    const o = l.outcomes[p.id]; const b = bars[p.sym];
    if (!o || o.status !== 'closed' || !o.entryDay || !o.exitDay || !b || !b.length) continue;
    const paper: Paper = { id: p.id, sym: p.sym, engine: p.engine, asOf: p.asOf, ref: p.ref, stop: p.stop, horizon: p.horizon, qty: 100, takenAt: takenAtFor(p.asOf) };
    const stop = rebase(paper, b).p.stop;
    for (const x of b) {
      const d = istDay(x.t); if (d < o.entryDay || d >= o.exitDay) continue;
      if (x.l <= stop || (d > o.entryDay && x.o <= stop)) { out.push({ check: 'c', id: p.id, message: `${p.id} is recorded as closed on ${o.exitDay} (${o.reason ?? 'no reason'}) but the bar of ${d} traded through its stop ${stop} (low ${x.l}, open ${x.o})` }); break; }
    }
  }
  return out;
}

export function runChecks(l: Ledger, bars: Record<string, readonly Bar[] | null>, nowMs: number): Violation[] {
  return [...checkStagesAgree(l), ...checkMarksCurrent(l, nowMs), ...checkFinalsAgainstBars(l, bars)];
}
/** One log line per fault, ready for a CI log. */
export const formatViolations = (vs: readonly Violation[]): string[] => vs.map((v) => `CHECK ${v.check.toUpperCase()} FAILED: ${v.message}`);

/** For any other job that stamps a data day (the screen builder, for one): how many completed NSE sessions lie between `asOf` and the last one. 0 is current; null for an unreadable date. */
export function sessionLag(asOf: string, nowMs: number): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null; const last = lastFinishedSession(nowMs);
  if (asOf > last) return null; return asOf === last ? 0 : sessionsBetween(asOf, last);
}
