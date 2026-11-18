import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, positionSize } from '../src/lib/accounting.ts';
import { chargesFor, sum } from '../src/lib/charges.ts';
import { isSession, nextSession } from '../src/lib/calendar.ts';

test('ACCEPTANCE FIXTURE: buy 100 @100, stop 90, sell 50 @120, mark 50 @110 -> 1000 / 500 / 1500 / risk 1000 / 1.5R', () => {
  const r = evaluate([{ date: '2026-11-02', side: 'buy', qty: 100, price: 100 }, { date: '2026-11-09', side: 'sell', qty: 50, price: 120 }], 90, 110);
  assert.equal(r.realised, 1000); assert.equal(r.unrealised, 500); assert.equal(r.total, 1500); assert.equal(r.initialRisk, 1000); assert.equal(r.r, 1.5);
  assert.equal(r.qtyOpen, 50); assert.equal(r.status, 'open');
});
test('second partial exit does not change the risk denominator', () => {
  const r = evaluate([{ date: 'a', side: 'buy', qty: 100, price: 100 }, { date: 'b', side: 'sell', qty: 50, price: 120 }, { date: 'c', side: 'sell', qty: 25, price: 130 }], 90, 105);
  // realised 1000 + 750 = 1750 ; unrealised 25 x 5 = 125 ; total 1875 ; R 1.875 -> 1.88
  assert.equal(r.realised, 1750); assert.equal(r.unrealised, 125); assert.equal(r.initialRisk, 1000); assert.equal(r.r, 1.88);
});
test('full exit closes the position and needs no mark', () => {
  const r = evaluate([{ date: 'a', side: 'buy', qty: 10, price: 50 }, { date: 'b', side: 'sell', qty: 10, price: 45 }], 45, null);
  assert.equal(r.status, 'closed'); assert.equal(r.total, -50); assert.equal(r.r, -1); assert.equal(r.qtyOpen, 0);
});
test('stop-out at the stop is exactly -1R before charges', () => {
  const r = evaluate([{ date: 'a', side: 'buy', qty: 40, price: 250 }, { date: 'b', side: 'sell', qty: 40, price: 200 }], 200, null);
  assert.equal(r.r, -1);
});
test('an open position without a mark is refused, never guessed', () => {
  assert.throws(() => evaluate([{ date: 'a', side: 'buy', qty: 1, price: 10 }], 9, null), /needs a mark/);
  assert.throws(() => evaluate([{ date: 'a', side: 'sell', qty: 1, price: 10 }], 9, 10), /exceeds/);
});
test('charges are counted exactly once: realised + open charges = total of every fill', () => {
  const mk = (side: 'buy' | 'sell', q: number, p: number) => ({ date: 'd', side, qty: q, price: p, charges: chargesFor(side, q, p) });
  const fills = [mk('buy', 100, 100), mk('sell', 50, 120), mk('sell', 20, 115)];
  const r = evaluate(fills, 90, 110);
  const all = fills.reduce((a, f) => a + sum(f.charges!), 0);
  assert.ok(Math.abs(r.chargesRealised + r.chargesOpen - all) < 0.011, `${r.chargesRealised}+${r.chargesOpen} vs ${all}`);
  assert.ok(Math.abs(r.chargesTotal - all) < 0.011);
  // with charges, total is strictly below the pre-charge figure and equals it minus the charges not yet... realised+open charges
  const gross = evaluate(fills.map((f) => ({ ...f, charges: undefined })), 90, 110);
  assert.ok(Math.abs((gross.total - r.total) - (r.chargesRealised + r.chargesOpen)) < 0.02);
});
test('position size: account x risk% / (entry - stop), whole shares down; unusable inputs give null', () => {
  assert.equal(positionSize(500000, 1, 100, 90), 500);
  assert.equal(positionSize(500000, 1, 103, 90), 384);       // 5000/13 = 384.6
  assert.equal(positionSize(500000, 1, 90, 90), null); assert.equal(positionSize(0, 1, 100, 90), null); assert.equal(positionSize(1000, 1, 100, 99.99), 1000);
});
test('calendar: weekends and listed holidays are not sessions; next session skips them', () => {
  assert.equal(isSession('2026-11-14'), false); assert.equal(isSession('2026-11-10'), false); assert.equal(isSession('2026-11-18'), true);
  assert.equal(nextSession('2026-11-09'), '2026-11-11'); assert.equal(nextSession('2026-11-20'), '2026-11-23');
});
