// 12 Nov 2026: the P&L split (ledgerview.ts, Tripwire 2.0 task 1.2). Acceptance §5.3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitOpen, splitClosed, splitOfRow } from '../src/ledgerview.ts';
import { evaluatePaper, DEFAULT_COST, type Bar, type Paper } from '../src/tracker.ts';

test('§5.3 partial-exit fixture: buy 100 @100, stop 90, sell 50 @120, mark 50 @110: realised 1,000, unrealised 500, total 1,500, risk 1,000, 1.5R before charges', () => {
  const s = splitOpen({ qty0: 100, fill: 100, stop: 90, qtyLeft: 50, booked: (120 - 100) * 50, mark: 110, costPct: 0, slipPct: 0 });
  assert.deepEqual([s.realised, s.unrealised, s.total, s.risk, s.r, s.openTrade], [1000, 500, 1500, 1000, 1.5, 1500]);
});
test('§5.3 costs are applied once, and the risk denominator is unchanged after T1', () => {
  const none = splitOpen({ qty0: 100, fill: 100, stop: 90, qtyLeft: 50, booked: 1000, mark: 110, costPct: 0, slipPct: 0 });
  const withCost = splitOpen({ qty0: 100, fill: 100, stop: 90, qtyLeft: 50, booked: 1000, mark: 110, costPct: 0.25, slipPct: 0 });
  assert.equal(Math.round((none.total! - withCost.total!) * 100) / 100, 25, 'the whole 0.25% of 10,000 is charged once: 12.50 on each half');
  assert.equal(Math.round((none.realised - withCost.realised) * 100) / 100, 12.5); assert.equal(Math.round((none.unrealised! - withCost.unrealised!) * 100) / 100, 12.5);
  assert.equal(withCost.risk, 1000, 'risk is the filed stop times the original shares');
  const beforeT1 = splitOpen({ qty0: 100, fill: 100, stop: 90, qtyLeft: 100, booked: 0, mark: 110, costPct: 0, slipPct: 0 });
  assert.equal(beforeT1.risk, none.risk, 'the same denominator before and after the partial exit; a raised break-even stop is not an input');
});
test('§5.3 the independent split agrees with the tracker to the paisa on a real ladder run', () => {
  const T = (d: string) => Date.parse(`${d}T03:45:00Z`) / 1000;
  const bar = (d: string, o: number, h: number, l: number, c: number): Bar => ({ t: T(d), o, h, l, c });
  const p: Paper = { id: 'x', sym: 'X', engine: 'QLT', asOf: '2026-11-02', ref: 100, stop: 90, horizon: 30, qty: 100, takenAt: Date.parse('2026-11-02T10:00:00Z') / 1000, targets: { t1R: 1, t2R: 2 } };
  const bars = [bar('2026-11-02', 99, 101, 98, 100), bar('2026-11-03', 100, 101, 99, 100.5), bar('2026-11-04', 101, 113, 100, 112), bar('2026-11-05', 112, 114, 108, 110)];
  const v = evaluatePaper(p, bars, null, DEFAULT_COST); assert.equal(v.status, 'open'); assert.equal(v.ladder?.t1Hit, true); assert.ok(v.ladder!.qtyLeft > 0 && v.ladder!.qtyLeft < 100);
  const s = splitOfRow({ p, v }, DEFAULT_COST)!;
  assert.ok(Math.abs(s.total! - v.pnl!) <= 0.02, `total ${s.total} vs tracker ${v.pnl}`);
  assert.equal(s.realised + s.unrealised!, s.total, 'realised + unrealised = total, to the paisa');
  assert.ok(s.realised > 0, 'the booked half is realised, not hidden in "open"');
  assert.ok(Math.abs(s.r! - v.r!) <= 0.02, 'R agrees with the tracker, whose denominator is the original risk');
  assert.ok(s.realised < v.ladder!.booked, 'realised is net of its share of costs, so it is below the gross booked figure');
});
test('a finished position is wholly realised; R-only and unmarked positions are not turned into zeros', () => {
  const c = splitClosed(-250, 1000); assert.deepEqual([c.realised, c.unrealised, c.total, c.openTrade, c.r], [-250, 0, -250, null, -0.25]);
  assert.equal(splitOfRow({ p: { qty: 0, stop: 90 }, v: { status: 'closed', entry: 100, mark: 90, pnl: null } }, 0.25), null, 'a record-only close has no rupee figure');
  const m = splitOpen({ qty0: 100, fill: 100, stop: 90, qtyLeft: 50, booked: 1000, mark: null, costPct: 0.25 });
  assert.equal(m.unrealised, null); assert.equal(m.total, null); assert.ok(m.realised > 0, 'the booked part is known even when the mark is not');
});

// ---- the attribution reducer (the defect: an open position's whole pnl, booked partial profit included, was filed under "unrealised") ----
import { attribute } from '../src/attribution.ts';
test('the reducer puts booked partial profit in REALISED and only the remaining mark in UNREALISED; engine and position totals reconcile to the paisa', () => {
  const half = splitOpen({ qty0: 100, fill: 100, stop: 90, qtyLeft: 50, booked: 1000, mark: 110, costPct: 0.25 });
  const c = splitOpen({ qty0: 100, fill: 100, stop: 90, qtyLeft: 100, booked: 0, mark: 98.9, costPct: 0.25 });
  const rows = [
    { id: 'a', sym: 'AAA', engine: 'QLT', status: 'open', pnl: half.total, r: half.r, split: half },
    { id: 'b', sym: 'BBB', engine: 'QLT', status: 'closed', pnl: -300, r: -0.3, split: splitClosed(-300, 1000) },
    { id: 'c', sym: 'CCC', engine: 'MOM', status: 'open', pnl: c.total, r: -0.1, split: c },
  ];
  const a = attribute(rows, (e) => e);
  assert.equal(Math.round(a.realised * 100), Math.round((half.realised - 300) * 100), 'AAA booked half is realised');
  assert.ok(a.realised > 600, 'not hidden in the open bucket'); assert.equal(a.splitKnown, true);
  assert.equal(Math.round((a.realised + a.unrealised) * 100), Math.round(a.total * 100)); assert.ok(a.engineReconciles && a.positionsReconcile);
  assert.equal(a.byEngine.reduce((s, e) => s + Math.round(e.total * 100), 0), Math.round(a.total * 100), 'engine totals = sum of position totals');
  assert.equal(Math.round(a.openTrade * 100), Math.round((half.total! + c.total!) * 100), 'open-trade = booked partials + remaining marks of the open positions');
  assert.notEqual(a.openTrade, a.unrealised, 'open-trade P&L is not unrealised P&L');
});
test('without a split the open figure is open-trade P&L and the reducer says it cannot call it unrealised', () => {
  const a = attribute([{ id: 'a', sym: 'AAA', engine: 'QLT', status: 'open', pnl: 1500, r: 1.5 }], (e) => e);
  assert.equal(a.splitKnown, false); assert.equal(a.total, 1500); assert.equal(a.openTrade, 1500);
});
