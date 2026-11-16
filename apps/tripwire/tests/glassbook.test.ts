// 15 Nov 2026 (Tripwire 4.0): F1 timeline + trace, F2 sit-out log, F3 scoreboard. Each figure is recomputed by hand here, not by the module under test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLedger, pickId, type Ledger, type LedgerPick, type Outcome } from '../src/ledger.ts';
import { planAutoBook } from '../src/autobook.ts';
import { buildLedgerView, resolvedObservationCount } from '../src/ledgerview.ts';
import { lifecycleTimeline, traceOf, sitOutLog, scoreboard } from '../src/glassbook.ts';

const pick = (asOf: string, sym: string, engine = 'QLT', o: Partial<LedgerPick> = {}): LedgerPick => ({ id: pickId(asOf, engine, sym), engine, sym, asOf, ref: 1700, stop: 1650, horizon: 60, score: 80, rank: 1, ...o });
const closed = (r: number, exitDay: string, o: Partial<Outcome> = {}): Outcome => ({ status: 'closed', final: true, entry: 1700, entryDay: '2026-10-29', exit: 1700 + r * 50, exitDay, reason: r > 0 ? 'Target 2' : 'Stop', r, pct: Math.round((r * 50 / 1700) * 10000) / 100, sessions: 5, ...o });
const led = (picks: LedgerPick[], outcomes: Record<string, Outcome>, days: string[]): Ledger => ({ ...emptyLedger('2026-11-12T00:00:00Z'), days: days.map((asOf) => ({ asOf, recorded: `${asOf}T20:00:00Z`, engines: {} })), picks, outcomes });

// the audited shape: 5 resolved observations, the book took 2 (the first look at each name)
const E1 = pick('2026-10-28', 'ECLERX', 'QLT'), E2 = pick('2026-10-29', 'ECLERX', 'MOM'), E3 = pick('2026-10-30', 'ECLERX', 'QLT'), E4 = pick('2026-11-02', 'ECLERX', 'MOM'), L1 = pick('2026-10-28', 'LAURUSLABS', 'QLT');
const O1 = pick('2026-11-03', 'OPENCO', 'QLT', { ref: 100, stop: 90 });
const FIX = led([E1, E2, E3, E4, L1, O1], {
  [E1.id]: closed(-1.03, '2026-11-04'), [E2.id]: closed(-0.4, '2026-11-04'), [E3.id]: closed(-0.3, '2026-11-04'), [E4.id]: closed(-0.7, '2026-11-04'), [L1.id]: closed(2.21, '2026-11-05'),
  [O1.id]: { status: 'open', final: false, entry: 100, entryDay: '2026-11-04', t1Hit: true, t1Day: '2026-11-09', t1Px: 120, mark: 110, sessions: 4 },
}, ['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03']);

test('F1 the timeline of a closed position: dated events in order, each with a source and a basis', () => {
  const plan = planAutoBook(FIX); const lv = buildLedgerView(FIX, plan);
  const tl = lifecycleTimeline(FIX, plan, `lc:${L1.id}`, lv)!;
  assert.deepEqual(tl.events.map((e) => e.kind), ['signal', 'taken', 'entry', 'exit']);
  assert.equal(tl.events[0].day, '2026-10-28'); assert.equal(tl.events[3].day, '2026-11-05'); assert.equal(tl.events[3].px, 1700 + 2.21 * 50);
  assert.ok(tl.events.every((e) => e.source.length > 0));
  assert.equal(tl.events.find((e) => e.kind === 'taken')!.basis, 'selection', 'a selection is never described as a fill');
  assert.equal(tl.events.find((e) => e.kind === 'entry')!.basis, 'simulated fill');
});
test('F1 a partial exit is an event on a position that is still open; no exit event, no closed state', () => {
  const plan = planAutoBook(FIX); const lv = buildLedgerView(FIX, plan);
  const tl = lifecycleTimeline(FIX, plan, `lc:${O1.id}`, lv)!;
  assert.deepEqual(tl.events.map((e) => e.kind), ['signal', 'taken', 'entry', 't1']);
  assert.equal(tl.lifecycle.state, 'open'); assert.equal(tl.events[3].px, 120);
});
test('F1 a position that has not entered shows "awaiting" with no date, never an invented one', () => {
  const P = pick('2026-11-06', 'WAITCO'); const l = led([P], {}, ['2026-11-06']); const plan = planAutoBook(l);
  const tl = lifecycleTimeline(l, plan, `lc:${P.id}`)!; const aw = tl.events.find((e) => e.kind === 'awaiting')!;
  assert.equal(aw.day, null); assert.equal(tl.events.some((e) => e.kind === 'entry'), false);
});
test('F1 an unknown lifecycle id resolves to nothing', () => { assert.equal(lifecycleTimeline(FIX, planAutoBook(FIX), 'lc:nope'), null); });

test('F1 every headline traces to rows that recompute it exactly', () => {
  const plan = planAutoBook(FIX); const lv = buildLedgerView(FIX, plan);
  const c = traceOf(FIX, plan, 'closed', lv); assert.equal(c.value, 2); assert.equal(c.recomputed, 2); assert.deepEqual(c.rows.map((r) => r.sym).sort(), ['ECLERX', 'LAURUSLABS']);
  const o = traceOf(FIX, plan, 'open', lv); assert.equal(o.value, 1); assert.equal(o.rows[0].sym, 'OPENCO');
  const r = traceOf(FIX, plan, 'totalR', lv); assert.equal(r.value, 1.18, '−1.03 + 2.21 by hand'); assert.equal(r.recomputed, r.value);
  const inr = traceOf(FIX, plan, 'realisedInr', lv);
  const q = (id: string) => plan.taken.find((t) => t.pick.id === id)!.qty;
  const hand = Math.round(((closed(-1.03, 'x').pct! / 100) * 1700 * q(E1.id) + (closed(2.21, 'x').pct! / 100) * 1700 * q(L1.id)) * 100) / 100;
  assert.equal(inr.value, hand, 'rupees recomputed from pct × entry × qty for the two closures');
  assert.equal(inr.rows.length, 2); assert.equal(inr.recomputed, inr.value);
});

