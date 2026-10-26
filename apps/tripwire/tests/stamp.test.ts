import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteAge, isLiveQuote, fmtIst, nseClockOpen, ageWord } from '../src/stamp.ts';
import { livePrice } from '../src/quotes.ts';

// Monday 26 Oct 2026, 14:32 IST = 09:02 UTC
const MON_1432 = Date.UTC(2026, 9, 26, 9, 2, 0); const sec = (ms: number) => ms / 1000;
test('stamp: age is measured from the exchange print, so a refresh that returns the same print does not look fresh', () => {
  const print = sec(MON_1432) - 30;                                           // printed 30 s before 14:32
  assert.equal(quoteAge(print, MON_1432)!.state, 'live');
  assert.equal(quoteAge(print, MON_1432 + 4 * 60e3)!.state, 'live');         // 4 min later: still inside five minutes
  assert.equal(quoteAge(print, MON_1432 + 10 * 60e3)!.state, 'lagging');     // the app has refreshed many times since; the print has not moved
  const stale = quoteAge(print, MON_1432 + 40 * 60e3)!;
  assert.equal(stale.state, 'stale'); assert.match(stale.text, /No print since 14:31 IST/); assert.match(stale.text, /holiday, or the price source is quiet/);
});
test('stamp: outside the session an old print is the last print, not an error; round-the-clock markets are never "stale" by the Indian clock', () => {
  const fri = Date.UTC(2026, 9, 23, 9, 59, 0) / 1000;                         // Fri 15:29 IST
  const sun = Date.UTC(2026, 9, 25, 12, 0, 0);
  const a = quoteAge(fri, sun)!; assert.equal(a.state, 'last'); assert.match(a.text, /Last print Fri 23 Oct 15:29 IST/);
  assert.equal(quoteAge(sec(MON_1432) - 3 * 3600, MON_1432, false)!.state, 'last');
  assert.equal(quoteAge(null, MON_1432), null); assert.equal(quoteAge(Number.NaN, MON_1432), null);
});
test('stamp: the Worker\'s own "live" flag, frozen at fetch time, no longer decides anything', () => {
  const q = { t: [1], c: [1], px: 101, pt: sec(MON_1432) - 20, prev: 100, live: true };
  assert.equal(isLiveQuote(q, MON_1432), true); assert.equal(isLiveQuote(q, MON_1432 + 6 * 60e3), false, 'live:true from the Worker, six minutes later');
  const row = { price: 100, r1d: 0, last_date: '2026-10-23' };
  assert.equal(livePrice(row, q, MON_1432).live, true); assert.equal(livePrice(row, q, MON_1432 + 30 * 60e3).live, false);
  assert.equal(livePrice(row, q, MON_1432 + 30 * 60e3).px, 101, 'the price is still the latest print; only its label changes');
});
test('stamp: times are Indian time and say so; dates appear only for another day', () => {
  assert.equal(fmtIst(sec(MON_1432), MON_1432), '14:32 IST'); assert.equal(fmtIst(sec(MON_1432) - 86400, MON_1432), 'Sun 25 Oct 14:32 IST');
  assert.equal(nseClockOpen(MON_1432), true); assert.equal(nseClockOpen(Date.UTC(2026, 9, 25, 9, 0)), false);
  assert.deepEqual([ageWord(12), ageWord(90), ageWord(7200), ageWord(200000)], ['12 s', '2 min', '2 h', '2 d']);
});

import { detect } from '../src/haptic.ts';
test('haptics are capability-tested: vibration where it exists, the iPhone system tap only on 17.4+ that renders the switch, nothing otherwise', () => {
  const ua = (v: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15 Version/17 Mobile/15E148 Safari/604.1`;
  assert.equal(detect({ vibrate: true, ua: 'Android', switchAppearance: false }), 'vibrate');
  assert.equal(detect({ vibrate: false, ua: ua('17_4'), switchAppearance: true }), 'ios-switch'); assert.equal(detect({ vibrate: false, ua: ua('18_0'), switchAppearance: true }), 'ios-switch');
  assert.equal(detect({ vibrate: false, ua: ua('17_3'), switchAppearance: true }), 'none', 'before 17.4 there is no route');
  assert.equal(detect({ vibrate: false, ua: ua('18_0'), switchAppearance: false }), 'none', 'the browser must say it renders the switch');
  assert.equal(detect({ vibrate: false, ua: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130', switchAppearance: false }), 'none');
});
