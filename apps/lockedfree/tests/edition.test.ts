// 22 Nov 2026: the daily breakout list and the edition built from it. Synthetic rows only; no feed needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanBreakouts, breakoutRules, outOfUniverse } from '../src/lib/breakouts.ts';
import { checkEdition, blocksToText, blocksToHtml, editionBlocks, buildWeekly, weeklyBlocks, weeksOf, DISCLAIMER, EDITION_SCHEMA, type Edition } from '../src/lib/edition.ts';

const D = '2026-11-20';
const row = (o: Record<string, unknown> = {}): any => ({ sym: 'AAA', name: 'Aaa Ltd', sector: 'X', price: 110, last_date: D, mcap_cr: 5000, turnover_cr: 40, liquid: true, brk50: true, brk52w: false, vol_spike: 2, sma20: 105, sma50: 100, sma200: 90, rsi: 65, macd_h: 1.2, rs3m: 4, atr_pct: 2.5, r1d: 3, ...o });
const scan = (rows: any[]) => scanBreakouts({ rows, asOf: D });

test('a stock that passes every check is listed, with all eight results', () => {
  const s = scan([row()]); assert.equal(s.listed.length, 1); assert.equal(s.listed[0].rules.length, 8); assert.ok(s.listed[0].rules.every((r) => r.pass === true));
});
test('each threshold is inclusive at its edge and fails just past it', () => {
  const ok = (o: Record<string, unknown>) => scan([row(o)]).listed.length === 1;
  assert.ok(ok({ vol_spike: 1.5 })); assert.ok(!ok({ vol_spike: 1.49 }));
  assert.ok(ok({ rsi: 55 })); assert.ok(!ok({ rsi: 54.9 })); assert.ok(ok({ rsi: 80 })); assert.ok(!ok({ rsi: 80.1 }));
  assert.ok(ok({ atr_pct: 6 })); assert.ok(!ok({ atr_pct: 6.1 }));
  assert.ok(!ok({ macd_h: 0 })); assert.ok(!ok({ rs3m: 0 })); assert.ok(!ok({ brk50: false }));
  assert.ok(!ok({ sma50: 95, sma200: 96 }), '50-day must be above the 200-day');
  assert.ok(!ok({ price: 140, sma20: 100, atr_pct: 5 }), '40% above the 20-day at 5% ATR is 8 ATRs, stretched');
});
test('a missing input is never a pass: the stock is not listed and not a near miss', () => {
  const s = scan([row({ rsi: null })]); assert.equal(s.listed.length, 0); assert.equal(s.near_misses.length, 0);
  assert.equal(breakoutRules(row({ vol_spike: undefined })).find((r) => r.id === 'b2')!.pass, null);
});
test('exactly one failed check is a near miss and names the check; two are neither', () => {
  const one = scan([row({ rsi: 85 })]); assert.equal(one.near_misses.length, 1); assert.match(one.near_misses[0].failed, /RSI/);
  const two = scan([row({ rsi: 85, macd_h: -1 })]); assert.equal(two.near_misses.length, 0); assert.equal(two.listed.length, 0);
});
test('the universe is size, liquidity and a price from the same day; each exclusion is counted', () => {
  assert.equal(outOfUniverse(row({ mcap_cr: 1999 }), D), 'size'); assert.equal(outOfUniverse(row({ turnover_cr: 9 }), D), 'liquidity');
  assert.equal(outOfUniverse(row({ liquid: false }), D), 'liquidity'); assert.equal(outOfUniverse(row({ last_date: '2026-11-19' }), D), 'stale price'); assert.equal(outOfUniverse(row(), D), null);
  const s = scan([row({ sym: 'A', mcap_cr: 100 }), row({ sym: 'B', last_date: '2026-11-19' }), row({ sym: 'C' })]);
  assert.deepEqual(s.excluded, { size: 1, 'stale price': 1 }); assert.equal(s.universe_n, 1);
});
test('listings are alphabetical, never ranked by strength', () => {
  const s = scan([row({ sym: 'ZED', vol_spike: 9 }), row({ sym: 'ABC', vol_spike: 1.6 }), row({ sym: 'MID', vol_spike: 4 })]); assert.deepEqual(s.listed.map((x) => x.sym), ['ABC', 'MID', 'ZED']);
});

const ed = (date: string, o: Partial<Edition> = {}): Edition => ({ schema: EDITION_SCHEMA, date, generated_at: date + 'T00:00:00Z', feed: { price_date: date, built_on: null, rows: 900 },
  market: { priced: 900, advancers: 500, decliners: 350, unchanged: 50, above_50_pct: 55, above_200_pct: 60, new_50_highs: 20, new_52w_highs: 8 },
  book: { as_of: date, equity: 100000, day_change: 10, return_pct: 1, benchmark_pct: 0.5, open: 3, closed: 1 }, screens: [], closed_today: [],
  breakouts: scan([row()]), earlier: [], ...o });
test('checkEdition refuses a holiday or weekend, a feed/date mismatch, a thin universe, a rewrite and an out-of-order write', () => {
  assert.deepEqual(checkEdition(ed(D), []), []);
  assert.ok(checkEdition(ed('2026-11-21'), []).some((m) => /not an NSE session/.test(m)), 'Saturday');
  assert.ok(checkEdition(ed(D, { feed: { price_date: '2026-11-19', built_on: null, rows: 9 } }), []).some((m) => /differ/.test(m)));
  assert.ok(checkEdition(ed(D, { market: { ...ed(D).market, priced: 100 } }), []).some((m) => /only 100/.test(m)));
  assert.ok(checkEdition(ed(D), [ed(D)]).some((m) => /never rewritten/.test(m)));
  assert.ok(checkEdition(ed('2026-11-19'), [ed(D)]).some((m) => /in order/.test(m)));
});
test('every rendering carries the disclaimer and says observations, not recommendations', () => {
  const b = editionBlocks(ed(D)); const t = blocksToText('Edition', b), h = blocksToHtml('Edition', b);
  assert.ok(t.includes(DISCLAIMER) && h.includes(DISCLAIMER)); assert.match(t, /not (a )?recommendation|observation/i);
  assert.ok(!/\b(buy now|target price|guaranteed|sure[- ]shot)\b/i.test(t));
});
test('a day with no listing says so instead of printing an empty section', () => {
  const t = blocksToText('Edition', editionBlocks(ed(D, { breakouts: scan([row({ rsi: 90 })]) }))); assert.match(t, /no stock|none|nothing/i);
});
test('weeks group Monday to Sunday and the weekly note counts listings and repeats', () => {
  const a = ed('2026-11-16'), b = ed('2026-11-17'), c = ed('2026-11-23');
  const w = weeksOf([c, b, a]); assert.equal(w.length, 2); assert.deepEqual(w[0].map((e) => e.date), ['2026-11-16', '2026-11-17']);
  const k = buildWeekly(w[0])!; assert.equal(k.week_ending, '2026-11-17'); assert.equal(k.sessions, 2); assert.deepEqual(k.repeat, ['AAA']);
  assert.ok(blocksToText('Week', weeklyBlocks(k)).includes(DISCLAIMER)); assert.equal(buildWeekly([]), null);
});
