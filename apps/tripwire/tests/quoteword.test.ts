// One vocabulary for a price: Live / Delayed / Last traded / Unavailable, from the exchange print time and the session. Fetch time decides nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteAge, quoteWord, markWord, freshestPrint, isLiveQuote } from '../src/stamp.ts';
import { holidayStatement, HOLIDAYS, CALENDAR, holidayName } from '../src/calendar.ts';
import { livePrice } from '../src/quotes.ts';

const at = (iso: string) => Date.parse(iso);
const OPEN = at('2026-10-26T09:02:00Z');           // Mon 14:32 IST, session on
const sec = (ms: number) => ms / 1000;

test('open session: a print under five minutes is Live, older is Delayed (with and without a holiday-blaming sentence)', () => {
  assert.equal(quoteWord(sec(OPEN) - 30, OPEN), 'Live');
  assert.equal(quoteWord(sec(OPEN) - 4 * 60, OPEN), 'Live');
  assert.equal(quoteWord(sec(OPEN) - 12 * 60, OPEN), 'Delayed');
  const stale = quoteAge(sec(OPEN) - 45 * 60, OPEN)!; assert.equal(stale.word, 'Delayed'); assert.equal(stale.state, 'stale');
  assert.match(stale.text, /not a listed holiday/); assert.doesNotMatch(stale.text, /A holiday, or/);
});
test('a closed market is never Live, however fresh the print: 15:31 with a 15:29:50 print is Last traded', () => {
  const t1531 = at('2026-10-26T10:01:00Z'); const print = at('2026-10-26T09:59:50Z') / 1000;
  const a = quoteAge(print, t1531)!; assert.equal(a.word, 'Last traded'); assert.equal(a.state, 'last'); assert.match(a.text, /^Last traded 15:29 IST$/);
  assert.equal(isLiveQuote({ pt: print }, t1531), false);
  const pre = at('2026-10-26T03:40:00Z'); assert.equal(quoteWord(pre / 1000 - 20, pre), 'Last traded', 'before 09:15 a fresh print is not Live either');
});
test('weekend: Last traded with the print date, never Delayed or Live', () => {
  const sun = at('2026-11-01T07:00:00Z'); const fri = at('2026-10-30T10:00:00Z') / 1000;
  const a = quoteAge(fri, sun)!; assert.equal(a.word, 'Last traded'); assert.match(a.text, /Fri 30 Oct 15:30 IST/);
});
test('exchange holiday (calendar.ts): Tuesday 20 Oct 2026 (Dussehra) at 11:00 IST is shut, so even a "fresh" print is Last traded', () => {
  const day = '2026-10-20'; assert.ok(holidayName(day)); const now = at('2026-10-20T05:30:00Z');
  assert.equal(quoteWord(now / 1000 - 10, now), 'Last traded');
  const trading = at('2026-10-21T05:30:00Z'); assert.equal(quoteWord(trading / 1000 - 10, trading), 'Live', 'the next day is an ordinary session');
});
test('a listed special session (Muhurat, Sun 8 Nov 2026) can show a current print as Live: the ordinary clock is not the only evidence', () => {
  const now = at('2026-11-08T12:35:00Z'); assert.equal(quoteWord(now / 1000 - 20, now), 'Live');
  assert.equal(quoteWord(now / 1000 - 3 * 3600, now), 'Delayed');
});
test('round-the-clock markets (nse=false) are judged by print age alone: Live on a Sunday if the print is fresh; Last traded when it has gone quiet', () => {
  const sun = at('2026-11-01T07:00:00Z');
  assert.equal(quoteWord(sec(sun) - 60, sun, { nse: false }), 'Live'); assert.equal(quoteWord(sec(sun) - 3 * 3600, sun, { nse: false }), 'Last traded');
  assert.equal(isLiveQuote({ pt: sec(sun) - 60 }, sun, false), true); assert.equal(isLiveQuote({ pt: sec(sun) - 60 }, sun), false);
});
test('no print time: Unavailable once loading has finished; null (nothing claimed) while it is still loading', () => {
  assert.equal(quoteWord(null, OPEN), 'Unavailable'); assert.equal(quoteWord(undefined, OPEN, { loading: true }), null); assert.equal(quoteWord(Number.NaN, OPEN), 'Unavailable');
  assert.equal(quoteWord(sec(OPEN) - 30, OPEN, { loading: true }), 'Live', 'a print that exists is judged even while a refresh is running');
});
test('fetch time never implies freshness: the same 14:02 print read at 14:32 is Delayed however recently it was refetched', () => {
  const print = at('2026-10-26T08:32:00Z') / 1000; assert.equal(quoteWord(print, OPEN), 'Delayed');
});
test('a position mark: judged by its print when live, a daily close is Delayed in-session and Last traded when shut, none is Unavailable', () => {
  assert.equal(markWord('live', sec(OPEN) - 30, OPEN).word, 'Live');
  const sun = at('2026-11-01T07:00:00Z'); const fri = at('2026-10-30T09:59:00Z') / 1000;
  assert.equal(markWord('live', fri, sun).word, 'Last traded', 'a mark taken from Friday\'s last print is not live on Sunday');
  assert.equal(markWord('close', null, sun).word, 'Last traded'); assert.equal(markWord('close', null, OPEN).word, 'Delayed');
  assert.equal(markWord(null, null, OPEN).word, 'Unavailable'); assert.equal(markWord('live', null, OPEN).word, 'Last traded');
});
test('the freshest print of a book decides its word; none at all is null', () => {
  assert.equal(freshestPrint([null, 100, undefined, 250, Number.NaN]), 250); assert.equal(freshestPrint([null, undefined]), null);
});
test('livePrice carries the word: after the close the same quote that was Live is Last traded', () => {
  const row = { price: 100, r1d: 0, last_date: '2026-10-26' }; const q = { t: [1], c: [1], px: 101, pt: sec(OPEN) - 20, prev: 100, live: true };
  assert.equal(livePrice(row, q, OPEN).word, 'Live'); assert.equal(livePrice(row, q, OPEN + 3 * 3600e3).word, 'Last traded'); assert.equal(livePrice(row, null, OPEN).word, 'Unavailable');
});
test('holidays: ONE statement, built from calendar.ts, says they are modelled and never says they are not', () => {
  const s = holidayStatement(); assert.match(s, /Exchange holidays are modelled/); assert.ok(s.includes(CALENDAR.version)); assert.ok(s.includes(`${Object.keys(HOLIDAYS).length} NSE`));
  assert.doesNotMatch(s, /not modelled\.|are not modelled/); assert.match(s, /covers 2026 only/);
});
