import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayGeometry, sessionBounds, hhmm, MIN_SPAN } from '../src/daychart.ts';

const OPEN = Date.parse('2026-11-04T09:15:00+05:30') / 1000, CLOSE = Date.parse('2026-11-04T15:30:00+05:30') / 1000;
// twelve five-minute closes from 09:20 to 10:15 IST on 4 Nov 2026, a thin stock that moved a few paise
const t = Array.from({ length: 12 }, (_, i) => OPEN + 300 * (i + 1));
const c = [66.71, 66.66, 66.58, 66.6, 66.72, 66.8, 66.85, 66.82, 66.9, 66.88, 66.86, 66.9];

test('the session axis is 09:15 to 15:30 IST on the Indian date of the data', () => {
  const b = sessionBounds(t[0]); assert.equal(b.start, OPEN); assert.equal(b.end, CLOSE); assert.equal(CLOSE - OPEN, 375 * 60);
  assert.equal(sessionBounds(Date.parse('2026-11-04T02:00:00Z') / 1000).start, OPEN, '07:30 IST is still the same Indian day');
  assert.equal(hhmm(OPEN), '09:15'); assert.equal(hhmm(CLOSE), '15:30');
});
test('a half-finished day is drawn as half a day: the last point sits where its time says', () => {
  const g = dayGeometry({ t, c, prev: 66.71 }, 320, 168)!; const frac = (t[11] - OPEN) / (CLOSE - OPEN);   // (10:15 - 09:15) / 375 min = 60/375 = 0.16
  assert.ok(Math.abs(frac - 0.16) < 1e-9); assert.ok(Math.abs(g.elapsed - 0.16) < 1e-9);
  const iw = 320 - g.pad.l - g.pad.r; assert.ok(Math.abs(g.last.x - (g.pad.l + iw * ((t[11] - OPEN) / (CLOSE - OPEN)))) < 1e-6);
  assert.ok(g.last.x < 320 * 0.3, 'the line ends in the left third of the chart, not at the right edge');
});
test('the vertical scale is today and the previous close: the entry and the stop never stretch it (the flat-line fault)', () => {
  const g = dayGeometry({ t, c, prev: 66.71 }, 320, 168)!; const entry = 61.11, stop = 55.52;
  assert.ok(g.lo > 66 && g.hi < 67.4, `range ${g.lo.toFixed(2)} to ${g.hi.toFixed(2)} follows today's 66.58 to 66.90`);
  assert.equal(g.where(entry), 'below'); assert.equal(g.where(stop), 'below'); assert.equal(g.where(66.7), 'in'); assert.equal(g.where(70), 'above');
  const ys = g.pts.map((p) => p.y), used = (Math.max(...ys) - Math.min(...ys)) / (168 - g.pad.t - g.pad.b);
  assert.ok(used > 0.55, `today's move uses ${(used * 100).toFixed(0)}% of the chart height, not a flat line (the old chart used under 10%)`);
  const old = (() => { const lo = 61.11, hi = 66.9; return (Math.max(...c) - Math.min(...c)) / (hi - lo); })(); assert.ok(old < 0.07, `for comparison the old scale gave ${(old * 100).toFixed(1)}%`);
});
test('open, high, low and last are the real points; the previous close baseline is where its price says', () => {
  const g = dayGeometry({ t, c, prev: 66.71 }, 320, 168)!;
  assert.equal(g.open.c, 66.71); assert.equal(g.high.c, 66.9); assert.equal(g.low.c, 66.58); assert.equal(g.last.c, 66.9);
  assert.ok(g.high.y < g.low.y && g.high.y < g.baseY && g.low.y > g.baseY, 'higher is up the page; the previous close sits between the low and the high');
  assert.equal(g.nearest(g.pts[5].x + 0.2), 5); assert.equal(g.nearest(-50), 0); assert.equal(g.nearest(9999), 11);
});
test('a very quiet day is not blown up into noise: the range is never smaller than 0.4% of the previous close', () => {
  const flat = dayGeometry({ t, c: c.map(() => 100), prev: 100 }, 320, 168)!; assert.ok(flat.hi - flat.lo >= 100 * MIN_SPAN - 1e-9);
  assert.ok(flat.hi > 100 && flat.lo < 100, 'centred on the previous close');
});
test('markets that trade round the clock use the data\'s own extent; bad input draws nothing', () => {
  const t2 = [1000, 4600, 8200, 11800]; const g = dayGeometry({ t: t2, c: [10, 11, 10.5, 12], prev: 10, nse: false }, 100, 40, { l: 0, r: 0, t: 0, b: 0 })!;
  assert.equal(g.start, 1000); assert.equal(g.end, 11800); assert.equal(g.elapsed, 1); assert.equal(g.pts[0].x, 0); assert.equal(g.last.x, 100);
  assert.equal(dayGeometry({ t: [1], c: [1], prev: 1 }, 100, 40), null); assert.equal(dayGeometry({ t, c, prev: 0 }, 100, 40), null);
  assert.equal(dayGeometry({ t: [t[1], t[0], t[2]], c: [2, 1, NaN], prev: 1.5 }, 100, 40)!.pts.length, 2, 'unreadable points are dropped and the rest sorted by time');
});
test('prints outside the session (a pre-open print) widen the axis rather than falling off it', () => {
  const g = dayGeometry({ t: [OPEN - 600, ...t], c: [66.7, ...c], prev: 66.71 }, 320, 168)!; assert.ok(g.start < OPEN); assert.ok(g.pts[0].x >= g.pad.l - 1e-9);
});
