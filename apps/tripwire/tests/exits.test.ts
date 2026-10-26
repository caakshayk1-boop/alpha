// The profit-booking ladder, with every expected figure worked out by hand beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePaper, type Bar, type Paper } from '../src/tracker.ts';
import { takenAtFor } from '../src/ledger.ts';
import { targetsFor, styleOf, STYLES, POLICY_FROM } from '../src/exits.ts';

const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 1000 - 19800 + 9 * 3600 + 15 * 60;
const bar = (iso: string, o: number, h: number, l: number, c: number, forming = false): Bar => ({ t: day(iso), o, h, l, c, forming });
const COST = 0.25;
// signal close 100, stop 95, 10 shares, swing ladder 1.5R / 3R. Next open 100 -> fill 100.1 (0.1% slippage); risk 5.1; T1 = 100.1 + 7.65 = 107.75; T2 = 100.1 + 15.3 = 115.4; half = 5 shares.
const P = (o: Partial<Paper> = {}): Paper => ({ id: 'p', sym: 'X', engine: 'MOM', asOf: '2026-10-23', ref: 100, stop: 95, horizon: 20, qty: 10, takenAt: takenAtFor('2026-10-23'), targets: { t1R: 1.5, t2R: 3 }, ...o });
const sig = bar('2026-10-23', 99, 101, 98, 100); const d1 = bar('2026-10-26', 100, 101, 99, 100);

test('ladder: Target 1 sells half at the target, then Target 2 sells the rest; costs are on the whole entry', () => {
  const t1 = evaluatePaper(P(), [sig, d1, bar('2026-10-27', 101, 108, 100.5, 107)], null, COST);
  assert.equal(t1.status, 'open'); assert.equal(t1.ladder!.t1, 107.75); assert.equal(t1.ladder!.t2, 115.4);
  assert.equal(t1.ladder!.t1Hit, true); assert.equal(t1.ladder!.t2Hit, false); assert.equal(t1.ladder!.qtyLeft, 5);
  assert.equal(t1.ladder!.booked, 38.25);                                    // (107.75 - 100.1) x 5
  assert.equal(t1.ladder!.stop, 100.1, 'the stop on the rest moves to the fill');
  const t2 = evaluatePaper(P(), [sig, d1, bar('2026-10-27', 101, 108, 100.5, 107), bar('2026-10-28', 107, 116, 106, 115)], null, COST);
  // booked 38.25 + (115.4 - 100.1) x 5 = 76.5 -> 114.75 ; costs 0.0025 x 100.1 x 10 = 2.5025 ; no slippage on a limit target ; net 112.2475
  assert.equal(t2.status, 'closed'); assert.equal(t2.reason, 'Target 2'); assert.equal(t2.exit, 115.4); assert.equal(t2.pnl, 112.25);
  assert.equal(t2.r, 2.2); assert.equal(t2.pct, 11.21);                      // 112.2475 / (5.1 x 10) ; 112.2475 / 1001
});
test('ladder: after Target 1 the stop is the fill, so the rest is closed at break-even, not at the original stop', () => {
  const v = evaluatePaper(P(), [sig, d1, bar('2026-10-27', 101, 108, 100.5, 107), bar('2026-10-28', 105, 106, 100, 101)], null, COST);
  // 38.25 booked ; 5 shares out at 100.1 (zero gross) ; costs 2.5025 ; stop is a market order so slippage 0.001 x 100.1 x 5 = 0.5005 ; net 35.247
  assert.equal(v.status, 'closed'); assert.equal(v.exit, 100.1); assert.equal(v.reason, 'Stopped at break-even after Target 1'); assert.equal(v.pnl, 35.25); assert.equal(v.r, 0.69);
});
test('ladder: the stop is tested first. A bar that spans both the stop and Target 1 is a stop', () => {
  const v = evaluatePaper(P(), [sig, d1, bar('2026-10-27', 100, 108, 94, 100)], null, COST);
  // (95 - 100.1) x 10 = -51 ; costs 2.5025 ; slippage 0.001 x 95 x 10 = 0.95 ; net -54.4525
  assert.equal(v.reason, 'Stop'); assert.equal(v.pnl, -54.45); assert.equal(v.ladder?.t1Hit ?? false, false);
});
test('ladder: Target 2 cannot fill in the bar that filled Target 1 unless that bar opened at or above it', () => {
  const same = evaluatePaper(P(), [sig, d1, bar('2026-10-27', 101, 116, 100.5, 115)], null, COST);
  assert.equal(same.status, 'open'); assert.equal(same.ladder!.t1Hit, true); assert.equal(same.ladder!.t2Hit, false);
  const gap = evaluatePaper(P(), [sig, d1, bar('2026-10-27', 116, 118, 115, 117)], null, COST);
  // both halves fill at the open of 116: (116 - 100.1) x 10 = 159 ; costs 2.5025 ; net 156.4975
  assert.equal(gap.status, 'closed'); assert.equal(gap.reason, 'Target 2'); assert.equal(gap.exit, 116); assert.equal(gap.pnl, 156.5);
});
test('ladder: the time exit sells whatever is left at the close, with slippage; a live mark never closes anything', () => {
  const v = evaluatePaper(P({ horizon: 3 }), [sig, d1, bar('2026-10-27', 101, 108, 100.5, 107), bar('2026-10-28', 107, 110, 106, 109)], null, COST);
  // 38.25 + (109 - 100.1) x 5 = 44.5 -> 82.75 ; costs 2.5025 ; slippage 0.001 x 109 x 5 = 0.545 ; net 79.7025
  assert.equal(v.status, 'closed'); assert.match(v.reason ?? '', /Time exit after 3 sessions/); assert.equal(v.pnl, 79.7);
  const forming = evaluatePaper(P({ horizon: 2 }), [sig, d1, bar('2026-10-27', 101, 103, 100.5, 102, true)], { px: 102.5, t: day('2026-10-27') + 600 }, COST);
  assert.equal(forming.status, 'open'); assert.equal(forming.markKind, 'live');
});
test('ladder: without targets the original stop-and-time rule is unchanged', () => {
  const v = evaluatePaper(P({ targets: null }), [sig, d1, bar('2026-10-27', 101, 120, 100.5, 119)], null, COST);
  assert.equal(v.status, 'open'); assert.equal(v.ladder, undefined);
});
test('styles: the holding period picks the sleeve and the ladder; picks filed before the policy keep the old rule', () => {
  assert.deepEqual([styleOf(5), styleOf(10), styleOf(11), styleOf(30), styleOf(31), styleOf(60)], ['short', 'short', 'swing', 'swing', 'long', 'long']);
  assert.deepEqual(targetsFor({ asOf: POLICY_FROM, horizon: 5 }), { style: 'short', t1R: 1, t2R: 2 });
  assert.deepEqual(targetsFor({ asOf: POLICY_FROM, horizon: 20 }), { style: 'swing', t1R: 1.5, t2R: 3 });
  assert.deepEqual(targetsFor({ asOf: POLICY_FROM, horizon: 60 }), { style: 'long', t1R: 2, t2R: 4 });
  assert.equal(targetsFor({ asOf: '2026-10-26', horizon: 20 }), null);
  assert.equal(STYLES.reduce((a, s) => a + s.cap, 0), 30);
});
