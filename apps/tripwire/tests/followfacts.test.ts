// What the Desk says about a followed company: only facts worth a glance, most useful first, never a figure the screen does not carry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followFacts, BIG_MOVE_PCT } from '../src/followfacts.ts';
import type { Row } from '../src/screen.ts';

const TODAY = '2026-11-03';
const base: Row = { sym: 'ABC', name: 'ABC Ltd.', price: 100, r1d: 0.4, r3m: 5, from_high: -8, low52: 60, high52: 110, rsi: 55, sma20: 99, sma50: 98, sma200: 90, next_earnings: null };

test('a quiet company shows its trend and nothing invented', () => {
  const f = followFacts({ ...base, price: 105, sma20: 101, sma50: 99, sma200: 95 }, TODAY); assert.deepEqual(f.map((x) => x.id), ['trend']); assert.equal(f[0].text, 'In an uptrend');
  assert.deepEqual(followFacts({ ...base, price: null, sma20: null, from_high: null, low52: null, rsi: null, r1d: null, r3m: null }, TODAY), [], 'no figures, no facts');
});

test('results: today, tomorrow and a countdown inside 30 days; nothing for a past, far or malformed date', () => {
  const at = (d: string | null) => followFacts({ ...base, next_earnings: d }, TODAY).find((x) => x.id === 'results')?.text;
  assert.equal(at('2026-11-03'), 'Results expected today'); assert.equal(at('2026-11-04'), 'Results expected tomorrow'); assert.match(at('2026-11-12') ?? '', /in 9 days/); assert.match(at('2026-12-03') ?? '', /in 30 days/);
  assert.equal(at('2026-12-04'), undefined, '31 days is too far'); assert.equal(at('2026-11-02'), undefined, 'a date in the past is not an upcoming result'); assert.equal(at('soon'), undefined); assert.equal(at(null), undefined);
});

test('a big move is named with its direction and size; a small one is not', () => {
  const up = followFacts({ ...base, r1d: 4.26 }, TODAY).find((x) => x.id === 'move'); assert.equal(up?.text, 'Up 4.3% in the last session'); assert.equal(up?.tone, 'up');
  assert.equal(followFacts({ ...base, r1d: -BIG_MOVE_PCT }, TODAY).find((x) => x.id === 'move')?.tone, 'down'); assert.equal(followFacts({ ...base, r1d: 2.9 }, TODAY).some((x) => x.id === 'move'), false);
});

test('the 52-week range: at the high, near the low, or far below the high; one statement, never two', () => {
  const ids = (o: Partial<Row>) => followFacts({ ...base, ...o }, TODAY, 9).filter((x) => x.id === 'high' || x.id === 'low').map((x) => x.text);
  assert.deepEqual(ids({ from_high: -0.4 }), ['At its 52-week high']); assert.deepEqual(ids({ from_high: -40, price: 62, low52: 60 }), ['Near its 52-week low']);
  assert.deepEqual(ids({ from_high: -31.6, price: 70 }), ['32% below its 52-week high']); assert.deepEqual(ids({ from_high: -8 }), [], 'an ordinary distance is not worth saying');
});

test('RSI is mentioned only at its extremes, in plain words', () => {
  const r = (v: number) => followFacts({ ...base, rsi: v }, TODAY, 9).find((x) => x.id === 'rsi')?.text;
  assert.equal(r(74.4), 'RSI 74: stretched'); assert.equal(r(70), 'RSI 70: stretched'); assert.equal(r(25.6), 'RSI 26: washed out'); assert.equal(r(55), undefined);
});

test('at most three facts, most useful first (results, move, range, RSI, trend)', () => {
  const busy: Row = { ...base, next_earnings: '2026-11-05', r1d: -5, from_high: -35, rsi: 25, sma20: 90, sma50: 95, sma200: 100, price: 85, r3m: -9 };
  const f = followFacts(busy, TODAY); assert.equal(f.length, 3); assert.deepEqual(f.map((x) => x.id), ['results', 'move', 'high']);
  assert.deepEqual(followFacts(busy, TODAY, 9).map((x) => x.id), ['results', 'move', 'high', 'rsi', 'trend']); assert.deepEqual(followFacts(busy, TODAY, 0), []);
});
