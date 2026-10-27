import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { HOLIDAYS, SPECIAL, covered, isTradingDay, lastFinishedSession, marketOpenNow, nextSession, prevSession, sessionsBetween, closureToday, calendarNote } from '../src/calendar.ts';
import { sessionNow } from '../src/market.ts';
import { sessionsBehind, freshness } from '../src/fresh.ts';
import { nseClockOpen } from '../src/stamp.ts';

const ist = (iso: string, h: number, m = 0) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h, m) - 330 * 60000;   // an Indian wall time as a UTC instant

test('calendar: the published 2026 equity holidays are all weekdays, sixteen of them, and none is a Saturday or Sunday', () => {
  const days = Object.keys(HOLIDAYS); assert.equal(days.length, 16);
  for (const d of days) { const wd = new Date(d + 'T00:00:00Z').getUTCDay(); assert.ok(wd >= 1 && wd <= 5, `${d} is a weekend day, which the circular lists as a weekday closure`); assert.ok(covered(d)); }
});
test('calendar: against the sessions the Nifty actually traded, every 2026 weekday gap is a listed holiday and no listed holiday traded', { skip: !existsSync(new URL('../research/results/lab_panel.json', import.meta.url)) }, () => {
  const dates: string[] = JSON.parse(readFileSync(new URL('../research/results/lab_panel.json', import.meta.url), 'utf8')).dates; const have = new Set(dates); const last = dates[dates.length - 1];
  for (let t = Date.UTC(2026, 0, 1); t <= Date.parse(last + 'T00:00:00Z'); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10); const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue;
    assert.equal(isTradingDay(d), have.has(d), `${d}: the calendar says ${isTradingDay(d) ? 'a session' : 'shut'} and the Nifty ${have.has(d) ? 'traded' : 'did not'}`);
  }
});
test('calendar: neighbours skip weekends and holidays; sessions are counted without the shut days', () => {
  assert.equal(prevSession('2026-10-21'), '2026-10-19', 'Dussehra, Tuesday 20 Oct, is skipped'); assert.equal(nextSession('2026-10-19'), '2026-10-21');
  assert.equal(nextSession('2026-10-30'), '2026-11-02'); assert.equal(nextSession('2026-11-09'), '2026-11-11', 'Tuesday 10 Nov is a holiday');
  assert.equal(sessionsBetween('2026-10-19', '2026-10-21'), 1); assert.equal(sessionsBetween('2026-10-23', '2026-10-27'), 2, 'Fri to Tue: Monday and Tuesday');
  assert.equal(isTradingDay('2026-11-08'), false, 'the Muhurat Sunday is not an ordinary session'); assert.ok(SPECIAL['2026-11-08']);
});
test('calendar: the last finished session never lands on a shut day', () => {
  assert.equal(lastFinishedSession(ist('2026-10-21', 10, 0)), '2026-10-19', 'the morning after Dussehra, the last finished session is the Monday before it');
  assert.equal(lastFinishedSession(ist('2026-10-20', 18, 0)), '2026-10-19', 'on the holiday itself');
  assert.equal(lastFinishedSession(ist('2026-10-27', 15, 45)), '2026-10-26', 'before 16:00 the day has not been settled'); assert.equal(lastFinishedSession(ist('2026-10-27', 16, 5)), '2026-10-27');
  assert.equal(lastFinishedSession(ist('2026-10-25', 12, 0)), '2026-10-23', 'a Sunday');
});
test('freshness: a screen built on the last session before a holiday is current through the holiday, not "one session behind"', () => {
  assert.equal(sessionsBehind('2026-10-19', new Date(ist('2026-10-20', 20, 0))), 0); assert.equal(freshness('2026-10-19', new Date(ist('2026-10-20', 20, 0))).word, 'Current');
  assert.equal(sessionsBehind('2026-10-19', new Date(ist('2026-10-21', 18, 0))), 1, 'on the next trading evening it is one behind'); assert.equal(sessionsBehind('garbage'), null);
});
test('the header, the market-open test and the polling agree: shut on a holiday at 11:00 IST, open on an ordinary Tuesday', () => {
  const hol = ist('2026-10-20', 11, 0), ord = ist('2026-10-27', 11, 0);
  assert.equal(marketOpenNow(hol), false); assert.equal(nseClockOpen(hol), false); assert.equal(sessionNow(hol).phase, 'closed'); assert.equal(sessionNow(hol).label, 'NSE holiday'); assert.match(sessionNow(hol).detail, /Dussehra, opens tomorrow 9:15/);
  assert.equal(marketOpenNow(ord), true); assert.equal(nseClockOpen(ord), true); assert.equal(sessionNow(ord).phase, 'open');
  assert.equal(closureToday(hol), 'NSE holiday: Dussehra'); assert.equal(closureToday(ord), null);
});
test('a live print beats the calendar: if the exchange traded on a day the calendar lists, the page says open', () => assert.equal(sessionNow(ist('2026-10-20', 11, 0), true).phase, 'open'));
test('a year the calendar does not cover is not guessed: weekdays are sessions and the page is told the calendar ends', () => {
  assert.equal(covered('2027-01-26'), false); assert.equal(isTradingDay('2027-01-26'), true); assert.match(calendarNote(ist('2027-03-01', 10)) ?? '', /covers 2026 only/); assert.equal(calendarNote(ist('2026-10-27', 10)), null);
});
