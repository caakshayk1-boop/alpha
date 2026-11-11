// Today's departure board (revamp v2, 11 Nov 2026), offline: the chips under a followed company (each fact once), the order of the rows, the news split that keeps a company story
// off the market list (dedupe by event id), and the two paper positions nearest a stop or target. Pure functions, fixed inputs, no clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attention, boardChips, levelGap, nearestLevels, orderBoard, splitNews, RESULTS_CHIP_DAYS, type RowFacts } from '../src/todayboard.ts';
import type { SeenChange } from '../src/sincevisit.ts';
import type { NewsEvent } from '../src/newsview.ts';
import { FORBIDDEN } from '../src/brief.ts';

const NOW = Date.parse('2026-11-11T08:00:00Z'); const TODAY = '2026-11-11';
const ch = (o: Partial<SeenChange>): SeenChange => ({ id: o.id ?? `TCS|${o.kind}`, sym: 'TCS', kind: 'trend', title: 'Trend class changed', before: 'Sideways', after: 'Uptrend', basis: '', prevDay: '2026-10-20', curDay: '2026-10-26', prevAt: '', curAt: '', framing: '', entryId: null, ...o });
const ev = (id: string, o: Partial<NewsEvent> = {}): NewsEvent => ({ eventClusterId: id, headline: id, eventType: 'Update', significance: 0.5, entities: [], scopes: [], publishedAt: new Date(NOW - 3600e3).toISOString(), updatedAt: null, firstSeenAt: null, fetchedAt: null,
  sourceId: 's', sourceTitle: 'Source', sourceTier: 'major', sourceWeight: 1, canonicalUrl: 'https://example.org/' + id, sourceTimezone: 'Asia/Kolkata', moreSources: 0, sources: [], summary: null, qualityFlags: [], todayEligible: true, relevanceScore: 0, rankingVersion: 'r', ...o });
const company = (id: string, sym: string, o: Partial<NewsEvent> = {}) => ev(id, { entities: [{ sym, name: sym, confidence: 1, matchedOn: 'name' }], scopes: ['company'], ...o });
const market = (id: string, o: Partial<NewsEvent> = {}) => ev(id, { scopes: ['market'], ...o });
const facts = (o: Partial<RowFacts> = {}): RowFacts => ({ sym: 'TCS', changes: [], news: [], review: null, inBook: false, nextResults: null, today: TODAY, ...o });