test('F2 the sit-out log: 3 not-taken resolved observations; log + resolved-taken = the ledger resolved-observation count', () => {
  const plan = planAutoBook(FIX); const lv = buildLedgerView(FIX, plan); const log = sitOutLog(FIX, plan);
  assert.equal(log.rows.length, 3); assert.equal(log.resolvedTaken, 2); assert.equal(log.resolved, resolvedObservationCount(lv), 'same snapshot, same population');
  assert.deepEqual(log.rows.map((r) => r.pickId).sort(), [E2.id, E3.id, E4.id].sort());
  assert.ok(log.rows.every((r) => r.reason === 'duplicate' && /already held/i.test(r.why)), 'the reason is the book\'s own words');
  assert.equal(log.byReason.duplicate, 3); assert.equal(log.stillRunning, 0);
});
test('F2 no sit-out row can reach a book figure: the trace rows and the log share no pick', () => {
  const plan = planAutoBook(FIX); const log = sitOutLog(FIX, plan); const bookPicks = new Set(plan.taken.map((t) => t.pick.id));
  assert.ok(log.rows.every((r) => !bookPicks.has(r.pickId)));
  const lv = buildLedgerView(FIX, plan); const traced = new Set([...traceOf(FIX, plan, 'totalR', lv).rows, ...traceOf(FIX, plan, 'realisedInr', lv).rows].map((r) => r.lifecycleId));
  assert.ok(log.rows.every((r) => !traced.has(`lc:${r.pickId}`)));
});
test('F2 voided and retired picks are not observations, so they are not sit-outs', () => {
  const V = pick('2026-10-30', 'VOIDCO'); const l = { ...led([E1, V], { [E1.id]: closed(1, '2026-11-04'), [V.id]: closed(5, '2026-11-04') }, ['2026-10-28', '2026-10-30']), voided: { [V.id]: 'bad data' } };
  const log = sitOutLog(l, planAutoBook(l)); assert.equal(log.rows.length, 0); assert.equal(log.resolved, 1);
});
test('F2 a not-taken observation that has not resolved is counted, not listed as an outcome', () => {
  const D = pick('2026-11-02', 'ECLERX', 'MOM'); const l = led([E1, D], { [E1.id]: { status: 'open', final: false, entry: 1700, entryDay: '2026-10-29' } }, ['2026-10-28', '2026-11-02']);
  const log = sitOutLog(l, planAutoBook(l)); assert.equal(log.rows.length, 0); assert.equal(log.stillRunning, 1);
});

test('F3 the scoreboard recomputes from the snapshot: two closures, −1.03R and +2.21R', () => {
  const plan = planAutoBook(FIX); const lv = buildLedgerView(FIX, plan); const s = scoreboard(FIX, plan, lv);
  assert.equal(s.n, 2); assert.equal(s.totalR, 1.18); assert.equal(s.expectancy, 0.59); assert.equal(s.winRate, 50);
  assert.equal(s.avgWin, 2.21); assert.equal(s.avgLoss, -1.03);
  assert.equal(s.bins.reduce((a, b) => a + b.n, 0), 2, 'every closure sits in exactly one bin');
  assert.equal(s.bins.find((b) => b.label === '+2R or better')!.n, 1); assert.equal(s.bins.find((b) => b.label === '−1R or worse')!.n, 1);
  assert.deepEqual(s.engines.map((e) => [e.engine, e.n, e.totalR]), [['QLT', 2, 1.18]].map(([e, n, t]) => [e, n, t]));
  assert.deepEqual(s.drawdown && s.drawdown.r, 1.03, 'the loss came first: the running total fell 1.03R from its start');
});
test('F3 under the minimum sample the scoreboard says so, in words', () => {
  const s = scoreboard(FIX, planAutoBook(FIX)); assert.equal(s.enough, false); assert.match(s.sampleLine, /minimum sample is not proof/i); assert.match(s.sampleLine, /2 closed book positions of the 30/);
});
test('F3 an empty book has no figures, not zeros', () => {
  const l = led([], {}, []); const s = scoreboard(l, planAutoBook(l));
  assert.equal(s.n, 0); assert.equal(s.expectancy, null); assert.equal(s.winRate, null); assert.equal(s.totalR, null); assert.equal(s.drawdown, null); assert.equal(s.avgWin, null);
});
test('F3 only the paper book\'s closures enter: observations the book did not take never move a figure', () => {
  const without = scoreboard(led([E1, L1], { [E1.id]: closed(-1.03, '2026-11-04'), [L1.id]: closed(2.21, '2026-11-05') }, ['2026-10-28']), planAutoBook(led([E1, L1], { [E1.id]: closed(-1.03, '2026-11-04'), [L1.id]: closed(2.21, '2026-11-05') }, ['2026-10-28'])));
  const withObs = scoreboard(FIX, planAutoBook(FIX)); assert.equal(withObs.totalR, without.totalR); assert.equal(withObs.n, without.n);
});
