// News: six distinct states (loading / empty / delayed / partial / error / success) and counts that mean one thing each (events / articles / companies) and equal what is displayed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newsHealth, newsViewState, type StatusDoc } from '../src/newshealth.ts';
import { archiveList, archiveTabCounts, countsLine, newsCounts, todayList, todayTabCounts, type ArchiveFilter, type NewsEvent } from '../src/newsview.ts';

const Z = (s: string) => Date.parse(s);
const doc = (o: Partial<StatusDoc> = {}): StatusDoc => ({ snapshotVersion: 7, status: 'ok', checkedAt: '2026-10-27T06:00:00.000Z', lastSuccessfulAt: '2026-10-27T06:00:00.000Z', nextScheduledAt: '2026-10-27T06:15:00.000Z', cadenceMin: 15, sourcesTotal: 4, sourcesFailed: 0, ...o });
const NOW = Z('2026-10-27T06:05:00Z');

test('loading: before the first answer there is no "Unavailable": the state is loading, with its own word and line', () => {
  const h = newsHealth({ doc: null, loaded: false, nowMs: NOW }); assert.equal(h.state, 'loading'); assert.equal(h.word, 'Checking'); assert.ok(!/unavailable/i.test(h.line + h.word));
  assert.equal(newsHealth({ doc: null, loaded: true, nowMs: NOW }).state, 'unavailable', 'after the answer says nothing was published, it is unavailable');
  assert.equal(newsHealth({ doc: null, loaded: true, unreachable: true, nowMs: NOW }).state, 'error', 'unreachable with nothing saved is an error, not "unavailable"');
  assert.equal(newsHealth({ doc: null, loaded: false, remembered: doc(), nowMs: NOW }).state, 'fresh', 'a saved copy is judged by its age while the first answer is on its way');
});
test('the six views are told apart from health and rows alone', () => {
  const view = (h: Parameters<typeof newsHealth>[0], loading: boolean, rows: number) => newsViewState(newsHealth(h), { loading, rows });
  assert.equal(view({ doc: null, loaded: false, nowMs: NOW }, true, 0), 'loading');
  assert.equal(view({ doc: doc(), nowMs: NOW }, true, 5), 'loading', 'the list still assembling is loading even with a health answer');
  assert.equal(view({ doc: doc(), nowMs: NOW }, false, 0), 'empty'); assert.equal(view({ doc: null, loaded: true, nowMs: NOW }, false, 0), 'empty');
  assert.equal(view({ doc: doc(), nowMs: Z('2026-10-27T07:00:00Z') }, false, 3), 'delayed');
  assert.equal(view({ doc: doc({ status: 'partial', sourcesFailed: 1 }), nowMs: NOW }, false, 3), 'partial');
  assert.equal(view({ doc: null, loaded: true, unreachable: true, nowMs: NOW }, false, 0), 'error');
  assert.equal(view({ doc: doc(), nowMs: NOW }, false, 3), 'success');
  assert.equal(new Set(['loading', 'empty', 'delayed', 'partial', 'error', 'success']).size, 6);
});

const h = (x: number) => new Date(NOW - x * 3600e3).toISOString();
const ev = (id: string, o: Partial<NewsEvent> & { sym?: string; nsrc?: number } = {}): NewsEvent => { const { sym, nsrc, ...rest } = o; return { eventClusterId: id, headline: id, eventType: 'Results', significance: 0.75, entities: sym ? [{ sym, name: `${sym} Ltd.`, confidence: 0.95, matchedOn: 'name' }] : [], scopes: sym ? ['company'] : ['market'], publishedAt: h(2), updatedAt: h(2), firstSeenAt: h(1.9), fetchedAt: h(1), sourceId: 'mint', sourceTitle: 'Mint', sourceTier: 'major', sourceWeight: 0.8, canonicalUrl: `https://x.com/${id}`, sourceTimezone: 'UTC', moreSources: 0, sources: Array.from({ length: nsrc ?? 1 }, (_, i) => ({ sourceId: `s${i}`, sourceTitle: `S${i}`, tier: 'major', canonicalUrl: `https://x.com/${id}/${i}`, publishedAt: h(2) })), summary: null, qualityFlags: [], todayEligible: true, relevanceScore: 50, rankingVersion: 'news-rank-1', ...rest }; };
const L = { follows: ['TCS'], paper: ['INFY'] };

test('counts: an event is one story however many outlets; articles are the outlets; companies are distinct verified names (India-wide names none)', () => {
  const evs = [ev('a', { sym: 'TCS', nsrc: 3 }), ev('b', { sym: 'TCS', nsrc: 1 }), ev('c', { sym: 'INFY', nsrc: 2 }), ev('m', { nsrc: 2 })];
  assert.deepEqual(newsCounts(evs), { events: 4, articles: 8, companies: 2, marketEvents: 1 });
  assert.equal(countsLine(newsCounts(evs)), '4 events · 8 articles · 2 companies'); assert.equal(countsLine(newsCounts([ev('x', { sym: 'TCS', nsrc: 1 })])), '1 event · 1 article · 1 company');
  assert.deepEqual(newsCounts([]), { events: 0, articles: 0, companies: 0, marketEvents: 0 }); assert.equal(newsCounts([ev('z', { sym: 'TCS', nsrc: 0 })]).articles, 1, 'an event with no listed outlet is still one article');
});
test('the News page: every tab number equals the total shown after pressing it, under the same filters', () => {
  const pool = [ev('a', { sym: 'TCS', publishedAt: h(5) }), ev('b', { sym: 'INFY', publishedAt: h(24 * 5) }), ev('c', { sym: 'WIPRO', publishedAt: h(3) }), ev('m', { publishedAt: h(30) }), ev('u', { sym: 'TCS', eventType: 'Update' })];
  for (const days of [2, 7]) for (const includeOther of [false, true]) for (const covered of [false, true]) {
    const f: ArchiveFilter = { tab: 'all', types: [], days, includeOther, covered, text: '' }; const counts = archiveTabCounts(pool, f, L, NOW);
    for (const tab of ['all', 'market', 'following', 'paper'] as const) assert.equal(counts[tab], archiveList(pool, { ...f, tab }, L, NOW).length, `${tab} days=${days} other=${includeOther} covered=${covered}`);
  }
});
test('Today: a tab number equals the list Today can reach (diversified and capped), not the raw pool', () => {
  const many = Array.from({ length: 14 }, (_, i) => ev(`m${i}`, { publishedAt: h(1 + i * 0.1) }));
  const c = todayTabCounts(many, L, NOW); assert.equal(c.all, todayList(many, 'all', L, NOW).length); assert.equal(c.all, 10, 'capped at ten, as the list is');
});
