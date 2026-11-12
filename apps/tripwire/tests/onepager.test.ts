// The company one-pager (12 Nov 2026): the results-date state (a past estimate is never "next"), the hero trend chip, and the eight "At a glance" cells.
// Every clock here is a literal instant: nothing reads Date.now().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultsDate } from '../src/resultsdate.ts';
import { trendChip } from '../src/verdict.ts';
import { glanceOf, type GlanceIn } from '../src/glance.ts';
import { checklistFor } from '../src/insight.ts';
import type { Row } from '../src/screen.ts';

const at = (iso: string) => Date.parse(iso);   // an instant with its offset written out

test('results date: a date after today is the next one, an estimate', () => {
  const r = resultsDate('2026-11-20', at('2026-11-12T10:00:00+05:30'));
  assert.equal(r.state, 'upcoming'); assert.equal(r.next, true); assert.equal(r.days, 8); assert.equal(r.tag, 'Fri 20 Nov');
  assert.equal(r.line, 'Next results, estimated date'); assert.equal(r.short, '20 Nov (estimate)');
});
test('results date: a date in the past is the last supplied estimate, never "next"', () => {
  const r = resultsDate('2026-10-08', at('2026-11-12T10:00:00+05:30'));   // the live fixture on Wed 12 Nov
  assert.equal(r.state, 'past'); assert.equal(r.next, false); assert.equal(r.days, -35);
  assert.equal(r.line, 'Last supplied estimate: 8 Oct; next date unavailable');
  assert.ok(!/next results/i.test(r.line) && !/estimated date/i.test(r.line)); assert.equal(r.short, 'Next date unavailable');
});
test('results date: the IST session day decides, at the midnight boundary and across the UTC day', () => {
  // 23:59 IST on 8 Oct is still 8 Oct: the date is today, not past
  assert.equal(resultsDate('2026-10-08', at('2026-10-08T23:59:00+05:30')).state, 'today');
  assert.equal(resultsDate('2026-10-08', at('2026-10-08T23:59:00+05:30')).line, 'Results expected today, estimated date');
  // 00:00 IST on 9 Oct is the first instant it is past
  assert.equal(resultsDate('2026-10-08', at('2026-10-09T00:00:00+05:30')).state, 'past');
  // 19:00 UTC on 8 Oct is already 00:30 IST on 9 Oct
  assert.equal(resultsDate('2026-10-08', at('2026-10-08T19:00:00Z')).state, 'past');
  // 18:29 UTC on 8 Oct is 23:59 IST: still today
  assert.equal(resultsDate('2026-10-08', at('2026-10-08T18:29:00Z')).state, 'today');
  // the session open and close on the day itself
  assert.equal(resultsDate('2026-10-08', at('2026-10-08T09:15:00+05:30')).next, true); assert.equal(resultsDate('2026-10-08', at('2026-10-08T15:30:00+05:30')).next, true);
  // a date tomorrow (IST) from late in the IST evening is still upcoming
  assert.equal(resultsDate('2026-10-09', at('2026-10-08T23:59:00+05:30')).state, 'upcoming');
});
test('results date: missing, empty and malformed are "not published", never a guessed date', () => {
  for (const v of [null, undefined, '', 'soon', '2026-13-45', '08/10/2026']) { const r = resultsDate(v as string | null, at('2026-11-12T10:00:00+05:30')); assert.equal(r.state, 'missing'); assert.equal(r.next, false); assert.equal(r.date, null); assert.equal(r.days, null); assert.equal(r.line, 'No results date is published'); }
});
test('results date: provenance is carried when supplied, and never invented when it is not', () => {
  const now = at('2026-11-12T10:00:00+05:30');
  assert.equal(resultsDate('2026-10-08', now).line.includes('('), false);
  const r = resultsDate('2026-10-08', now, { source: 'Yahoo Finance', status: 'estimated', asOf: '2026-09-30' });
  assert.equal(r.line, 'Last supplied estimate: 8 Oct; next date unavailable (source Yahoo Finance, status estimated, supplied Wed 30 Sep)');
  assert.equal(resultsDate('2026-11-20', now, { source: 'Yahoo Finance' }).line, 'Next results, estimated date (source Yahoo Finance)');
});
test('results date: it never rolls a past date forward', () => {
  const r = resultsDate('2026-07-09', at('2026-11-12T10:00:00+05:30')); assert.equal(r.date, '2026-07-09'); assert.equal(r.state, 'past');
  assert.ok(!/Oct|Nov|Dec|Jan/.test(r.line));
});
test('review checklist: only an upcoming estimate is called "expected"', () => {
  const base = { sym: 'X', name: 'X', last_date: '2026-11-11' } as Row;
  assert.ok(!checklistFor({ ...base, next_earnings: '2026-10-08' }, '2026-11-12').some((t) => /Results are expected/.test(t)));
  assert.ok(checklistFor({ ...base, next_earnings: '2026-11-20' }, '2026-11-12').some((t) => /Results are expected around Fri 20 Nov/.test(t)));
});

