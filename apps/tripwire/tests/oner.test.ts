// Task 2.1: one R, one T2. For an entered position every displayed target equals the booked one to the paisa, because both come from the fill (entry minus stop).
// Before: displayed T2 for the Laurus 23 Oct pick was worked from the signal close (1970): 2379.26, while the ladder booked 2347.10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluatePaper, type Bar, type Paper } from '../src/tracker.ts';
import { evaluateLedger, emptyLedger, pickId, takenAtFor } from '../src/ledger.ts';
import { levelsFor, targetPrices } from '../src/levels.ts';
import { ladderPrices, targetsFor } from '../src/exits.ts';
import { lines } from '../src/blotter.ts';

const fx = JSON.parse(readFileSync(new URL('./fixtures/laurus_oct2026.json', import.meta.url), 'utf8')) as { bars: { date: string; o: number; h: number; l: number; c: number }[] };
const at = (d: string) => takenAtFor(d) - 10 * 3600 + 3 * 3600 + 15 * 60;
const all: Bar[] = fx.bars.map((b) => ({ t: at(b.date), o: b.o, h: b.h, l: b.l, c: b.c }));
const P = { id: pickId('2026-10-23', 'MOM', 'LAURUSLABS'), engine: 'MOM', sym: 'LAURUSLABS', asOf: '2026-10-23', ref: 1970, stop: 1833.58, horizon: 20, score: 90, rank: 1 };
const upTo = (d: string) => all.filter((b) => b.t <= at(d));

test('entered position: the displayed T1/T2 are the booked T1/T2 to the paisa (entry-based R), not the signal-close ones', () => {
  const paper: Paper = { id: P.id, sym: P.sym, engine: P.engine, asOf: P.asOf, ref: P.ref, stop: P.stop, horizon: P.horizon, qty: 100, takenAt: takenAtFor(P.asOf), targets: targetsFor(P) };
  const v = evaluatePaper(paper, upTo('2026-10-27'), null, 0.25);          // entered 26 Oct at 1961.96, neither target reached yet
  assert.equal(v.entry, 1961.96); assert.equal(v.ladder!.t1, 2154.53); assert.equal(v.ladder!.t2, 2347.1);
  const shown = targetPrices(P, false, v.entry)!;
  assert.equal(shown.basis, 'entry'); assert.equal(shown.t1, v.ladder!.t1); assert.equal(shown.t2, v.ladder!.t2);
  // the same lines on the company chart
  const lv = levelsFor('LAURUSLABS', [{ ...P, entry: v.entry }]);
  assert.deepEqual(lv.map((x) => [x.label, x.v]), [['Entry', 1961.96], ['Stop', 1833.58], ['T1', 2154.53], ['T2', 2347.1]]);
  // and the blotter
  const l = lines([{ p: paper, v, q: null, dayPnl: null }])[0]; assert.equal(l.t1, v.ladder!.t1); assert.equal(l.t2, v.ladder!.t2);
  // the signal-close arithmetic is a different number: 1970 + 3 x 136.42
  const sig = targetPrices(P)!; assert.equal(sig.basis, 'signal'); assert.equal(sig.t2, 2379.26); assert.notEqual(sig.t2, shown.t2);
});
test('the booked prices equal the displayed ones: the fill prices in the ledger outcome are the levels printed beforehand', () => {
  const l = { ...emptyLedger('2026-10-31T00:00:00Z'), picks: [P], outcomes: {} };
  const o = evaluateLedger(l, { LAURUSLABS: all }, null, '2026-11-01T00:00:00Z').outcomes[P.id];
  const shown = targetPrices(P, false, o.entry)!;
  assert.equal(o.t1Px, shown.t1); assert.equal(o.t2Px, shown.t2);        // no gap above either target on the day it filled, so each fills AT the level
});
test('a pick that has not entered shows levels from the signal close and says so; entered ones never carry the signal-close label', () => {
  const pend = levelsFor('LAURUSLABS', [{ ...P, asOf: '2026-10-30', ref: 2405.5, stop: 2226.29 }]);
  assert.deepEqual(pend.map((x) => x.label), ['Signal close', 'Stop', 'T1 at signal close', 'T2 at signal close']);
  assert.ok(levelsFor('LAURUSLABS', [{ ...P, entry: 1961.96 }]).every((x) => !/signal/i.test(x.label)));
});
test('ladderPrices is the single definition: R is entry minus stop, a target is entry plus its multiple of R', () => {
  const x = ladderPrices(100.1, 95, 1.5, 3); assert.equal(x.t1, 107.75); assert.equal(x.t2, 115.4); assert.ok(Math.abs(x.risk - 5.1) < 1e-9);
  assert.equal(targetPrices({ asOf: '2026-10-28', horizon: 20, ref: 100, stop: 95 }, false, 100.1)!.t2, 115.4);
  assert.equal(targetPrices({ asOf: '2026-10-28', horizon: 20, ref: 100, stop: 95 }, false, 94)!.basis, 'signal', 'an entry at or below the stop is not a usable R: fall back to the signal close, labelled');
});
