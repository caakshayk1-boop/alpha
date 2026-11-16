// 15 Nov 2026 (Tripwire 4.0, F4): every number in the explainer equals the row / sheet / pick value; missing data shortens the text and never changes a number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whyLines } from '../src/whystock.ts';
import type { Row } from '../src/screen.ts';

const row: Row = { sym: 'ABC', name: 'ABC Ltd', liquid: true, price: 200, from_high: -3.2, rs3m: 12.4, rsi: 61.3, sma200: 150 };
const base = { sym: 'ABC', row, engines: [{ id: 'MOM' as const, name: 'Momentum', pass: true }, { id: 'QLT' as const, name: 'Quality', pass: false }], pick: { engine: 'MOM' as const, asOf: '2026-11-13', ref: 190, stop: 170 }, factors: { universe: 531, values: { mom12_1: 49.94, near_high: 88.3, coil: 35.6 } } };

test('F4 a name with a pick: rule, values, ranks and invalidation, each number equal to its source', () => {
  const L = whyLines(base); assert.deepEqual(L.map((x) => x.id), ['rule', 'values', 'ranks', 'invalidation']);
  assert.match(L[0].text, /MOM engine's rule fired on ABC.*Fri 13 Nov/);
  assert.match(L[1].text, /From 52w high −3\.2%/); assert.match(L[1].text, /vs Nifty 3m \+12 pts/); assert.match(L[1].text, /RSI 61/);
  assert.match(L[2].text, /among 531 stocks/); assert.match(L[2].text, /12-month momentum, skipping the last month 50 of 100/); assert.match(L[2].text, /nearness to the 52-week high 88 of 100/);
  assert.match(L[3].text, /stop at ₹170\.00, which is 15\.0% below the last price of ₹200\.00/, '(200 − 170) / 200 = 15.0% by hand');
});
test('F4 an unlisted factor is never named: only the two the rules use are ranked', () => {
  assert.doesNotMatch(whyLines(base).map((x) => x.text).join(' '), /coil|35\.6|volatility coil/i);
});
test('F4 missing factor data renders a shorter explainer, never a wrong one', () => {
  const L = whyLines({ ...base, factors: null }); assert.deepEqual(L.map((x) => x.id), ['rule', 'values', 'invalidation']);
  const half = whyLines({ ...base, factors: { universe: 531, values: { near_high: 88.3 } } }); assert.doesNotMatch(half[2].text, /momentum/i); assert.match(half[2].text, /88 of 100/);
  const none = whyLines({ ...base, factors: { universe: 531, values: {} } }); assert.equal(none.some((x) => x.id === 'ranks'), false);
});
test('F4 no price → no distance to the stop (the sentence is omitted, not zeroed)', () => {
  const L = whyLines({ ...base, row: { ...row, price: null } }); assert.equal(L.some((x) => x.id === 'invalidation'), false);
});
test('F4 a price at or below the stop is said plainly', () => {
  const L = whyLines({ ...base, row: { ...row, price: 160 } }); assert.match(L.at(-1)!.text, /at or below the stop/);
});
test('F4 no pick: says which rules pass, writes no values or stop, invents no reason', () => {
  const L = whyLines({ ...base, pick: null }); assert.deepEqual(L.map((x) => x.id), ['rule', 'ranks']); assert.match(L[0].text, /^Momentum passes for ABC on the last screen\. No pick has been written/);
  assert.match(whyLines({ ...base, pick: null, engines: [{ id: 'MOM', name: 'Momentum', pass: false }] })[0].text, /No engine rule passes/);
});
test('F4 engines not computed yet and no pick → nothing to say, nothing invented', () => { assert.deepEqual(whyLines({ ...base, pick: null, engines: null, factors: null }), []); });
test('F4 the text never advises', () => { assert.doesNotMatch(whyLines(base).map((x) => x.text).join(' '), /\b(buy|sell|should|expect|will rise|upside)\b/i); });
