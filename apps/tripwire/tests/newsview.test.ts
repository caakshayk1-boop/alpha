// What the news screens show: tabs, the Following list that is never seeded, Today's window and no-padding rule, the archive filters, "N new updates" without reordering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveList, fitForToday, inTab, labelsOf, mergePools, newUpdates, safeHref, tabCounts, todayList, entityLine, type NewsEvent } from '../src/newsview.ts';

const NOW = Date.parse('2026-10-27T10:00:00Z'); const h = (x: number) => new Date(NOW - x * 3600e3).toISOString();
const ev = (id: string, o: Partial<NewsEvent> & { sym?: string } = {}): NewsEvent => { const { sym, ...rest } = o; return { eventClusterId: id, headline: id, eventType: 'Results', significance: 0.75, entities: sym ? [{ sym, name: `${sym} Ltd.`, confidence: 0.95, matchedOn: 'name' }] : [], scopes: sym ? ['company'] : ['market'], publishedAt: h(2), updatedAt: h(2), firstSeenAt: h(1.9), fetchedAt: h(1), sourceId: 'mint', sourceTitle: 'Mint', sourceTier: 'major', sourceWeight: 0.8, canonicalUrl: `https://x.com/${id}`, sourceTimezone: 'UTC', moreSources: 0, sources: [], summary: null, qualityFlags: [], todayEligible: true, relevanceScore: 50, rankingVersion: 'news-rank-1', ...rest }; };
const L = { follows: ['TCS'], paper: ['INFY'] };

