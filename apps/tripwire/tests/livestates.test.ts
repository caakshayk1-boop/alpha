import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { quoteAge, markWord, noteFeedPrint, resetFeedPrint, feedIsFresh, FEED_FRESH_SEC } from '../src/stamp.ts';
import { sparkMany, marketOpenNow, parseSpark } from '../worker.js';

const at = (iso: string) => Date.parse(iso);
const NOW = at('2026-11-04T09:32:00+05:30');              // a Wednesday, 17 minutes into the session
const sec = (iso: string) => at(iso) / 1000;
beforeEach(() => resetFeedPrint());

test('without any evidence about the feed, nothing changes: a name is judged on its own print, as before', () => {
  assert.equal(feedIsFresh(NOW), false);
  assert.equal(quoteAge(sec('2026-11-04T09:30:00+05:30'), NOW)!.word, 'Live');
  assert.equal(quoteAge(sec('2026-11-04T09:24:00+05:30'), NOW)!.word, 'Delayed');         // eight minutes old
  assert.equal(quoteAge(sec('2026-11-03T15:30:00+05:30'), NOW)!.word, 'Delayed');         // yesterday's close during the session
  assert.equal(markWord('close', sec('2026-11-03T15:30:00+05:30'), NOW).word, 'Delayed');
});
test('when the feed is current, a thin stock that last traded minutes ago is Live, with the time it traded', () => {
  noteFeedPrint(sec('2026-11-04T09:31:40+05:30')); assert.equal(feedIsFresh(NOW), true);
  const a = quoteAge(sec('2026-11-04T09:24:00+05:30'), NOW)!; assert.equal(a.word, 'Live'); assert.equal(a.state, 'live'); assert.match(a.text, /last trade 09:24 IST/); assert.match(a.text, /feed is current/);
  const m = markWord('live', sec('2026-11-04T09:24:00+05:30'), NOW); assert.equal(m.word, 'Live'); assert.match(m.detail, /last trade 09:24 IST/);
  assert.equal(quoteAge(sec('2026-11-04T09:31:30+05:30'), NOW)!.text.startsWith('Live ·'), true);
});
test('when the feed is current and the stock has not traded today, it says so: never Live, never Delayed', () => {
  noteFeedPrint(sec('2026-11-04T09:31:50+05:30'));
  const a = quoteAge(sec('2026-11-03T15:29:00+05:30'), NOW)!; assert.equal(a.word, 'Not traded yet'); assert.match(a.text, /No trade yet today/);
  const m = markWord('close', sec('2026-11-03T15:30:00+05:30'), NOW); assert.equal(m.word, 'Not traded yet'); assert.match(m.detail, /no trade yet today/);
  assert.equal(markWord('live', sec('2026-11-03T15:30:00+05:30'), NOW).word, 'Not traded yet');
});
test('a feed that has itself gone quiet is NOT excused: Delayed comes back once the Nifty has not printed for three minutes', () => {
  noteFeedPrint(sec('2026-11-04T09:27:00+05:30')); assert.equal(feedIsFresh(NOW), false); assert.ok(NOW / 1000 - sec('2026-11-04T09:27:00+05:30') > FEED_FRESH_SEC);
  assert.equal(quoteAge(sec('2026-11-04T09:24:00+05:30'), NOW)!.word, 'Delayed');
  assert.equal(markWord('close', sec('2026-11-03T15:30:00+05:30'), NOW).word, 'Delayed');
});
test('a shut market is never Live and never Not traded yet, whatever the feed note says', () => {
  const after = at('2026-11-04T17:00:00+05:30'); noteFeedPrint(after / 1000 - 60);
  assert.equal(quoteAge(sec('2026-11-04T15:29:00+05:30'), after)!.word, 'Last traded'); assert.equal(markWord('close', sec('2026-11-04T15:30:00+05:30'), after).word, 'Last traded');
  const sat = at('2026-11-07T11:00:00+05:30'); noteFeedPrint(sat / 1000 - 30); assert.equal(quoteAge(sec('2026-11-06T15:29:00+05:30'), sat)!.word, 'Last traded');
});
test('the Worker knows when the session is on: Monday to Friday, 09:15 to 15:30 IST', () => {
  assert.equal(marketOpenNow(at('2026-11-04T10:10:00+05:30')), true); assert.equal(marketOpenNow(at('2026-11-04T09:14:00+05:30')), false); assert.equal(marketOpenNow(at('2026-11-04T09:15:00+05:30')), true);
  assert.equal(marketOpenNow(at('2026-11-04T15:30:00+05:30')), true); assert.equal(marketOpenNow(at('2026-11-04T15:31:00+05:30')), false); assert.equal(marketOpenNow(at('2026-11-07T11:00:00+05:30')), false); assert.equal(marketOpenNow(at('2026-11-08T11:00:00+05:30')), false);
});
test('a stock with one valid five-minute bar is a quote, not a missing name', () => {
  const t = (m: number) => sec('2026-11-04T09:15:00+05:30') + m * 60;
  const q = parseSpark({ timestamp: [t(5), t(10), t(15)], close: [null, 66.9, null], chartPreviousClose: 66.71 }, NOW)!; assert.equal(q.px, 66.9); assert.equal(q.t.length, 1); assert.equal(q.prev, 66.71);
  assert.equal(parseSpark({ timestamp: [t(5), t(10)], close: [null, null], chartPreviousClose: 66.71 }, NOW), null, 'no trade at all: still missing');
});
test('the Worker asks for a name the batch left out, one at a time, only while the market is open and only a bounded number', async () => {
  const t0 = sec('2026-11-04T09:15:00+05:30'); const calls: string[] = []; const real = globalThis.fetch;
  const chart = (sym: string, traded: boolean) => ({ chart: { result: [{ meta: { chartPreviousClose: 66.71, regularMarketPrice: traded ? 66.9 : 66.71, regularMarketTime: traded ? t0 + 17 * 60 : t0 - 17 * 3600 }, timestamp: [t0 + 300, t0 + 600, t0 + 900], indicators: { quote: [{ close: traded ? [null, 66.9, 66.95] : [null, null, null] }] } }] } });
  globalThis.fetch = (async (url: string) => {
    const u = String(url); calls.push(u);
    if (u.includes('/spark')) return { ok: true, json: async () => ({ 'AAA.NS': { timestamp: [t0 + 300, t0 + 600], close: [10, 10.1], chartPreviousClose: 9.9 } }) };       // BBB.NS and CCC.NS are absent from the batch
    const sym = decodeURIComponent(u.split('/chart/')[1].split('?')[0]);
    return { ok: true, json: async () => chart(sym, sym === 'BBB.NS') };                                                                                       // BBB has traded; CCC has not
  }) as unknown as typeof fetch;
  try {
    const open = await sparkMany([['AAA', 'AAA.NS'], ['BBB', 'BBB.NS'], ['CCC', 'CCC.NS']], undefined, NOW);
    assert.ok(open.out.AAA && open.out.BBB, 'the batch named AAA; BBB was fetched on its own and found'); assert.deepEqual(open.missing, ['CCC'], 'CCC has not traded: it stays missing, to be said so, not guessed');
    assert.equal(calls.filter((c) => c.includes('/chart/')).length, 2, 'both left-out names were asked for individually, once each');
    calls.length = 0; const shut = await sparkMany([['AAA', 'AAA.NS'], ['BBB', 'BBB.NS']], undefined, at('2026-11-04T18:00:00+05:30'));
    assert.deepEqual(shut.missing, ['BBB']); assert.equal(calls.filter((c) => c.includes('/chart/')).length, 0, 'with the market shut there is no retry');
    calls.length = 0; const many = Array.from({ length: 14 }, (_, i) => [`M${i}`, `M${i}.NS`]); await sparkMany([['AAA', 'AAA.NS'], ...many] as [string, string][], undefined, NOW);
    assert.ok(calls.filter((c) => c.includes('/chart/')).length <= 8, 'at most eight individual retries a request');
  } finally { globalThis.fetch = real; }
});
