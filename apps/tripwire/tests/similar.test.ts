import test from 'node:test';
import assert from 'node:assert/strict';
import { similarTo, LIKE } from '../src/similar.ts';
import type { Row } from '../src/screen.ts';

// 40 filler names with spread-out figures, so the typical spread is real
const filler = (i: number): Row => ({ sym: `F${i}`, name: `F${i}`, sector: 'Industrials', pe: 10 + i, pb: 1 + i / 10, roce_med: 5 + i / 2, roe: 5 + i / 2, rev_cagr: i / 2, net_margin: 3 + i / 4, de: i / 40, r3m: i - 20, rs3m: i - 20, rsi: 30 + i, atr_pct: 1 + i / 10, from_high: -i } as Row);
const rows: Row[] = Array.from({ length: 40 }, (_, i) => filler(i));
const base: Row = { ...filler(20), sym: 'ME', name: 'Me' } as Row;

test('the closest names are the ones with the nearest figures', () => {
  const l = similarTo('ME', [...rows, base], 3);
  assert.deepEqual(l.map((x) => x.row.sym).sort(), ['F19', 'F20', 'F21']);
  assert.equal(l[0].row.sym, 'F20'); assert.equal(l[0].distance, 0);
});
test('the name itself is never its own match, and an unknown name returns nothing', () => {
  assert.ok(!similarTo('ME', [...rows, base]).some((x) => x.row.sym === 'ME'));
  assert.deepEqual(similarTo('NOPE', rows), []);
});
test('a name sharing fewer than five figures is not compared at all', () => {
  const thin = { sym: 'THIN', name: 'Thin', pe: 30, pb: 3 } as Row;
  assert.ok(!similarTo('ME', [...rows, base, thin]).some((x) => x.row.sym === 'THIN'));
});
test('a missing figure is left out of the average, not read as zero', () => {
  const gap = { ...filler(20), sym: 'GAP', name: 'Gap', pe: null, pb: null, roe: null } as Row;
  const l = similarTo('ME', [...rows, base, gap], 40).find((x) => x.row.sym === 'GAP')!;
  assert.equal(l.distance, 0); assert.equal(l.shared, LIKE.length - 3);
});
test('one extreme ratio is capped at five spreads and cannot decide the order alone', () => {
  const wild = { ...filler(20), sym: 'WILD', name: 'Wild', pe: 100000 } as Row;
  const l = similarTo('ME', [...rows, base, wild], 40).find((x) => x.row.sym === 'WILD')!;
  assert.ok(l.distance <= 5 / 5 + 0.01);
});
