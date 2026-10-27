import test from 'node:test';
import assert from 'node:assert/strict';
import { breadthStats, breadthWord, shortcuts } from '../src/breadthstats.ts';
import type { Row } from '../src/screen.ts';

const row = (o: Partial<Row>): Row => ({ sym: 'X', name: 'X', liquid: true, ...o });
test('shares are of the names that HAVE the figure; a missing average is not counted as below it', () => {
  const rows = [row({ price: 110, sma50: 100, sma200: 90 }), row({ price: 90, sma50: 100, sma200: 95 }), row({ price: 50, sma50: 40 }), row({ price: 10, liquid: false, sma50: 20, sma200: 20 })];
  const s = breadthStats(rows);
  assert.deepEqual([s.above50.n, s.above50.of], [2, 3]); assert.deepEqual([s.above200.n, s.above200.of], [1, 2]); assert.equal(s.liquid, 3);
});
test('near high, stretched and washed out use their own denominators', () => {
  const s = breadthStats([row({ from_high: -2, rsi: 75 }), row({ from_high: -20, rsi: 25 }), row({ rsi: 50 })]);
  assert.deepEqual([s.nearHigh.n, s.nearHigh.of], [1, 2]); assert.deepEqual([s.stretched.n, s.stretched.of], [1, 3]); assert.deepEqual([s.washed.n, s.washed.of], [1, 3]);
});
test('no names, no percentage (never zero)', () => { assert.equal(breadthStats([]).above200.pct, null); });
test('the breadth word follows its printed rule', () => {
  assert.equal(breadthWord(60, 20, 100).word, 'Broad strength'); assert.equal(breadthWord(55, 40, 100).word, 'Mixed');
  assert.equal(breadthWord(20, 45, 100).word, 'Broad weakness'); assert.equal(breadthWord(0, 0, 0).word, 'No read');
});
test('shortcuts count liquid names and link to Discover with the same filters', () => {
  const up = { price: 120, sma20: 110, sma50: 100, sma200: 90, r3m: 5 }; const rows = [row({ ...up, from_high: -2, rsi: 60 }), row({ ...up, from_high: -10, rsi: 45 })];
  const s = shortcuts(rows); assert.equal(s.length, 3); assert.ok(s.every((x) => x.href.startsWith('#/discover?')));
});
