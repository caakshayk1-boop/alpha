// The News page's sections (revamp v2, 11 Nov 2026): Your names, Paper book, Market, Other covered names. Each event appears once, in the first section that claims it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupNews, groupOf, type NewsEvent } from '../src/newsview.ts';

const ev = (id: string, syms: string[] = []): NewsEvent => ({ eventClusterId: id, headline: `h ${id}`, eventType: 'Results', significance: 0.75, entities: syms.map((s) => ({ sym: s, name: `${s} Ltd.`, confidence: 0.95, matchedOn: 'name' })), scopes: syms.length ? ['company'] : ['market'], publishedAt: '2026-10-27T08:00:00Z', updatedAt: null, firstSeenAt: null, fetchedAt: null, sourceId: 'mint', sourceTitle: 'Mint', sourceTier: 'major', sourceWeight: 0.8, canonicalUrl: `https://x.com/${id}`, sourceTimezone: 'UTC', moreSources: 0, sources: [], summary: null, qualityFlags: [], todayEligible: true, relevanceScore: 50, rankingVersion: 'news-rank-1' });
const L = { follows: ['TCS', 'GCSL'], paper: ['TCS', 'INFY'] };

test('a followed name that is also in the paper book is listed once, under Your names, marked as in the paper book', () => {
  const g = groupNews([ev('t', ['TCS'])], L);
  assert.deepEqual(g.map((x) => [x.id, x.items.length]), [['yours', 1], ['paper', 0], ['market', 0], ['other', 0]]);
  assert.equal(g[0].items[0].inPaper, true);
});
test('each section takes what is left: paper-only names, India-wide events, then names in no list', () => {
  const pool = [ev('m'), ev('g', ['GCSL']), ev('i', ['INFY']), ev('w', ['WIPRO']), ev('ti', ['INFY', 'TCS'])];
  const g = Object.fromEntries(groupNews(pool, L).map((x) => [x.id, x.items.map((i) => i.ev.eventClusterId)]));
  assert.deepEqual(g, { yours: ['g', 'ti'], paper: ['i'], market: ['m'], other: ['w'] });
  assert.equal(groupNews(pool, L)[0].items.find((i) => i.ev.eventClusterId === 'g')!.inPaper, false, 'GCSL is followed but not held');
  assert.deepEqual(pool.map((e) => groupOf(e, L)), ['market', 'yours', 'paper', 'other', 'yours']);
});
test('no headline twice: the totals add up to the input, a repeated id is kept once, and the input order is kept inside a section', () => {
  const pool = [ev('a', ['TCS']), ev('b', ['INFY']), ev('c', ['GCSL']), ev('a', ['TCS']), ev('d')];
  const g = groupNews(pool, L); const ids = g.flatMap((x) => x.items.map((i) => i.ev.eventClusterId));
  assert.equal(ids.length, new Set(ids).size); assert.equal(ids.length, 4); assert.deepEqual(g[0].items.map((i) => i.ev.eventClusterId), ['a', 'c']);
});
test('empty lists: nothing is borrowed. With no follows, a paper-book name stays under Paper book', () => {
  const g = groupNews([ev('t', ['TCS'])], { follows: [], paper: ['TCS'] }); assert.equal(g[0].items.length, 0); assert.equal(g[1].items.length, 1);
  assert.deepEqual(groupNews([], L).map((x) => x.items.length), [0, 0, 0, 0]);
});