const up: Row = { sym: 'TCS', name: 'Tata Consultancy', sector: 'Technology', tier: 'large', price: 120, sma20: 115, sma50: 110, sma200: 100, r3m: 8, pe: 20, pe_pctile: 62, roce_med: 40.04, fy: '2026-03-31', last_date: '2026-11-11', turnover_cr: 1234.4, liquid: true, next_earnings: '2026-11-20' };
test('trend chip: the same word as the trend rule; stale and unavailable say so', () => {
  assert.deepEqual([trendChip(up, false).word, trendChip(up, false).state, trendChip(up, false).tone], ['Uptrend', 'tagged', 'up']);
  assert.deepEqual([trendChip({ ...up, price: 80, sma20: 85, sma50: 90, sma200: 100, r3m: -8 }, false).word, trendChip({ ...up, price: 80, sma20: 85, sma50: 90, sma200: 100, r3m: -8 }, false).tone], ['Downtrend', 'down']);
  assert.equal(trendChip({ ...up, r3m: -1 }, false).word, 'Sideways');
  const stale = trendChip(up, true); assert.equal(stale.word, 'Uptrend · stale'); assert.equal(stale.state, 'stale'); assert.equal(stale.tone, 'neutral');
  for (const miss of [{ sma200: null }, { r3m: undefined }, { price: 0 }]) { const t = trendChip({ ...up, ...miss } as Row, false); assert.equal(t.word, 'Trend unavailable'); assert.equal(t.state, 'unavailable'); assert.equal(t.glyph, ''); }
  assert.equal(trendChip({ ...up, sma50: null }, true).word, 'Trend unavailable');   // unavailable wins over stale: no word is guessed
});

const gin = (o: Partial<GlanceIn> = {}, row: Partial<Row> = {}, inst: GlanceIn['c']['inst'] = { quality: 'ok', promoter: 72.3, fii: 12.1, dii: 9.4, period: 'Sep 2026' }): GlanceIn => ({
  c: { row: { ...up, ...row }, inst, built_on: '2026-11-12' }, nowMs: at('2026-11-12T10:00:00+05:30'), px: 120, lo: 100, hi: 140, fromHigh: -14.3, basisWord: 'at close', roceMeaningful: true, financial: false, riskLevel: 'HIGH', riskNote: null, flagCount: 3, stale: false, ...o });
const byId = (cs: ReturnType<typeof glanceOf>, id: string) => cs.find((c) => c.id === id)!;
test('at a glance: eight cells in a fixed order, each with a basis', () => {
  const g = glanceOf(gin());
  assert.deepEqual(g.map((c) => c.id), ['range', 'trend', 'quality', 'valuation', 'size', 'results', 'ownership', 'risk']);
  assert.ok(g.every((c) => c.k && c.v && c.sub));
  assert.equal(byId(g, 'range').v, '50% up the range'); assert.match(byId(g, 'range').sub, /₹100 to ₹140 · −14\.3% from high · at close/);
  assert.equal(byId(g, 'trend').v, 'Uptrend'); assert.match(byId(g, 'trend').sub, /Wed 11 Nov · 4 of 4 rules hold/);
  assert.equal(byId(g, 'quality').v, '40.0%'); assert.match(byId(g, 'quality').sub, /Median ROCE · accounts 2026-03-31/);
  assert.equal(byId(g, 'valuation').v, 'PE 20.0×'); assert.match(byId(g, 'valuation').sub, /Higher than 62% of its own past readings/);
  assert.equal(byId(g, 'size').v, 'Large cap'); assert.match(byId(g, 'size').sub, /₹1,234 cr traded a day · liquid/);
  assert.equal(byId(g, 'results').v, '20 Nov (estimate)');
  assert.equal(byId(g, 'ownership').v, 'Promoter 72.3%'); assert.match(byId(g, 'ownership').sub, /FII 12\.1% · DII 9\.4% · Sep 2026/);
  assert.equal(byId(g, 'risk').v, 'High · 3 flags'); assert.equal(byId(g, 'risk').tone, 'warn');
});
test('at a glance: missing data is the word for its absence, never a zero', () => {
  const g = glanceOf(gin({ px: null, lo: null, hi: null, fromHigh: null, roceMeaningful: false, riskLevel: null, riskNote: 'Risk grade not shown.' }, { pe: null, pe_pctile: null, tier: null, turnover_cr: null, liquid: null, next_earnings: null, sma50: null }, null));
  assert.equal(byId(g, 'range').v, 'Not available'); assert.equal(byId(g, 'trend').v, 'Not tagged'); assert.equal(byId(g, 'quality').v, 'Not meaningful');
  assert.equal(byId(g, 'valuation').v, 'No positive PE'); assert.equal(byId(g, 'size').v, 'Size not published'); assert.equal(byId(g, 'size').sub, 'Traded value not held');
  assert.equal(byId(g, 'results').v, 'Not published'); assert.equal(byId(g, 'ownership').v, 'Not available'); assert.equal(byId(g, 'risk').v, 'Not graded'); assert.equal(byId(g, 'risk').sub, 'Risk grade not shown.');
  for (const c of g) assert.ok(!/(^|\s)0(\.0)?%?$/.test(c.v), `${c.id} must not read as a zero`);
});
test('at a glance: a lender is not judged on ROCE; a past results date is flagged; a stale trend says so', () => {
  const g = glanceOf(gin({ financial: true, stale: true }, { next_earnings: '2026-10-08' }));
  assert.equal(byId(g, 'quality').v, 'Not applicable'); assert.equal(byId(g, 'results').v, 'Next date unavailable'); assert.equal(byId(g, 'results').tone, 'warn'); assert.match(byId(g, 'results').sub, /Last supplied estimate Thu 8 Oct/);
  assert.equal(byId(g, 'trend').v, 'Uptrend · stale'); assert.equal(byId(g, 'trend').tone, 'neutral');
});
test('at a glance: the range position is clamped, and a flat range is unavailable', () => {
  assert.equal(byId(glanceOf(gin({ px: 150 })), 'range').at, 100); assert.equal(byId(glanceOf(gin({ px: 90 })), 'range').at, 0);
  assert.equal(byId(glanceOf(gin({ lo: 100, hi: 100 })), 'range').v, 'Not available');
});
