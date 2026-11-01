// Task 3.1: which positions had Target 1 or Target 2 fill in the last completed session. Pure; the Laurus case is replayed on real bars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alertLine, alertsNow, hitAlerts, inputFromOutcome, inputFromRow, T1_TEXT, T2_TEXT, type AlertInput } from '../src/alerts.ts';
import { emptyLedger, evaluateLedger, pickId, takenAtFor } from '../src/ledger.ts';
import { evaluatePaper, type Bar, type Paper } from '../src/tracker.ts';
import { targetsFor } from '../src/exits.ts';

const fx = JSON.parse(readFileSync(new URL('./fixtures/laurus_oct2026.json', import.meta.url), 'utf8')) as { bars: { date: string; o: number; h: number; l: number; c: number }[] };
const at = (d: string) => takenAtFor(d) - 10 * 3600 + 3 * 3600 + 15 * 60;
const all: Bar[] = fx.bars.map((b) => ({ t: at(b.date), o: b.o, h: b.h, l: b.l, c: b.c }));
const upTo = (d: string) => all.filter((b) => b.t <= at(d));
const P = { id: pickId('2026-10-23', 'MOM', 'LAURUSLABS'), engine: 'MOM', sym: 'LAURUSLABS', asOf: '2026-10-23', ref: 1970, stop: 1833.58, horizon: 20, score: 90, rank: 1 };

test('hitAlerts: only the named session; T2 (a closed position) before T1; a target with no recorded fill is not invented', () => {
  const ins: AlertInput[] = [
    { id: 'a', sym: 'BBB', engine: 'MOM', t1Day: '2026-10-29', t1Level: 110, t1Px: 110 },
    { id: 'b', sym: 'AAA', engine: 'QLT', t1Day: '2026-10-28', t1Level: 50, t1Px: 50, t2Day: '2026-10-29', t2Level: 60, t2Px: 61 },
    { id: 'c', sym: 'CCC', engine: 'MOM', t1Day: '2026-10-29', t1Level: null, t1Px: null },
    { id: 'd', sym: 'DDD', engine: 'MOM', t1Day: '2026-10-27', t1Level: 1, t1Px: 1 },
  ];
  const h = hitAlerts(ins, '2026-10-29');
  assert.deepEqual(h.map((x) => [x.sym, x.kind, x.level, x.price, x.session, x.text]), [['AAA', 'T2', 60, 61, '2026-10-29', T2_TEXT], ['BBB', 'T1', 110, 110, '2026-10-29', T1_TEXT]]);
  assert.deepEqual(hitAlerts(ins, '2026-10-30'), []);
});
test('Laurus 23 Oct MOM on real bars: T1 is flagged for the 28 Oct session, T2 for 30 Oct, and nothing on the days in between', () => {
  const l = { ...emptyLedger('2026-10-31T00:00:00Z'), picks: [P], outcomes: {} };
  const o = evaluateLedger(l, { LAURUSLABS: all }, null, '2026-11-01T00:00:00Z').outcomes[P.id];
  const input = inputFromOutcome(P, o);
  assert.deepEqual(hitAlerts([input], '2026-10-28').map((x) => [x.kind, x.level, x.price]), [['T1', 2154.53, 2154.53]]);
  assert.deepEqual(hitAlerts([input], '2026-10-29'), []);
  assert.deepEqual(hitAlerts([input], '2026-10-30').map((x) => [x.kind, x.level, x.price, x.text]), [['T2', 2347.1, 2347.1, 'T2 hit — position closed']]);
});
test('the live view gives the same flag as the ledger: the browser replay and the nightly record agree', () => {
  const paper: Paper = { ...P, qty: 100, takenAt: takenAtFor(P.asOf), targets: targetsFor(P) };
  const v = evaluatePaper(paper, upTo('2026-10-28'), null, 0.25);
  assert.equal(v.status, 'open'); assert.equal(v.ladder!.t1Hit, true);
  assert.deepEqual(hitAlerts([inputFromRow(P, v)], '2026-10-28').map((x) => [x.kind, x.level, x.price]), [['T1', 2154.53, 2154.53]]);
  const v2 = evaluatePaper(paper, upTo('2026-10-30'), null, 0.25); assert.equal(v2.status, 'closed');
  assert.deepEqual(hitAlerts([inputFromRow(P, v2)], '2026-10-30').map((x) => x.kind), ['T2']);
  assert.deepEqual(hitAlerts([inputFromRow(P, v2)], '2026-10-28').map((x) => x.kind), ['T1'], 'a position that has since closed still flags the T1 it booked on its day');
});
test('a position with no ladder or no entry raises nothing; a gap above the target reports the price it filled at', () => {
  const paper: Paper = { ...P, qty: 100, takenAt: takenAtFor(P.asOf), targets: targetsFor(P) };
  assert.deepEqual(hitAlerts([inputFromOutcome(P, { status: 'pending', final: false })], '2026-10-28'), []);
  assert.deepEqual(hitAlerts([inputFromRow(P, evaluatePaper({ ...paper, targets: null }, upTo('2026-10-30'), null, 0.25))], '2026-10-30'), []);
  const gap = [...upTo('2026-10-27'), { t: at('2026-10-28'), o: 2200, h: 2210, l: 2190, c: 2205 }];     // opens above T1 (2154.53): fills at the open
  const v = evaluatePaper(paper, gap, null, 0.25);
  assert.deepEqual(hitAlerts([inputFromRow(P, v)], '2026-10-28').map((x) => [x.level, x.price]), [[2154.53, 2200]]);
});
test('alertsNow uses the last COMPLETED session by the exchange calendar; the words never promise a notification', () => {
  const i: AlertInput = { id: 'x', sym: 'X', engine: 'MOM', t1Day: '2026-10-30', t1Level: 10, t1Px: 10 };
  assert.equal(alertsNow([i], Date.parse('2026-10-31T05:00:00Z')).length, 1, 'Saturday: Friday is the last completed session');
  assert.equal(alertsNow([i], Date.parse('2026-11-02T05:00:00Z')).length, 1, 'Monday morning, before the open: still Friday');
  assert.equal(alertsNow([i], Date.parse('2026-11-02T11:00:00Z')).length, 0, 'Monday after the close: Monday is the last completed session, so Friday has expired');
  const words = [T1_TEXT, T2_TEXT, alertLine(hitAlerts([i], '2026-10-30')[0])].join(' ');
  assert.doesNotMatch(words, /notif|email|push|we will|we.ll tell|sent to you/i);
});
