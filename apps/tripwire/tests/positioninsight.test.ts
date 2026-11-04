import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionInsight } from '../src/positioninsight.ts';
import type { View } from '../src/tracker.ts';

const view = (o: Partial<View> = {}): View => ({ id: 'p', status: 'open', entry: 61.11, mark: 66.71, markKind: 'live', pnl: 8809, r: 0.96, pct: 8.8, sessions: 7, left: 13, ...o } as View);
const ladder = (o = {}) => ({ t1: 69.49, t2: 77.88, t1Hit: false, t2Hit: false, booked: 0, qtyLeft: 1638, stop: 55.52, ...o });
const p = { stop: 55.52, horizon: 20 };

test('the SBC card from the screenshot: distances recomputed from its own levels', () => {
  const i = positionInsight(view({ ladder: ladder() }), p)!;
  assert.ok(Math.abs(i.stopPct! - ((66.71 - 55.52) / 66.71) * 100) < 1e-9);          // 11.19 / 66.71 = 16.77%
  assert.equal(i.nextTarget!.label, 'T1'); assert.ok(Math.abs(i.nextTarget!.pct - (69.49 / 66.71 - 1) * 100) < 1e-9);   // 4.17%
  assert.equal(i.line, 'Above entry (+1.0R), 16.8% above the stop. 4.2% to T1 (₹69.49). 13 sessions left on its time limit.');
  assert.deepEqual(i.badges, []);
});
test('after T1 fills the next target is T2 and the stop is the entry', () => {
  const i = positionInsight(view({ mark: 70, r: 1.4, ladder: ladder({ t1Hit: true, stop: 61.11 }) }), p)!;
  assert.equal(i.nextTarget!.label, 'T2'); assert.equal(i.stop, 61.11); assert.ok(i.badges.includes('T1 filled')); assert.match(i.line, /to T2 \(₹77\.88\)/);
  assert.equal(positionInsight(view({ mark: 80, ladder: ladder({ t1Hit: true, t2Hit: true }) }), p)!.line.includes('Both targets have filled.'), true);
});
test('near the stop, below entry, and the last sessions are said plainly', () => {
  const near = positionInsight(view({ mark: 56.4, r: -0.85, ladder: ladder() }), p)!; assert.ok(near.badges.includes('Near the stop')); assert.match(near.line, /^Close to the stop: 1\.6% above ₹55\.52\./);
  const below = positionInsight(view({ mark: 58, r: -0.4, ladder: ladder() }), p)!; assert.match(below.line, /^Below entry \(-0\.4R\), 4\.3% above the stop\./);
  const late = positionInsight(view({ left: 1 }), p)!; assert.ok(late.badges.includes('Time limit close')); assert.match(late.line, /1 session left on its time limit\./);
});
test('no price, no entry, or a position that is not open: nothing is said', () => {
  for (const v of [view({ status: 'closed' }), view({ mark: null }), view({ entry: undefined }), view({ status: 'pending' })]) assert.equal(positionInsight(v, p), null);
});
test('it describes and never advises: no buy, sell, hold, should, likely or will in any line', () => {
  for (const v of [view({ ladder: ladder() }), view({ mark: 56.4, r: -0.85, ladder: ladder() }), view({ left: 1 }), view({ r: null })]) assert.ok(!/\b(buy|sell|hold|should|likely|will|expect)\b/i.test(positionInsight(v, p)!.line));
});
test('a live mark through the stop is said to be below it, with no exit claimed; at the stop is "At"', () => {
  const through = positionInsight(view({ mark: 54.0, r: -1.3, ladder: ladder() }), p)!;   // (54 - 55.52) / 54 = -2.81%
  assert.ok(through.stopPct! < 0); assert.ok(through.badges.includes('Through the stop')); assert.ok(!through.badges.includes('Near the stop'));
  assert.match(through.line, /^2\.8% below the stop \(₹55\.52\)\. No exit is recorded yet/); assert.ok(!/above the stop|Close to the stop/.test(through.line));
  const at = positionInsight(view({ mark: 55.52, r: -1, ladder: ladder() }), p)!; assert.match(at.line, /^At the stop \(₹55\.52\)\./);
});
test('a target below the live mark is not promised a fill', () => {
  const i = positionInsight(view({ mark: 71, r: 1.7, ladder: ladder() }), p)!;   // T1 69.49 is under the mark but the bars have not confirmed it
  assert.match(i.line, /T1 \(₹69\.49\) is below the price; its fill is not confirmed until the daily bars record it\./); assert.ok(!/fills on|will fill/.test(i.line));
});
