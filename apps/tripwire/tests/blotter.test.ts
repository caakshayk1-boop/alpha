import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lines, totals, dayCurve, riskLens } from '../src/blotter.ts';
import type { BookRow } from '../src/book.ts';

const T0 = Date.UTC(2026, 9, 26, 3, 45) / 1000;                            // 09:15 IST
const q = (c: number[], prev: number, pt?: number) => ({ t: c.map((_, i) => T0 + i * 300), c, px: c[c.length - 1], pt: pt ?? T0 + (c.length - 1) * 300, prev, live: true });
const row = (sym: string, qty: number, entry: number, mark: number, o: Partial<BookRow['v']> = {}, qq: ReturnType<typeof q> | null = null, horizon = 20): BookRow => ({
  p: { id: sym, sym, engine: 'MOM', asOf: '2026-10-23', ref: entry, stop: entry * 0.9, horizon, qty, takenAt: 0 }, dayPnl: null, q: qq,
  v: { id: sym, status: 'open', entry, entryT: T0 - 86400 * 2, mark, markKind: 'live', pnl: (mark - entry) * qty, r: 1, pct: ((mark / entry) - 1) * 100, sessions: 2, left: 18, ...o } });

test('blotter: only open positions with a mark become lines; the distance to the stop is from the LAST price', () => {
  const rows = [row('AAA', 10, 100, 110), { ...row('BBB', 5, 50, 50), v: { ...row('BBB', 5, 50, 50).v, status: 'pending' as const } }];
  const ls = lines(rows); assert.equal(ls.length, 1); assert.equal(ls[0].toStop, -18.18);              // stop 90 against a last price of 110: (90 - 110) / 110
  assert.equal(ls[0].value, 1100); assert.equal(ls[0].style, 'swing');
});
test('blotter: a position on a profit ladder shows its remaining shares, the moved stop and only the targets still open', () => {
  const v = { ladder: { t1: 115, t2: 130, t1Hit: true, t2Hit: false, booked: 75, qtyLeft: 5, stop: 100 } };
  const l = lines([row('LAD', 10, 100, 120, v)])[0]; assert.equal(l.qty, 5); assert.equal(l.stop, 100); assert.equal(l.toT1, null); assert.equal(l.toT2, 8.33); assert.equal(l.t1Hit, true); assert.equal(l.value, 600);
});
test('blotter: totals add the lines and name the best and worst', () => {
  const ls = lines([row('AAA', 10, 100, 110), row('BBB', 10, 100, 95)]); const t = totals(ls);
  assert.equal(t.pnl, 50); assert.equal(t.cost, 2000); assert.equal(t.pct, 2.5); assert.equal(t.best!.sym, 'AAA'); assert.equal(t.worst!.sym, 'BBB'); assert.equal(t.dayPnl, null, 'no day figure when none is measured');
});
test('day curve: base is the previous close for an older position and the fill for one entered today; the last point is the day total', () => {
  const a = row('AAA', 10, 100, 103, {}, q([101, 102, 103], 100));                                       // entered two days ago: base 100 (previous close)
  const b = row('BBB', 4, 50, 52, { entryT: T0 + 5 }, q([50.5, 51, 52], 49));                           // entered today: base is the fill, 50
  const c = dayCurve([a, b]); assert.equal(c.length, 3);
  assert.deepEqual(c.map((p) => p.v), [10 * 1 + 4 * 0.5, 10 * 2 + 4 * 1, 10 * 3 + 4 * 2]);              // 12, 28, 38
  assert.equal(dayCurve([row('X', 1, 1, 1)]).length, 0, 'no intraday series, no curve');
});
test('day curve: a name with no print yet at a stamp contributes zero, then joins', () => {
  const a = row('AAA', 10, 100, 102, {}, q([101, 102], 100)); const late = { ...q([55, 56], 54), t: [T0 + 300, T0 + 600] };
  const b = row('BBB', 1, 50, 56, {}, late as never); const c = dayCurve([a, b]);
  assert.deepEqual(c.map((p) => p.v), [10, 20 + 1 * (55 - 54), 20 + 2]);
});
test('risk lens: concentration, effective bets, and a perfectly co-moving book has correlation near one and no diversification in its bad day', () => {
  const days = Array.from({ length: 70 }, (_, i) => Date.UTC(2026, 6, 1 + i) / 1000); const walk = (seed: number) => { let x = 100; return days.map((_, i) => (x *= 1 + Math.sin(i * seed) * 0.02)); };
  const same = walk(0.7); const closes = { AAA: { t: days, c: same }, BBB: { t: days, c: same.map((v) => v * 2) }, CCC: { t: days, c: walk(1.9) } };
  const ls = lines([row('AAA', 10, 100, 100), row('BBB', 5, 200, 200), row('CCC', 10, 100, 100)]);
  const r = riskLens(ls, (s) => (s === 'CCC' ? 'Energy' : 'Technology'), closes);
  assert.equal(r.topSector!.name, 'Technology'); assert.equal(r.topSector!.pct, 66.67); assert.equal(r.topPosition!.pct, 33.33);
  assert.equal(r.effectiveBets, 3); assert.equal(r.sessions, 60); assert.ok(r.avgCorrelation !== null && r.avgCorrelation < 1 && r.avgCorrelation > -1);
  assert.ok(r.worstDay! <= r.badDay! && r.vol! > 0);
  const one = riskLens(lines([row('AAA', 10, 100, 100), row('BBB', 5, 200, 200)]), () => 'X', closes); assert.ok(one.avgCorrelation! > 0.999, 'two scaled copies of one series move together');
  assert.equal(riskLens(ls, () => null, { AAA: { t: days.slice(0, 10), c: same.slice(0, 10) } }).sessions, 0, 'too little history says nothing');
});
