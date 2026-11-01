// One mocked ledger and signals feed for the Book and Record suites and their screenshots (book.mjs, bookshots.mjs), so the pictures and the checks describe the same positions.
import { STATE, mockApi } from './fixtures.mjs';
import { lastFinishedSession } from '../src/calendar.ts';
export const last = lastFinishedSession(Date.now());
const P = (asOf, sym, o = {}) => ({ id: `${asOf}|MOM|${sym}`, engine: 'MOM', sym, asOf, ref: 100, stop: 95, horizon: 20, score: 90, rank: 1, sector: null, ...o });
// A: filed under the ladder, T1 on 30 Oct, T2 on the last completed session, closed at T2.  B: filed under the ladder, T1 then stopped at the fill.  C: filed before 27 Oct, stopped out: reference only.  D: still open.
export const A = P('2026-10-28', 'AAA'), B = P('2026-10-28', 'BBB'), C = P('2026-10-20', 'CCC'), D = P('2026-10-28', 'DDD', { ref: 200, stop: 190 });
export const outcomes = {
  [A.id]: { status: 'closed', final: true, entry: 100.1, entryDay: '2026-10-29', exit: 115.4, exitDay: last, reason: 'Target 2', r: 2.4, pct: 15.2, sessions: 4, niftyPct: 1, t1Hit: true, t1Day: '2026-10-30', t1Px: 107.75, t2Hit: true, t2Day: last, t2Px: 115.4, markDay: last },
  [B.id]: { status: 'closed', final: true, entry: 100.1, entryDay: '2026-10-29', exit: 100.1, exitDay: '2026-11-02', reason: 'Stop', r: 0.3, pct: 3.8, sessions: 3, niftyPct: 1, t1Hit: true, t1Day: '2026-10-30', t1Px: 107.75, t2Hit: false, markDay: last },
  [C.id]: { status: 'closed', final: true, entry: 100.1, entryDay: '2026-10-21', exit: 95, exitDay: '2026-10-26', reason: 'Stop', r: -1, pct: -5.1, sessions: 3, niftyPct: 0, markDay: last },
  [D.id]: { status: 'open', final: false, entry: 200.2, entryDay: '2026-10-29', mark: 205, markDay: last, r: 0.4, pct: 2.4 },
};
export const ledger = { schema: 'tripwire-ledger/1', started: '2026-10-20', updated: `${last}T20:00:00Z`, cost: 0.25, days: [{ asOf: '2026-10-20', recorded: 'x', engines: { MOM: { eligible: 700, passed: 9, picked: 1, skippedWideStop: 0 } } }, { asOf: '2026-10-28', recorded: 'x', engines: { MOM: { eligible: 700, passed: 9, picked: 3, skippedWideStop: 0 } } }, { asOf: last, recorded: 'x', engines: { MOM: { eligible: 700, passed: 0, picked: 0, skippedWideStop: 0 } } }], picks: [A, B, C, D], outcomes };
export const signals = { schema: 'tripwire-signals/1', generated: 'x', data_through: last, launched: '2026-10-23', gate: { date: last, on: false, passed: 1, checks: [{ rule: 'Holdout t at least +2.0', ok: false, value: 't = -0.62' }, { rule: 'At least 30 closed trades', ok: true }] }, alertable: false, alert_why: 'Alerts off: the holdout month-clustered t is -0.62, needs +2.0.', record: { closed: 0, avg_r: null }, signals: [], cost_round_trip_pct: 0.25 };
/** A browser context with the saved state, the shared API mocks, the ledger above (or `led`) and the signals feed. */
export async function openCtx(b, width, led = ledger) {
  const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, { ...STATE, paper: [] });
  await mockApi(ctx);
  await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ledger: led }) }));
  await ctx.route('**/data/signals.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(signals) }));
  return ctx;
}
