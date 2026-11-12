// The News page's sections (revamp v2, 11 Nov 2026): Your names, Paper book, Market, Other covered names. Each event appears once, in the first section that claims it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveList, cueBlocks, dayWord, groupNews, groupOf, moveWords, sectorDay, todayGlobalRow, todayList, type NewsEvent } from '../src/newsview.ts';

const ev = (id: string, syms: string[] = []): NewsEvent => ({ eventClusterId: id, headline: `h ${id}`, eventType: 'Results', significance: 0.75, entities: syms.map((s) => ({ sym: s, name: `${s} Ltd.`, confidence: 0.95, matchedOn: 'name' })), scopes: syms.length ? ['company'] : ['market'], publishedAt: '2026-10-27T08:00:00Z', updatedAt: null, firstSeenAt: null, fetchedAt: null, sourceId: 'mint', sourceTitle: 'Mint', sourceTier: 'major', sourceWeight: 0.8, canonicalUrl: `https://x.com/${id}`, sourceTimezone: 'UTC', moreSources: 0, sources: [], summary: null, qualityFlags: [], todayEligible: true, relevanceScore: 50, rankingVersion: 'news-rank-1' });
const L = { follows: ['TCS', 'GCSL'], paper: ['TCS', 'INFY'] };

test('a followed name that is also in the paper book is listed once, under Your names, marked as in the paper book', () => {
  const g = groupNews([ev('t', ['TCS'])], L);
  assert.deepEqual(g.map((x) => [x.id, x.items.length]), [['global', 0], ['yours', 1], ['paper', 0], ['market', 0], ['other', 0]]);
  assert.equal(g.find((x) => x.id === 'yours')!.items[0].inPaper, true);   // 12 Nov 2026: 'global' is now the first group, so groups are read by id
});
test('each section takes what is left: paper-only names, India-wide events, then names in no list', () => {
  const pool = [ev('m'), ev('g', ['GCSL']), ev('i', ['INFY']), ev('w', ['WIPRO']), ev('ti', ['INFY', 'TCS'])];
  const g = Object.fromEntries(groupNews(pool, L).map((x) => [x.id, x.items.map((i) => i.ev.eventClusterId)]));
  assert.deepEqual(g, { global: [], yours: ['g', 'ti'], paper: ['i'], market: ['m'], other: ['w'] });
  assert.equal(groupNews(pool, L).find((x) => x.id === 'yours')!.items.find((i) => i.ev.eventClusterId === 'g')!.inPaper, false, 'GCSL is followed but not held');
  assert.deepEqual(pool.map((e) => groupOf(e, L)), ['market', 'yours', 'paper', 'other', 'yours']);
});
test('no headline twice: the totals add up to the input, a repeated id is kept once, and the input order is kept inside a section', () => {
  const pool = [ev('a', ['TCS']), ev('b', ['INFY']), ev('c', ['GCSL']), ev('a', ['TCS']), ev('d')];
  const g = groupNews(pool, L); const ids = g.flatMap((x) => x.items.map((i) => i.ev.eventClusterId));
  assert.equal(ids.length, new Set(ids).size); assert.equal(ids.length, 4); assert.deepEqual(g.find((x) => x.id === 'yours')!.items.map((i) => i.ev.eventClusterId), ['a', 'c']);
});
test('empty lists: nothing is borrowed. With no follows, a paper-book name stays under Paper book', () => {
  const g = groupNews([ev('t', ['TCS'])], { follows: [], paper: ['TCS'] }); assert.equal(g.find((x) => x.id === 'yours')!.items.length, 0); assert.equal(g.find((x) => x.id === 'paper')!.items.length, 1);
  assert.deepEqual(groupNews([], L).map((x) => x.items.length), [0, 0, 0, 0, 0]);
});

