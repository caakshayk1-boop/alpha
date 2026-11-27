// 27 Nov 2026: the Data status rule, on fixed IST clock times. 24 Nov 2026 was an NSE holiday.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictOf, verdictWord, lastSessionPast, sessionsBetween, DUE_MIN, CLOSE_MIN } from '../src/lib/datastatus.ts';

const at = (d: number, h: number, m = 0) => Date.UTC(2026, 10, d, h, m) - 330 * 60000;      // Nov 2026, in IST
test('data for a session is due at 23:30 IST, not at the close', () => {
  assert.equal(lastSessionPast(at(26, 16), DUE_MIN), '2026-11-25', 'Thursday 16:00: the 26th has closed but its data is not yet due');
  assert.equal(lastSessionPast(at(26, 23, 45), DUE_MIN), '2026-11-26');
  assert.equal(lastSessionPast(at(26, 16), CLOSE_MIN), '2026-11-26');
  assert.equal(lastSessionPast(at(28, 12), DUE_MIN), '2026-11-27', 'a Saturday points at Friday');
  assert.equal(lastSessionPast(at(25, 9), DUE_MIN), '2026-11-23', 'the morning after the 24 Nov holiday: Monday 23 Nov is the last due session');
});
test('sessions behind are counted on the exchange calendar', () => {
  assert.equal(sessionsBetween('2026-11-20', '2026-11-26'), 3, '23, 25 and 26 Nov: the 24th was a holiday');
  assert.equal(sessionsBetween('2026-11-26', '2026-11-26'), 0);
});
test('a daily dataset is current when it describes the last due session or a later one', () => {
  assert.equal(verdictOf('2026-11-26', at(27, 10)).state, 'current');
  assert.equal(verdictOf('2026-11-25', at(26, 16)).state, 'current', 'the 26th is still being built; the 25th is what is due');
  const v = verdictOf('2026-11-25', at(27, 10)); assert.equal(v.state, 'behind'); assert.equal(v.behind, 1); assert.equal(verdictWord(v), '1 session behind');
  assert.equal(verdictWord(verdictOf('2026-11-20', at(27, 10))), '3 sessions behind');
});
test('a weekly dataset is current for nine days', () => {
  assert.equal(verdictOf('2026-11-24', at(27, 10), 'weekly').state, 'current');
  const v = verdictOf('2026-11-10', at(27, 10), 'weekly'); assert.equal(v.state, 'behind'); assert.equal(verdictWord(v), '17 days behind');
});
test('an unreadable, missing or future date is never current', () => {
  for (const d of [null, undefined, '', 'yesterday', '2026-12-30']) { const v = verdictOf(d as string, at(27, 10)); assert.equal(v.state, 'unknown'); assert.equal(verdictWord(v), 'Date could not be read'); }
});
