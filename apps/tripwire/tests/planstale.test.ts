// 27 Nov 2026: a plan sized from an old close says how old it is. Fixed clock times; the NSE calendar makes 24 Nov 2026 a holiday.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stalePriceNote } from '../src/planview.ts';

const FRI_10AM_IST = Date.UTC(2026, 10, 27, 4, 30);     // Friday 27 Nov, 10:00 IST: the market is open; the last finished session is Thursday 26 Nov
const THU_6PM_IST = Date.UTC(2026, 10, 26, 12, 30);     // Thursday 26 Nov, 18:00 IST: the 26th has closed and its data is still being built

test('a close from the last finished session is current: no note', () => {
  assert.equal(stalePriceNote('2026-11-26', FRI_10AM_IST), null);
});
test('the session that just closed, still being built, is not called stale', () => {
  assert.equal(stalePriceNote('2026-11-25', THU_6PM_IST), null, 'one session behind inside the build window is pending, not stale');
});
test('an older close says exactly how many sessions behind, counting the exchange holiday correctly', () => {
  assert.match(stalePriceNote('2026-11-25', FRI_10AM_IST)!, /Wed 25 Nov, 1 session behind\./);
  assert.match(stalePriceNote('2026-11-20', FRI_10AM_IST)!, /Fri 20 Nov, 3 sessions behind\./, '23, 25 and 26 Nov: 24 Nov was a holiday');
});
test('the note tells the reader what to do, and says the plan was sized from it', () => {
  const t = stalePriceNote('2026-11-20', FRI_10AM_IST)!;
  assert.match(t, /sized from it/); assert.match(t, /Check the entry price/);
});
test('an unreadable, missing or future date is said to be unreadable, never treated as current', () => {
  for (const d of ['not a date', undefined, null, '2026-12-01']) assert.match(stalePriceNote(d as string, FRI_10AM_IST)!, /could not be read/);
});
