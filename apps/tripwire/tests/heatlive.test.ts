import test from 'node:test';
import assert from 'node:assert/strict';
import { liveSample, liveHeat, liveUsable, istTime } from '../src/heatlive.ts';
import { sectorHeat } from '../src/sectorheat.ts';
import type { Row } from '../src/screen.ts';
import type { Quote } from '../src/data.ts';

const NOW = Date.parse('2026-11-16T05:30:00Z');   // Monday 11:00 IST, the session is on
const R = (sym: string, sector: string, turnover: number, extra: Partial<Row> = {}): Row => ({ sym, name: sym, sector, liquid: true, turnover_cr: turnover, price: 100, r1d: 0.5, ...extra } as Row);
const Q = (px: number, prev: number, ageSec = 60): Quote => ({ t: [], c: [], px, prev, pt: NOW / 1000 - ageSec, live: true });
const rows: Row[] = [
  R('A1', 'Tech', 500), R('A2', 'Tech', 400), R('A3', 'Tech', 300), R('A4', 'Tech', 10),
  R('B1', 'Bank', 900), R('B2', 'Bank', 100), R('B3', 'Bank', 50),
  R('Z1', 'Tech', 9999, { liquid: false }), R('Z2', 'Tech', 9999, { stale: true }), R('Z3', 'Tech', 9999, { sector: null }), R('Z4', 'Tech', 0),
];

test('the sample is the top names by traded value per sector; illiquid, stale, sector-less and zero-turnover rows are never in it', () => {
  assert.deepEqual(liveSample(rows, 2), ['A1', 'A2', 'B1', 'B2']);
  assert.deepEqual(liveSample(rows, 6).sort(), ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3']);
});
test('the live change is price over previous close; the rows are the model rows with r1d replaced', () => {
  const h = liveHeat(rows, ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'], { A1: Q(102, 100), A2: Q(99, 100), A3: Q(101, 100), B1: Q(103, 100), B2: Q(100, 100), B3: Q(98, 100) }, NOW);
  assert.equal(h.measured, 6); assert.equal(h.asked, 6);
  assert.deepEqual(h.rows.map((r) => [r.sym, Math.round(r.r1d! * 100) / 100]), [['A1', 2], ['A2', -1], ['A3', 1], ['B1', 3], ['B2', 0], ['B3', -2]]);
  const tech = sectorHeat(h.rows, 'r1d').find((s) => s.sector === 'Tech')!;   // turnover-weighted: (2*500 + -1*400 + 1*300) / 1200
  assert.equal(Math.round(tech.chg * 1e6) / 1e6, Math.round(((2 * 500 - 1 * 400 + 1 * 300) / 1200) * 1e6) / 1e6);
});
test('a missing, stale, malformed or non-positive quote leaves the name out; it is never read as zero', () => {
  const h = liveHeat(rows, ['A1', 'A2', 'A3', 'B1'], { A1: Q(102, 100), A2: null, A3: Q(101, 100, 3600), B1: Q(NaN, 100) }, NOW);
  assert.deepEqual(h.rows.map((r) => r.sym), ['A1']); assert.equal(h.measured, 1);
  assert.equal(liveHeat(rows, ['A1'], { A1: Q(100, 0) }, NOW).measured, 0); assert.equal(liveHeat(rows, ['A1'], { A1: Q(-1, 100) }, NOW).measured, 0);
});
test('a shut market has no LIVE print; with shut=true only prints dated today count, and the basis says so', () => {
  const shut = Date.parse('2026-11-16T17:30:00Z');   // 23:00 IST Monday
  assert.equal(liveHeat(rows, ['A1'], { A1: { ...Q(102, 100), pt: shut / 1000 - 30 } }, shut).measured, 0, 'not live');
  const t = liveHeat(rows, ['A1', 'B1'], { A1: { ...Q(102, 100), pt: Date.parse('2026-11-16T09:59:00Z') / 1000 }, B1: { ...Q(103, 100), pt: Date.parse('2026-11-16T10:02:00Z') / 1000 } }, shut, true);
  assert.equal(t.measured, 2); assert.equal(t.basis, 'today'); assert.equal(t.obs, Date.parse('2026-11-16T10:02:00Z') / 1000);
  const old = liveHeat(rows, ['A1'], { A1: { ...Q(102, 100), pt: Date.parse('2026-11-13T09:59:00Z') / 1000 } }, shut, true);
  assert.equal(old.measured, 0, "Friday's print is not today's");
  const morning = Date.parse('2026-11-16T02:00:00Z');   // 07:30 IST, before the open: yesterday's prints are not today's
  assert.equal(liveHeat(rows, ['A1'], { A1: { ...Q(102, 100), pt: Date.parse('2026-11-13T09:59:00Z') / 1000 } }, morning, true).measured, 0);
  assert.equal(liveHeat(rows, ['A1'], { A1: Q(102, 100) }, NOW).basis, 'live');
});
test('share is the measured names\' part of ALL liquid traded value (stale and illiquid rows excluded from both sides)', () => {
  const h = liveHeat(rows, ['A1', 'B1'], { A1: Q(101, 100), B1: Q(101, 100) }, NOW);
  assert.equal(h.share, (500 + 900) / (500 + 400 + 300 + 10 + 900 + 100 + 50));
});
test('the live view is offered only when most of the sample answered', () => {
  const mk = (asked: number, measured: number) => ({ rows: [], asked, measured, share: 0, obs: null, basis: 'live' as const });
  assert.equal(liveUsable(mk(66, 39)), false); assert.equal(liveUsable(mk(66, 40)), true); assert.equal(liveUsable(mk(10, 10)), false, 'at least 12 names'); assert.equal(liveUsable(mk(0, 0)), false);
});
test('print time is shown on the Indian clock', () => { assert.equal(istTime(Date.parse('2026-11-16T05:30:00Z') / 1000), '11:00 IST'); assert.equal(istTime(Date.parse('2026-11-16T20:00:00Z') / 1000), '01:30 IST'); });