test('tabs: Market, Following and Paper book are separate; All is their union with labels', () => {
  const m = ev('m'), t = ev('t', { sym: 'TCS' }), i = ev('i', { sym: 'INFY' }), o = ev('o', { sym: 'WIPRO' }), both = ev('b', { sym: 'TCS', entities: [{ sym: 'TCS', name: 'a', confidence: 1, matchedOn: 'name' }, { sym: 'INFY', name: 'b', confidence: 1, matchedOn: 'name' }] });
  assert.deepEqual([m, t, i, o].map((e) => inTab(e, 'market', L)), [true, false, false, false]); assert.deepEqual([m, t, i, o].map((e) => inTab(e, 'following', L)), [false, true, false, false]);
  assert.deepEqual([m, t, i, o].map((e) => inTab(e, 'paper', L)), [false, false, true, false]); assert.deepEqual([m, t, i, o].map((e) => inTab(e, 'all', L)), [true, true, true, false], 'a name nobody follows or holds is in no tab');
  assert.deepEqual(labelsOf(both, L), ['Following', 'Paper book']); assert.deepEqual(labelsOf(m, L), ['Market']);
});
test('Following is the explicit follows only: an empty follow list has no events even when the paper book has many', () => {
  const pool = [ev('i1', { sym: 'INFY' }), ev('i2', { sym: 'INFY' }), ev('m')]; const none = { follows: [], paper: ['INFY'] };
  assert.equal(pool.filter((e) => inTab(e, 'following', none)).length, 0); assert.equal(todayList(pool, 'following', none, NOW).length, 0);
  assert.deepEqual(tabCounts(pool, none, NOW), { all: 3, market: 1, following: 0, paper: 2 });
});
test('Today: only events with a known recent date, an event type, and inside the window (72 h company, 48 h India-wide); never future-dated', () => {
  assert.equal(fitForToday(ev('a'), NOW), true); assert.equal(fitForToday(ev('a', { publishedAt: null }), NOW), false, 'unknown time is not "now"');
  assert.equal(fitForToday(ev('a', { sym: 'TCS', publishedAt: h(71) }), NOW), true); assert.equal(fitForToday(ev('a', { sym: 'TCS', publishedAt: h(73) }), NOW), false);
  assert.equal(fitForToday(ev('a', { publishedAt: h(47) }), NOW), true); assert.equal(fitForToday(ev('a', { publishedAt: h(49) }), NOW), false);
  assert.equal(fitForToday(ev('a', { publishedAt: new Date(NOW + 3 * 3600e3).toISOString() }), NOW), false); assert.equal(fitForToday(ev('a', { todayEligible: false }), NOW), false);
});
test('Today never pads: three qualify, three are returned; ten at most; two per company in the first five', () => {
  assert.equal(todayList([ev('a'), ev('b'), ev('c')], 'all', L, NOW).length, 3);
  const many = Array.from({ length: 14 }, (_, i) => ev(`m${i}`, { publishedAt: h(1 + i * 0.1) })); assert.equal(todayList(many, 'all', L, NOW).length, 10);
  const tcs = Array.from({ length: 4 }, (_, i) => ev(`t${i}`, { sym: 'TCS', publishedAt: h(1 + i * 0.1) })); const mk = Array.from({ length: 3 }, (_, i) => ev(`k${i}`, { publishedAt: h(5 + i) }));
  const first5 = todayList([...tcs, ...mk], 'all', L, NOW, 5); assert.equal(first5.filter((e) => e.entities[0]?.sym === 'TCS').length, 2, 'at most two TCS in the default five'); assert.equal(first5.length, 5);
  assert.deepEqual(todayList([], 'all', L, NOW), []);
});
test('the order is the same however the input arrives (deterministic)', () => {
  const a = [ev('a', { publishedAt: h(3) }), ev('b', { publishedAt: h(1) }), ev('c', { sym: 'TCS', publishedAt: h(2) })];
  assert.deepEqual(todayList(a, 'all', L, NOW).map((e) => e.eventClusterId), todayList([...a].reverse(), 'all', L, NOW).map((e) => e.eventClusterId));
});
test('the archive: newest first, undated last, "other updates" and old events behind filters, search by headline or symbol', () => {
  const pool = [ev('old', { sym: 'TCS', publishedAt: h(24 * 5) }), ev('new', { sym: 'TCS' }), ev('und', { sym: 'TCS', publishedAt: null, eventType: 'Update' }), ev('upd', { sym: 'TCS', eventType: 'Update' }), ev('mkt'), ev('oth', { sym: 'WIPRO' })];
  const f = { tab: 'all' as const, types: [], days: 7, includeOther: false, covered: false, text: '' };
  assert.deepEqual(archiveList(pool, f, L, NOW).map((e) => e.eventClusterId), ['mkt', 'new', 'old'], 'newest first; a tie breaks on id');
  assert.deepEqual(archiveList(pool, { ...f, includeOther: true }, L, NOW).map((e) => e.eventClusterId).slice(-1), ['und'], 'an undated story sorts last');
  assert.equal(archiveList(pool, { ...f, days: 2 }, L, NOW).some((e) => e.eventClusterId === 'old'), false); assert.equal(archiveList(pool, { ...f, covered: true }, L, NOW).some((e) => e.eventClusterId === 'oth'), true);
  assert.deepEqual(archiveList(pool, { ...f, types: ['Deal'] }, L, NOW), []); assert.equal(archiveList(pool, { ...f, text: 'tcs' }, L, NOW).length, 2);
});
test('merging a live name with the snapshot: one row per event, by id or by any shared link', () => {
  const a = ev('a', { sources: [{ sourceId: 's', sourceTitle: 'S', tier: 'major', canonicalUrl: 'https://x.com/shared', publishedAt: null }] }); const b = ev('b', { canonicalUrl: 'https://x.com/shared' }); const c = ev('c');
  assert.deepEqual(mergePools([a], [b, c, ev('a')]).map((e) => e.eventClusterId), ['a', 'c']);
});
test('"N new updates" counts events not on screen; a reorder alone is not an update', () => {
  const shown = [ev('a'), ev('b')]; assert.equal(newUpdates(shown, [ev('b'), ev('a')]), 0); assert.equal(newUpdates(shown, [ev('c'), ev('a'), ev('d')]), 2); assert.equal(newUpdates([], [ev('a')]), 1);
});
test('links: only http(s) reaches an href; the entity line names the company or says India-wide', () => {
  assert.equal(safeHref('javascript:alert(1)'), null); assert.equal(safeHref('data:text/html,x'), null); assert.equal(safeHref('not a url'), null); assert.equal(safeHref('https://a.com/x'), 'https://a.com/x');
  assert.equal(entityLine(ev('a', { sym: 'TCS' })), 'TCS · TCS'); assert.equal(entityLine(ev('m')), 'India-wide');
});
