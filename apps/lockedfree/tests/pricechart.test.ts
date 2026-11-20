import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roll, weekKey, monthKey, byInterval, inRange, niceTicks, priceLabel, decimate, dateTicks, changeOver, signedPct, trendWords, type C } from '../src/lib/pricechart.ts';
const bar = (t: string, o: number, h: number, l: number, c: number, v: number | null = 10): C => ({ t, o, h, l, c, v });
const days = (n: number, start = '2025-01-01', f = (i: number) => 100 + i) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.parse(start + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10); const c = f(i); return bar(d, c - 1, c + 1, c - 2, c); });

test('weekly candles: first open, highest high, lowest low, last close, summed volume', () => {
  const d = [bar('2026-11-16', 100, 105, 99, 104, 5), bar('2026-11-17', 104, 110, 103, 108, 6), bar('2026-11-18', 108, 109, 95, 96, 7), bar('2026-11-23', 96, 97, 94, 95, 8)];
  const w = byInterval(d, 'W'); assert.equal(w.length, 2); assert.deepEqual({ o: w[0].o, h: w[0].h, l: w[0].l, c: w[0].c, v: w[0].v, t: w[0].t }, { o: 100, h: 110, l: 95, c: 96, v: 18, t: '2026-11-18' });
  assert.equal(weekKey('2026-11-22'), '2026-11-16'); assert.equal(monthKey('2026-11-22'), '2026-11'); assert.equal(byInterval(d, 'D'), d);
});
test('a missing volume on any day makes the rolled volume missing, never a partial sum', () => { assert.equal(roll([bar('2026-11-16', 1, 2, 1, 2, 5), bar('2026-11-17', 1, 2, 1, 2, null)], weekKey)[0].v, null); });
test('range keeps the bars within N days of the last bar; MAX keeps all', () => {
  const d = days(800); assert.equal(inRange(d, 'MAX').length, 800); const y = inRange(d, '1Y'); assert.ok(y.length >= 365 && y.length <= 367, String(y.length)); assert.equal(inRange(d, '1M').length >= 30, true); assert.equal(inRange(days(10), '1Y').length, 10);
});
test('axis ticks are round numbers that cover the data and have a sane count', () => {
  for (const [a, b] of [[481.15, 834.5], [0.12, 0.98], [1000, 1010], [19000, 25000], [5, 5.0001]] as [number, number][]) { const { ticks, step } = niceTicks(a, b, 5); assert.ok(ticks.length >= 2 && ticks.length <= 9, `${a}-${b}: ${ticks.length}`); assert.ok(ticks[0] >= a - 1e-9 && ticks.at(-1)! <= b + 1e-9); assert.ok(ticks.every((t) => Math.abs(t / step - Math.round(t / step)) < 1e-9)); }
  assert.deepEqual(niceTicks(481.15, 834.5, 5).ticks, [500, 600, 700, 800]); assert.equal(priceLabel(1234.5, 50), '1,235'); assert.equal(priceLabel(0.5, 0.1), '0.50'); assert.equal(priceLabel(-1e-13, 1000), '0');
});
test('decimation keeps the extremes and the last point, in order, and passes small series through', () => {
  const v = Array.from({ length: 5000 }, (_, i) => 100 + Math.sin(i / 40) * 20 + (i === 2500 ? 90 : 0) - (i === 3777 ? 70 : 0)); const idx = decimate(5000, 300, (i) => v[i], (i) => v[i]);
  assert.ok(idx.length < 900 && idx[0] === 0 && idx.at(-1) === 4999); assert.ok(idx.includes(2500) && idx.includes(3777)); assert.ok(idx.every((x, k) => k === 0 || x > idx[k - 1])); assert.equal(decimate(50, 300, (i) => i, (i) => i).length, 50);
});
test('date ticks: days for a month, month and year for a year, years for a decade; no duplicate labels', () => {
  const t1 = dateTicks(days(30)); assert.ok(/^\d+ [A-Z][a-z]{2}$/.test(t1[0].label)); const t2 = dateTicks(days(300)); assert.ok(/^[A-Z][a-z]{2} '\d\d$/.test(t2[0].label)); const t3 = dateTicks(days(4000)); assert.ok(t3.every((t) => /^20\d\d$/.test(t.label)) && t3.length <= 7);
  for (const t of [t1, t2, t3]) assert.equal(new Set(t.map((x) => x.label)).size, t.length);
});
test('change over the shown bars and its signed text', () => { assert.ok(Math.abs(changeOver([bar('a', 1, 1, 1, 100), bar('b', 1, 1, 1, 110)])! - 10) < 1e-9); assert.equal(changeOver([bar('a', 1, 1, 1, 100)]), null); assert.equal(signedPct(10), '▲ +10.00%'); assert.equal(signedPct(-2.345), '▼ −2.35%'); assert.equal(signedPct(null), '—'); });
test('trend in words from the closes only', () => {
  assert.match(trendWords(days(400, '2025-01-01', (i) => 100 + i)), /^Uptrend: above its 50 and 200-day averages · ▲ \+/); assert.match(trendWords(days(300, '2025-01-01', (i) => 500 - i)), /^Downtrend/); assert.match(trendWords(days(30)), /^Trend unclear/);
});
