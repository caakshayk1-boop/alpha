import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyConds, describeCond, sortByMetric, toCsv, valueOf, METRICS, COLUMN_SETS } from '../src/screener.ts';
import type { Row } from '../src/screen.ts';

const r = (sym: string, o: Partial<Row> = {}): Row => ({ sym, name: `${sym} Ltd`, sector: 'Industrials', ...o });
const rows = [r('AAA', { rsi: 60, pe: 12, roce_med: 25, de: 0.1 }), r('BBB', { rsi: 40, pe: 30, roce_med: 10, de: 1.4 }), r('CCC', { pe: 8, roce_med: 30 }), r('BANK', { sector: 'Financial Services', rsi: 65, roce_med: 14, de: 8 })];

test('screener: a condition keeps names that meet it; a name with no figure never passes, and is counted', () => {
  const a = applyConds(rows, [{ m: 'rsi', op: 'gte', v: 55 }]);
  assert.deepEqual(a.rows.map((x) => x.sym), ['AAA', 'BANK']); assert.equal(a.noFigure, 1, 'CCC has no RSI');
  const b = applyConds(rows, [{ m: 'rsi', op: 'gte', v: 55 }, { m: 'pe', op: 'lte', v: 15 }]);
  assert.deepEqual(b.rows.map((x) => x.sym), ['AAA']);
  assert.deepEqual(applyConds(rows, []).rows.length, 4); assert.deepEqual(applyConds(rows, undefined).rows.length, 4);
});
test('screener: a ratio that is not meaningful for a financial-sector name is no figure, not a pass or a fail', () => {
  assert.equal(valueOf(rows[3], 'roce_med'), null); assert.equal(valueOf(rows[3], 'de'), null); assert.equal(valueOf(rows[3], 'rsi'), 65, 'RSI is fine for a bank');
  const a = applyConds(rows, [{ m: 'de', op: 'lte', v: 0.5 }]); assert.deepEqual(a.rows.map((x) => x.sym), ['AAA']); assert.equal(a.noFigure, 2);
});
test('screener: sorting puts names with no figure last in both directions; ties fall back to the symbol', () => {
  assert.deepEqual(sortByMetric(rows, 'pe', 'asc').map((x) => x.sym), ['CCC', 'AAA', 'BBB', 'BANK'].filter((s) => s !== 'BANK').concat('BANK'));
  assert.equal(sortByMetric(rows, 'rsi', 'desc')[3].sym, 'CCC'); assert.equal(sortByMetric(rows, 'rsi', 'asc')[3].sym, 'CCC');
  assert.deepEqual(sortByMetric(rows, 'name', 'asc').map((x) => x.sym), ['AAA', 'BANK', 'BBB', 'CCC']);
});
test('screener: CSV carries the chosen columns, empty for a missing figure, quoted when needed', () => {
  const t = toCsv([r('X,Y', { name: 'Say "hi" Ltd', rsi: 51.5 }), r('Z')], ['rsi', 'pe']).split('\n');
  assert.equal(t[0], 'symbol,name,sector,RSI (14),PE (trailing)'); assert.equal(t[1], '"X,Y","Say ""hi"" Ltd",Industrials,51.5,'); assert.equal(t[2], 'Z,Z Ltd,Industrials,,');
});
test('screener: every metric is described, every column set uses known metrics, conditions read back in words', () => {
  const ids = new Set(METRICS.map((m) => m.id)); assert.equal(ids.size, METRICS.length);
  for (const s of COLUMN_SETS) for (const c of s.cols) assert.ok(ids.has(c), c);
  assert.equal(describeCond({ m: 'rsi', op: 'gte', v: 55 }), 'RSI ≥ 55'); assert.equal(describeCond({ m: 'from_high', op: 'gte', v: -5 }), 'FROM HIGH ≥ -5.0%');
});

import { condsFor, distribution } from '../src/screener.ts';
test('range builder: each mode writes the conditions it names, and "around" is value plus or minus', () => {
  assert.deepEqual(condsFor('rsi', 'gte', 47, 0), [{ m: 'rsi', op: 'gte', v: 47 }]);
  assert.deepEqual(condsFor('rsi', 'lte', 47, 0), [{ m: 'rsi', op: 'lte', v: 47 }]);
  assert.deepEqual(condsFor('rsi', 'between', 60, 40), [{ m: 'rsi', op: 'gte', v: 40 }, { m: 'rsi', op: 'lte', v: 60 }], 'the ends may be given either way round');
  assert.deepEqual(condsFor('rsi', 'around', 47, 1.5), [{ m: 'rsi', op: 'gte', v: 45.5 }, { m: 'rsi', op: 'lte', v: 48.5 }]);
});
test('range builder: "RSI around 47" keeps exactly the names inside, and a name with no RSI never matches', () => {
  const rs = [40, 46, 47, 48.4, 49.6, 70].map((x, i) => r(`S${i}`, { rsi: x })).concat(r('NONE'));
  assert.deepEqual(applyConds(rs, condsFor('rsi', 'around', 47, 1.5)).rows.map((x) => x.sym), ['S1', 'S2', 'S3']);
});
test('range builder: the picture reads the same figures as the filter and clips absurd ratios', () => {
  const rs = Array.from({ length: 200 }, (_, i) => r(`S${i}`, { pe: 10 + i / 10 })).concat([r('WILD', { pe: 1e6 }), r('NOPE')]);
  const d = distribution(rs, 'pe')!;
  assert.equal(d.n, 201); assert.equal(d.missing, 1); assert.equal(d.max, 1e6); assert.ok(d.p99 < 40, 'the clip ignores the absurd ratio'); assert.equal(d.bins.reduce((a, b) => a + b, 0) <= 201, true);
  assert.equal(distribution([r('A', { pe: 5 })], 'pe'), null, 'one figure draws nothing');
});
test('derived figures: price against an average is a percentage, and absent when either side is', () => {
  assert.equal(valueOf(r('A', { price: 110, sma50: 100 }), 'dist50'), 10);
  assert.equal(valueOf(r('A', { price: 110 }), 'dist50'), null);
  assert.equal(valueOf(r('A', { price: 150, low52: 100 }), 'from_low'), 50);
});
test('a condition reads back with the digits it was set with', () => {
  assert.equal(describeCond({ m: 'rsi', op: 'gte', v: 45.5 }), 'RSI ≥ 45.5'); assert.equal(describeCond({ m: 'rsi', op: 'gte', v: 47 }), 'RSI ≥ 47');
});
