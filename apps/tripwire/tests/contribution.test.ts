// Signed contributions that add up: losses are in the first view, "Other" nets the rest, and the parts equal the total to the paisa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contributions, reconciles } from '../src/contribution.ts';

const it = (label: string, value: number) => ({ key: label, label, value });
test('the regression: twelve positions, nine winners, three losers; a best-first cut at eight showed only winners. Now the biggest loss is on the first view', () => {
  const xs = [...Array.from({ length: 9 }, (_, i) => it(`W${i}`, 1000 - i * 50)), it('L1', -300), it('L2', -120.5), it('L3', -40.25)];
  const c = contributions(xs, 8); assert.equal(c.rows.length, 8); assert.ok(c.rows.some((r) => r.value < 0), 'a loss is in the initial view'); assert.ok(c.rows.some((r) => r.label === 'L1'), 'the largest loss is shown');
  assert.ok(c.other && c.other.n === 4); assert.ok(reconciles(c)); assert.equal(c.total, Math.round(xs.reduce((a, x) => a + x.value, 0) * 100) / 100);
});
test('rows plus Other equal the total exactly, with paise that do not add in floating point', () => {
  const xs = Array.from({ length: 20 }, (_, i) => it(`P${i}`, (i % 3 === 0 ? -1 : 1) * (0.1 + i * 0.07))); const c = contributions(xs, 5);
  assert.ok(reconciles(c)); const paise = (v: number) => Math.round(v * 100); assert.equal(c.rows.reduce((a, r) => a + paise(r.value), 0) + paise(c.other!.value), paise(c.total));
  assert.equal(paise(c.other!.gains + c.other!.losses), paise(c.other!.value));
});
test('the largest gain and the largest loss are always shown when the book has either, even if many bigger moves are the same sign', () => {
  const xs = [...Array.from({ length: 10 }, (_, i) => it(`W${i}`, 5000 - i)), it('tiny loss', -2)]; const c = contributions(xs, 4);
  assert.ok(c.rows.some((r) => r.label === 'tiny loss') && c.rows.some((r) => r.label === 'W0')); assert.equal(c.rows.length, 4); assert.ok(reconciles(c));
  const ys = [...Array.from({ length: 10 }, (_, i) => it(`L${i}`, -5000 + i)), it('tiny win', 2)]; const d = contributions(ys, 4); assert.ok(d.rows.some((r) => r.label === 'tiny win') && d.rows.some((r) => r.label === 'L0')); assert.ok(reconciles(d));
});
test('no remainder when everything fits; an all-loss book is shown as losses; non-finite values are not items; order is stable', () => {
  const c = contributions([it('A', 10), it('B', -4)], 8); assert.equal(c.other, null); assert.equal(c.total, 6); assert.deepEqual(c.rows.map((r) => r.label), ['A', 'B']);
  const l = contributions([it('A', -1), it('B', -3), it('C', -2)], 8); assert.equal(l.total, -6); assert.ok(l.rows.every((r) => r.value < 0));
  const n = contributions([it('A', 1), { key: 'x', label: 'x', value: Number.NaN }], 8); assert.equal(n.count, 1);
  const a = contributions([it('A', 5), it('B', 5), it('C', -5), it('D', -5)], 3), b = contributions([it('D', -5), it('C', -5), it('B', 5), it('A', 5)], 3); assert.deepEqual(a, b, 'ties break on the label, not on input order');
  assert.deepEqual(contributions([], 8), { rows: [], other: null, total: 0, count: 0 });
});
