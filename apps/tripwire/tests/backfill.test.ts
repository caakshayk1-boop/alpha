// Task 1.1: the profit ladder reaches the picks filed before 27 Oct that are still open or waiting, bar by bar from entry, on real bars.
// laurus_oct2026.json is the Yahoo daily history of LAURUSLABS.NS (traded, unadjusted), fetched 1 Nov 2026. Every expected figure below is worked out by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateLedger, emptyLedger, pickId, takenAtFor, type Ledger } from '../src/ledger.ts';
import type { Bar } from '../src/tracker.ts';

const fx = JSON.parse(readFileSync(new URL('./fixtures/laurus_oct2026.json', import.meta.url), 'utf8')) as { bars: { date: string; o: number; h: number; l: number; c: number }[] };
const at = (d: string) => takenAtFor(d) - 10 * 3600 + 3 * 3600 + 15 * 60;       // 09:15 India time on that date, the bar's own stamp
const bars: Bar[] = fx.bars.map((b) => ({ t: at(b.date), o: b.o, h: b.h, l: b.l, c: b.c }));
const LAURUS = { id: pickId('2026-10-23', 'MOM', 'LAURUSLABS'), engine: 'MOM', sym: 'LAURUSLABS', asOf: '2026-10-23', ref: 1970, stop: 1833.58, horizon: 20, score: 90, rank: 1 };
// what the ledger held on 31 Oct for this pick: open at +3.4R, the ladder never having run
const openBefore = { status: 'open' as const, final: false, entry: 1961.96, entryDay: '2026-10-26', mark: 2405.5, r: 3.4, sessions: 5 };   // what the ledger held on 31 Oct: no ladder ever ran

test('Laurus 23 Oct MOM: T1 books half on 28 Oct, the stop moves to the fill, the rest sells at T2 on 30 Oct', () => {
  // fill = 1960 open x 1.001 = 1961.96 ; risk = 1961.96 - 1833.58 = 128.38 ; swing ladder 1.5R / 3R
  // T1 = 1961.96 + 192.57 = 2154.53 (27 Oct high 2143.10 is short of it; 28 Oct high 2198.80 crosses it, open 2142 is below, so it fills AT the target)
  // T2 = 1961.96 + 385.14 = 2347.10 (29 Oct high 2244.00 is short; 30 Oct high 2405.50 crosses it, open 2246.60 is below, so it fills AT the target)
  const l: Ledger = { ...emptyLedger('2026-10-31T00:00:00Z'), picks: [LAURUS], outcomes: { [LAURUS.id]: openBefore } };
  const o = evaluateLedger(l, { LAURUSLABS: bars }, null, '2026-11-01T00:00:00Z').outcomes[LAURUS.id];
  assert.equal(o.status, 'closed'); assert.equal(o.final, true); assert.equal(o.reason, 'Target 2');
  assert.equal(o.entry, 1961.96); assert.equal(o.entryDay, '2026-10-26');
  assert.equal(o.t1Hit, true); assert.equal(o.t1Day, '2026-10-28'); assert.equal(o.t1Px, 2154.53);
  assert.equal(o.t2Hit, true); assert.equal(o.t2Day, '2026-10-30'); assert.equal(o.t2Px, 2347.1);
  assert.equal(o.exitDay, '2026-10-30'); assert.equal(o.exit, 2347.1);
  // 100 shares: 50 at T1 = 50 x 192.57 = 9628.50 ; 50 at T2 = 50 x 385.14 = 19257.00 ; costs 0.25% x 1961.96 x 100 = 490.49 ; net 28395.01 ; R = 28395.01 / (128.38 x 100)
  assert.equal(o.r, 2.21);
});
test('a finished outcome is never re-evaluated or rewritten, even when the bars would now say something else', () => {
  const closed = { status: 'closed' as const, final: true, entry: 1961.96, entryDay: '2026-10-26', exit: 1900, exitDay: '2026-10-27', reason: 'Time exit', r: -0.5, pct: -3.2, sessions: 2 };
  const l: Ledger = { ...emptyLedger('2026-10-31T00:00:00Z'), picks: [LAURUS], outcomes: { [LAURUS.id]: closed } };
  assert.deepEqual(evaluateLedger(l, { LAURUSLABS: bars }, null, '2026-11-01T00:00:00Z').outcomes[LAURUS.id], closed);
});
test('a pick waiting for its entry, filed before 27 Oct, is evaluated with the ladder from the first bar after it', () => {
  const l: Ledger = { ...emptyLedger('2026-10-31T00:00:00Z'), picks: [LAURUS], outcomes: { [LAURUS.id]: { status: 'pending', final: false } } };
  const o = evaluateLedger(l, { LAURUSLABS: bars.filter((b) => b.t <= at('2026-10-26')) }, null, '2026-11-01T00:00:00Z').outcomes[LAURUS.id];   // bars to 26 Oct only
  assert.equal(o.status, 'open'); assert.equal(o.t1Hit, false); assert.equal(o.t2Hit, false); assert.equal(o.entry, 1961.96);
});