test('chips: a quiet row has none; each fact gets one chip, in order of what it asks of the reader', () => {
  assert.deepEqual(boardChips(facts()), []);
  const c = boardChips(facts({ changes: [ch({ kind: 'invalidation', id: 'i', title: 'Fell below ₹2,550' }), ch({ kind: 'sma200', id: 's', title: 'Moved above its 200-day average' })], news: [company('a', 'TCS'), company('b', 'TCS')], review: 'overdue', inBook: true, nextResults: '2026-11-14' }));
  assert.deepEqual(c.map((x) => x.text), ['Thesis level crossed', 'Thesis review overdue', 'Results 14 Nov', 'Crossed above 200-day', '2 headlines', 'In paper book']);
  assert.equal(c.find((x) => x.id === 'inv')!.tone, 'down'); assert.equal(c.find((x) => x.text === 'Crossed above 200-day')!.tone, 'up');
});
test('chips: results are said once, "Results out" when a results story is in, the date otherwise, and a since-visit results reminder is not repeated', () => {
  const out = boardChips(facts({ news: [company('r', 'TCS', { eventType: 'Results' })], nextResults: '2026-11-12', changes: [ch({ kind: 'results', id: 'res', title: 'Results in 1 day' })] }));
  assert.deepEqual(out.filter((x) => /Results/.test(x.text)).map((x) => x.text), ['Results out']);
  assert.equal(boardChips(facts({ nextResults: TODAY }))[0].text, 'Results today');
  assert.equal(boardChips(facts({ nextResults: '2026-12-31' })).length, 0, `a date more than ${RESULTS_CHIP_DAYS} days away is not a chip`);
  assert.equal(boardChips(facts({ nextResults: '2026-11-01' })).length, 0, 'a past date is not a chip');
});
test('chips: a fell-below crossing is down, a new low is down, a move keeps its sign; no chip predicts or advises', () => {
  const c = boardChips(facts({ changes: [ch({ kind: 'sma200', id: 'a', title: 'Fell below its 200-day average' }), ch({ kind: 'low52', id: 'b', title: 'New 52-week low' }), ch({ kind: 'move', id: 'c', title: 'Down 7.1% since Tue 20 Oct' }), ch({ kind: 'trend', id: 'd', after: 'Downtrend' })] }));
  assert.deepEqual(c.map((x) => [x.text, x.tone]), [['Fell below 200-day', 'down'], ['52-week low', 'down'], ['Down 7.1%', 'down'], ['Now downtrend', 'down']]);
  for (const x of c) assert.ok(!FORBIDDEN.test(x.text), x.text);
});
test('order: a crossed thesis level, then a review due, then changes, then news; ties keep the follow order', () => {
  assert.equal(attention({ changes: [ch({ kind: 'invalidation' })], news: [], review: null }), 4);
  assert.equal(attention({ changes: [], news: [], review: 'today' }), 3);
  assert.equal(attention({ changes: [ch({})], news: [], review: null }), 2);
  assert.equal(attention({ changes: [], news: [ev('x')], review: null }), 1);
  assert.equal(attention({ changes: [], news: [], review: null }), 0);
  const follows = ['A', 'B', 'C', 'D'];
  assert.deepEqual(orderBoard([{ sym: 'A', score: 0 }, { sym: 'B', score: 2 }, { sym: 'C', score: 0 }, { sym: 'D', score: 2 }], follows).map((r) => r.sym), ['B', 'D', 'A', 'C']);
});
test('news split: company stories go to their row, newest first, at most three; the market list holds India-wide stories only, at most three, never one already on the board', () => {
  const pool = [company('t1', 'TCS', { publishedAt: new Date(NOW - 5 * 3600e3).toISOString() }), company('t2', 'TCS'), company('i1', 'INFY'), market('m1'), market('m2'), market('m3'), market('m4'), company('x', 'XYZ')];
  const s = splitNews(pool, pool.filter((e) => e.scopes.includes('market')), ['TCS', 'INFY'], NOW);
  assert.deepEqual(s.bySym.TCS.map((e) => e.eventClusterId), ['t2', 't1']); assert.deepEqual(s.bySym.INFY.map((e) => e.eventClusterId), ['i1']);
  assert.deepEqual(s.market.map((e) => e.eventClusterId), ['m1', 'm2', 'm3'], 'at most three market stories');
  // a story the ranker put on the market list that names a followed company stays on the board only (dedupe by event id)
  const both = company('dup', 'TCS', { scopes: ['market', 'company'] });
  const s2 = splitNews([both, market('m1')], [both, market('m1')], ['TCS'], NOW);
  assert.deepEqual(s2.bySym.TCS.map((e) => e.eventClusterId), ['dup']); assert.deepEqual(s2.market.map((e) => e.eventClusterId), ['m1']);
  const ids = [...Object.values(s.bySym).flat(), ...s.market].map((e) => e.eventClusterId); assert.equal(new Set(ids).size, ids.length, 'no event listed twice');
  assert.deepEqual(splitNews([company('old', 'TCS', { publishedAt: new Date(NOW - 10 * 86400e3).toISOString() })], [], ['TCS'], NOW).bySym.TCS, [], 'a story outside the Today window is not on the row');
  const two = splitNews([company('two', 'TCS', { entities: [{ sym: 'TCS', name: 'TCS', confidence: 1, matchedOn: 'name' }, { sym: 'INFY', name: 'INFY', confidence: 1, matchedOn: 'name' }] })], [], ['TCS', 'INFY'], NOW);
  assert.equal(two.bySym.TCS.length + two.bySym.INFY.length, 1, 'a story naming two followed companies is listed once');
});
test('nearest levels: the gap is to the nearer of the stop and the next target, as a share of the price; the two nearest are kept, the stop wins a tie', () => {
  assert.deepEqual(levelGap({ id: 'a', sym: 'A', mark: 100, stop: 95, target: 110 }), { gap: 0.05, near: 'stop' });
  assert.deepEqual(levelGap({ id: 'a', sym: 'A', mark: 100, stop: 90, target: 103 }), { gap: 0.03, near: 'target' });
  assert.deepEqual(levelGap({ id: 'a', sym: 'A', mark: 100, stop: 90, target: null }), { gap: 0.1, near: 'stop' }, 'both targets filled: only the stop is left');
  assert.equal(levelGap({ id: 'a', sym: 'A', mark: 0, stop: 90, target: 110 }), null, 'no price, no gap');
  const n = nearestLevels([{ id: '1', sym: 'A', mark: 100, stop: 80, target: 130 }, { id: '2', sym: 'B', mark: 100, stop: 98, target: 120 }, { id: '3', sym: 'C', mark: 100, stop: 70, target: 104 }, { id: '4', sym: 'D', mark: 100, stop: 96, target: 104 }]);
  assert.deepEqual(n.map((x) => [x.sym, x.near]), [['B', 'stop'], ['D', 'stop']]);
  assert.equal(nearestLevels([]).length, 0);
});

/* 12 Nov 2026 (Codex review on #60): "RSI crossed 30" is a fall; the chip must not read "RSI above 30". */
test('the RSI chip reads the direction of the crossing from the readings', async () => {
  const { rsiChip } = await import('../src/todayboard.ts');
  assert.equal(rsiChip({ title: 'RSI crossed 70', before: 'RSI 66', after: 'RSI 72' }), 'RSI above 70');
  assert.equal(rsiChip({ title: 'RSI crossed 30', before: 'RSI 34', after: 'RSI 28' }), 'RSI below 30');
  assert.equal(rsiChip({ title: 'RSI fell back under 70', before: 'RSI 73', after: 'RSI 65' }), 'RSI back under 70');
  assert.equal(rsiChip({ title: 'RSI recovered above 30', before: 'RSI 27', after: 'RSI 36' }), 'RSI back above 30');
});