// 12 Nov 2026: the Global cues group. It is FIRST, global events never reach another group, and a global event is listed once under its first cue.
test('global events: the first group, never in Your names, Paper book or Market; cue blocks hold each event once under its first cue, newest first, at most two per cue', () => {
  const g = (id: string, cues: string[], hoursAgo: number): NewsEvent => ({ ...ev(id), scope: 'global', cues, scopes: ['global'], entities: [], publishedAt: new Date(Date.parse('2026-11-12T06:00:00Z') - hoursAgo * 3600e3).toISOString() });
  const pool = [ev('m'), g('x1', ['crude', 'dollar'], 5), g('x2', ['crude'], 2), g('x3', ['crude'], 1), g('x4', ['fed_rates'], 3)];
  const groups = groupNews(pool, L); assert.equal(groups[0].id, 'global'); assert.deepEqual(groups[0].items.map((i) => i.ev.eventClusterId), ['x1', 'x2', 'x3', 'x4']);
  assert.ok(groups.slice(1).every((x) => x.items.every((i) => !i.ev.scope)), 'no global event in another group');
  const blocks = cueBlocks(pool); assert.deepEqual(blocks.map((b) => b.id), ['crude', 'fed_rates'], 'crude holds the newest event');
  assert.deepEqual(blocks[0].items.map((i) => i.ev.eventClusterId), ['x3', 'x2'], 'two per cue, newest first');
  assert.equal(blocks.flatMap((b) => b.items).filter((i) => i.ev.eventClusterId === 'x1').length, 0, 'the third crude event is not drawn');
  const two = cueBlocks([g('y', ['crude', 'dollar'], 1)]); assert.deepEqual(two[0].items[0].also.map((a) => a.id), ['dollar']); assert.equal(two.length, 1, 'once, with a second chip');
  assert.deepEqual(cueBlocks([g('z', ['not_a_known_cue'], 1)]), [], 'an unknown cue id is not drawn under an invented heading');
});
test('global events: archive scope and window; Today takes one row, deduped against the market list', () => {
  const NOW = Date.parse('2026-11-12T06:00:00Z'); const g = (id: string, hoursAgo: number): NewsEvent => ({ ...ev(id), headline: `Brent crude rises on supply worries ${id}`, scope: 'global', cues: ['crude'], scopes: ['global'], entities: [], todayEligible: false, publishedAt: new Date(NOW - hoursAgo * 3600e3).toISOString() });
  const f = { tab: 'all' as const, types: [], days: 7, includeOther: false, covered: false, text: '' };
  const pool = [ev('m'), g('new', 5), g('old', 40)];
  assert.deepEqual(archiveList(pool, f, L, NOW).filter((e) => e.scope).map((e) => e.eventClusterId), ['new'], 'older than 36 h is out, whatever the period');
  assert.ok(!archiveList(pool, { ...f, scope: 'india' }, L, NOW).some((e) => e.scope)); assert.ok(archiveList(pool, { ...f, scope: 'global' }, L, NOW).every((e) => e.scope));
  assert.equal(todayGlobalRow(pool, [], L, NOW)?.eventClusterId, 'new'); assert.equal(todayGlobalRow(pool, [{ ...g('new', 5) }], L, NOW), null, 'the same story already listed is not repeated'); assert.equal(todayGlobalRow([ev('m')], [], L, NOW), null);
  assert.ok(!todayList(pool, 'all', L, NOW).some((e) => e.scope), 'Today lists never carry a global event');
});
test('global events: measured moves are words, a missing figure is never zero', () => {
  assert.deepEqual(moveWords(0.43), { arrow: '▲', text: 'up 0.4%', dir: 'up' }); assert.deepEqual(moveWords(-1.24), { arrow: '▼', text: 'down 1.2%', dir: 'down' });
  assert.equal(moveWords(0.01).text, 'flat'); assert.equal(moveWords(null).text, 'not measured'); assert.equal(moveWords(undefined).dir, 'none'); assert.equal(moveWords(NaN).text, 'not measured');
  assert.equal(dayWord('2026-11-11'), '11 Nov'); assert.equal(sectorDay([], 'Energy'), null); assert.equal(sectorDay(undefined, 'Energy'), null);
});
