// 15 Nov 2026 (Tripwire 4.0, F5): every figure is recomputed here by hand from the rows, and the stale label is pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherOf } from '../src/weather.ts';
import type { Row } from '../src/screen.ts';

// an uptrend needs: price>sma20>sma50, sma50>=1.01*sma200, r3m>0
const up = (sym: string, o: Partial<Row> = {}): Row => ({ sym, name: sym, liquid: true, price: 130, sma20: 120, sma50: 110, sma200: 100, r3m: 5, r1d: 1, from_high: -2, ...o });
const down = (sym: string, o: Partial<Row> = {}): Row => ({ sym, name: sym, liquid: true, price: 70, sma20: 80, sma50: 90, sma200: 100, r3m: -5, r1d: -1, from_high: -30, ...o });
const ROWS: Row[] = [up('A'), up('B'), up('C'), down('D'), { ...up('E'), liquid: false }];   // E is not liquid: it is in no share

test('F5 each figure equals the hand count over the liquid rows', () => {
  const w = weatherOf(ROWS, '2026-11-13', 0);
  assert.equal(w.liquid, 4); assert.deepEqual([w.above200.n, w.above200.of], [3, 4]); assert.equal(w.above200.pct, 75);
  assert.deepEqual([w.nearHigh.n, w.nearHigh.of], [3, 4]);          // −2 is within 5% of the high; −30 is not
  assert.equal(w.medianFromHigh, -2, 'sorted −30,−2,−2,−2 → median −2');
  assert.deepEqual([w.advancing.n, w.advancing.of], [3, 4]);
  assert.equal(w.word, 'Broad strength', '3 of 4 in an uptrend, 1 in a downtrend: ≥50% and ≥ twice the downs');
  assert.match(w.line, /75% of 4 liquid names are above their 200-day average/); assert.match(w.line, /As of the close of Fri 13 Nov\./);
  assert.equal(w.stale, false); assert.doesNotMatch(w.line, /stale/);
});
test('F5 a stale screen says so, with its date and the word "stale"', () => {
  const w = weatherOf(ROWS, '2026-11-06', 4);
  assert.equal(w.stale, true); assert.doesNotMatch(w.line, /sessions? (behind|before)/, 'the banner says the lag; the page says it once'); assert.match(w.line, /stale: the data is 4 sessions old/); assert.match(w.line, /Fri 6 Nov/);
  assert.match(weatherOf(ROWS, '2026-11-06', 1).line, /stale: the data is 1 session old/);
});
test('F5 an unknown data date is stale, never current by default', () => {
  assert.equal(weatherOf(ROWS, null, null).stale, true); assert.match(weatherOf(ROWS, null, null).line, /stale: no data date/);
  assert.match(weatherOf(ROWS, '2026-11-13', null).line, /stale: the data date cannot be checked/);
});
test('F5 a missing figure is left out of the line, not filled: no r1d anywhere → no "rose on the day"', () => {
  const w = weatherOf(ROWS.map((r) => ({ ...r, r1d: null })), '2026-11-13', 0);
  assert.doesNotMatch(w.line, /rose on the day/); assert.equal(w.advancing.pct, null);
});
test('F5 too few figures is "No read", and the line never advises', () => {
  const w = weatherOf([], '2026-11-13', 0); assert.equal(w.word, 'No read'); assert.match(w.line, /^No read/);
  for (const t of [weatherOf(ROWS, '2026-11-13', 0).line, w.line]) assert.doesNotMatch(t, /\b(buy|sell|should|expect|will rise|will fall)\b/i);
});
