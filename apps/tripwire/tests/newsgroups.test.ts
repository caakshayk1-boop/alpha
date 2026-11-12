// @ts-nocheck  (the pipeline under test is untyped JavaScript, see src/newsjs.d.ts; the assertions are the contract)
// Grouping the coverage of ONE event: the pipeline's item-level rule on fixtures (including the merges that must NOT happen), the same rule applied to events that arrive by two routes, the categories, and the two clocks.
// Fixtures are hand-written headlines in the shape the feeds use. They are not captures of any live service.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterItems, tokens, sameEvent } from '../news/cluster.js';
import { classify } from '../news/events.js';
import { hash } from '../news/urls.js';
import { NEWS_CATEGORIES, categoryOf, mergeCoverage, mergePools, sameCoverage, timeLabels, typeFilterValue, typesFromValue, archiveList, newsCounts } from '../src/newsview.ts';
import { EVENT_TYPES } from '../news/events.js';

const T0 = Date.parse('2026-10-27T06:00:00Z') / 1000;
const E = (sym: string) => [{ sym, name: `${sym} Ltd.`, confidence: 0.95, matchedOn: 'name' }];
const item = (headline: string, o: Record<string, unknown> = {}) => ({ headline, itemId: `it_${hash(`${headline}${o.canonicalUrl ?? ''}`)}`, tk: tokens(headline), eventType: classify(headline).eventType, publishedSec: T0, entities: E('TCS'), canonicalUrl: `https://${o.host ?? 'x.com'}/${hash(headline)}`, ...o });
const groupsOf = (items) => clusterItems(items).map((g) => g.members.map((m) => m.headline).sort());

test('grouping: three outlets telling one results night are one event; an unrelated company the same hour is not pulled in', () => {
  const items = [
    item('TCS Q2 net profit rises 5% to ₹12,300 crore', { host: 'a.com' }),
    item('Tata Consultancy Services Q2 profit up 5%, beats estimates', { host: 'b.com', publishedSec: T0 + 1800 }),
    item('TCS Q2 results: net profit up 5%, revenue ₹65,000 crore', { host: 'c.com', publishedSec: T0 + 3600 }),
    item('Infosys Q2 net profit rises 5% to ₹9,000 crore', { entities: E('INFY'), host: 'd.com' }),
  ];
  const g = groupsOf(items); assert.equal(g.length, 2); assert.deepEqual(g.map((x) => x.length).sort(), [1, 3]);
});

test('grouping: false merges that must not happen', () => {
  const cases: [string, ReturnType<typeof item>, ReturnType<typeof item>][] = [
    ['same company, same night, opposite figures', item('Infosys Q2 profit up 5%', { entities: E('INFY') }), item('Infosys Q2 profit down 3%', { entities: E('INFY') })],
    ['same company, a results night and a buyback', item('TCS Q2 net profit rises 5% to ₹12,300 crore'), item('TCS announces share buyback of ₹15,000 crore')],
    ['same words, different companies', item('Q2 net profit rises 8% on strong demand'), item('Q2 net profit rises 8% on strong demand', { entities: E('WIPRO'), host: 'y.com' })],
    ['the same headline five days apart (a recurring quarterly line)', item('TCS Q2 net profit rises 5%'), item('TCS Q2 net profit rises 5%', { publishedSec: T0 - 5 * 86400, canonicalUrl: 'https://x.com/other' })],
    ['a dividend and a results night of one company', item('TCS declares interim dividend of ₹10 per share'), item('TCS Q2 net profit rises 5% to ₹12,300 crore')],
    ['a rating action and an order win of one company', item('Crisil reaffirms TCS credit rating'), item('TCS bags order worth ₹1,500 crore from a European bank')],
    ['two different orders of one company (different figures)', item('TCS wins order worth ₹1,500 crore from a bank'), item('TCS wins order worth ₹800 crore from an insurer')],
    ['two India-wide policy lines with different figures', item('RBI cuts repo rate by 25 bps to 5.25%', { entities: [] }), item('RBI keeps repo rate unchanged at 5.5%', { entities: [] })],
  ];
  for (const [why, a, b] of cases) { assert.equal(sameEvent(a, b), false, `not one event: ${why}`); assert.equal(sameEvent(b, a), false, `symmetric: ${why}`); assert.equal(clusterItems([a, b]).length, 2, why); }
});

test('grouping: the rule is transitive through union-find but never bridges two different developments', () => {
  const a = item('TCS Q2 net profit rises 5% to ₹12,300 crore', { host: 'a.com' }), b = item('Tata Consultancy Services Q2 profit up 5%, beats estimates', { host: 'b.com' });
  const other = item('TCS announces share buyback of ₹15,000 crore', { host: 'c.com' });
  const g = groupsOf([a, other, b]); assert.equal(g.length, 2); assert.ok(g.some((x) => x.length === 2));
});

test('grouping: the id of an event survives a new outlet joining, and the order of arrival changes nothing', () => {
  const a = { ...item('TCS Q2 net profit rises 5%'), itemId: 'it_a' }, b = { ...item('Tata Consultancy Services Q2 profit up 5%'), itemId: 'it_b' };
  assert.deepEqual(groupsOf([a, b]), groupsOf([b, a]));
});

/* ---- events that reach the browser by two routes ---- */
const src = (id: string, title: string, tier = 'major', url = `https://${id}.com/a`) => ({ sourceId: id, sourceTitle: title, tier, canonicalUrl: url, publishedAt: new Date(T0 * 1000).toISOString() });
const ev = (id: string, headline: string, o: Record<string, unknown> = {}) => ({
  eventClusterId: id, headline, eventType: classify(headline).eventType, significance: 0.75, entities: E('TCS'), scopes: ['company'], publishedAt: new Date(T0 * 1000).toISOString(), updatedAt: new Date(T0 * 1000).toISOString(),
  firstSeenAt: new Date((T0 + 600) * 1000).toISOString(), fetchedAt: null, sourceId: 'a', sourceTitle: 'A', sourceTier: 'major', sourceWeight: 0.8, canonicalUrl: `https://a.com/${id}`, sourceTimezone: 'UTC', moreSources: 0,
  sources: [src('a', 'A', 'major', `https://a.com/${id}`)], summary: null, qualityFlags: [], todayEligible: true, relevanceScore: 0, rankingVersion: 'r', ...o });

test('two routes: the snapshot and a live query report one results night; the page shows ONE row that keeps every outlet link', () => {
  const snap = ev('s1', 'TCS Q2 net profit rises 5% to ₹12,300 crore');
  const live = ev('l9', 'Tata Consultancy Services Q2 profit up 5%, beats estimates', { sourceId: 'b', sourceTitle: 'B', sources: [src('b', 'B', 'wire', 'https://b.com/x')], sourceTier: 'wire', canonicalUrl: 'https://b.com/x', publishedAt: new Date((T0 - 1800) * 1000).toISOString() });
  const m = mergePools([snap], [live]); assert.equal(m.length, 1);
  assert.equal(m[0].eventClusterId, 's1', 'the snapshot id is kept'); assert.deepEqual(m[0].sources.map((s) => s.sourceId).sort(), ['a', 'b']); assert.equal(m[0].moreSources, 1);
  assert.equal(m[0].sourceId, 'b', 'the more authoritative outlet becomes primary'); assert.equal(m[0].publishedAt, new Date((T0 - 1800) * 1000).toISOString(), 'the earliest publication time');
  assert.ok(m[0].sources.every((s) => s.canonicalUrl.startsWith('https://')));
});
test('two routes: a buyback and a results night of one company stay two rows; so do opposite figures', () => {
  const snap = ev('s1', 'TCS Q2 net profit rises 5% to ₹12,300 crore');
  assert.equal(mergePools([snap], [ev('l1', 'TCS announces share buyback of ₹15,000 crore', { sourceId: 'c', sources: [src('c', 'C')] })]).length, 2);
  assert.equal(mergePools([ev('s2', 'Infosys Q2 profit up 5%', { entities: E('INFY') })], [ev('l2', 'Infosys Q2 profit down 3%', { entities: E('INFY'), sourceId: 'c', sources: [src('c', 'C')] })]).length, 2);
  assert.equal(sameCoverage(snap, ev('x', 'TCS Q2 net profit rises 5% to ₹12,300 crore', { entities: E('WIPRO') })), false, 'a different company is never the same event');
});
test('two routes: 12 Nov 2026 (news-pipe-3): two snapshot events that are one event by the pipeline rule are merged by the browser too (an older snapshot may hold both); the source cap is the pipeline\'s own', () => {
  const a = ev('s1', 'TCS Q2 net profit rises 5%'), b = ev('s2', 'Tata Consultancy Services Q2 profit up 5%', { sourceId: 'b', sources: [src('b', 'B')] });
  assert.equal(mergePools([a, b], []).length, 1, 'same company, same kind, same figure');
  assert.equal(mergePools([a, ev('s3', 'TCS announces share buyback of ₹15,000 crore')], []).length, 2, 'a results night and a buyback stay two');
  const many = ev('l1', 'Tata Consultancy Services Q2 profit up 5%', { sources: ['p', 'q', 'r', 's', 't', 'u', 'v'].map((i) => src(i, i.toUpperCase())) });
  assert.ok(mergeCoverage(a, many).sources.length <= 6);
});
test('merged coverage counts as one event in the counts, and each outlet as one article', () => {
  const m = mergePools([ev('s1', 'TCS Q2 net profit rises 5%')], [ev('l1', 'Tata Consultancy Services Q2 profit up 5%', { sourceId: 'b', sources: [src('b', 'B')] })]);
  const c = newsCounts(m); assert.deepEqual([c.events, c.articles, c.companies], [1, 2, 1]);
});

/* ---- categories ---- */
test('categories: every event type belongs to exactly one category; a category is a lookup, not a judgement', () => {
  const all = NEWS_CATEGORIES.flatMap((c) => c.types); assert.equal(new Set(all).size, all.length, 'no type twice');
  for (const t of EVENT_TYPES) assert.ok(all.includes(t), `${t} has a category`);
  assert.equal(categoryOf('Payout'), 'Deals, payouts and listings'); assert.equal(categoryOf('Regulator'), 'Regulation, policy and filings'); assert.equal(categoryOf('nonsense'), 'Other updates');
  assert.ok(!NEWS_CATEGORIES.some((c) => /good|bad|bull|bear|positive|negative/i.test(c.label)), 'no sentiment words');
});
test('categories: the filter value round-trips and filters the archive', () => {
  assert.equal(typeFilterValue([]), ''); assert.equal(typeFilterValue(['Results']), 'Results'); assert.equal(typeFilterValue(typesFromValue('cat:deals')), 'cat:deals'); assert.deepEqual(typesFromValue('cat:nope'), []);
  const now = (T0 + 3600) * 1000; const pool = [ev('r', 'TCS Q2 net profit rises 5%'), ev('d', 'TCS declares interim dividend of ₹10 per share', { eventType: 'Payout' }), ev('b', 'TCS buyback of ₹15,000 crore', { eventType: 'Deal' })];
  const f = { tab: 'all', types: typesFromValue('cat:deals'), days: 7, includeOther: false, covered: true, text: '' };
  assert.deepEqual(archiveList(pool, f, { follows: [], paper: [] }, now).map((e) => e.eventClusterId).sort(), ['b', 'd']);
});

/* ---- two clocks ---- */
test('clocks: publication and collection are separate words; an unknown publication time is never replaced by the collection time', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const t = timeLabels({ publishedAt: '2026-10-27T06:00:00Z', firstSeenAt: '2026-10-27T10:00:00Z' }, now);
  assert.equal(t.published, 'Published 6 h ago'); assert.equal(t.collected, 'Collected 2 h ago'); assert.equal(t.gap, 'Collected 4 h after it was published');
  const u = timeLabels({ publishedAt: null, firstSeenAt: '2026-10-27T10:00:00Z' }, now); assert.equal(u.published, 'Publication time unknown'); assert.equal(u.collected, 'Collected 2 h ago'); assert.equal(u.gap, null);
  assert.equal(timeLabels({ publishedAt: '2026-10-27T11:50:00Z', firstSeenAt: '2026-10-27T11:55:00Z' }, now).gap, null, 'a few minutes apart is not worth a sentence');
  assert.equal(timeLabels({ publishedAt: '2026-10-28T06:00:00Z', firstSeenAt: null }, now).published, 'Publication time unknown', 'a future time is not shown');
  assert.equal(timeLabels({ publishedAt: null, firstSeenAt: null }, now).collected, 'Collection time unknown');
});

test('overflow outlets are not lost: moreSources survives a merge and the article count includes it (the producer keeps six links and counts the rest)', () => {
  const six = ['p', 'q', 'r', 's', 't', 'u'].map((i) => src(i, i.toUpperCase()));
  const big = ev('s1', 'TCS Q2 net profit rises 5%', { sources: six, moreSources: 9 });   // 10 outlets in all, six links kept
  const live = ev('l1', 'Tata Consultancy Services Q2 profit up 5%', { sourceId: 'b', sources: [src('b', 'B')] });
  const m = mergePools([big], [live]); assert.equal(m.length, 1);
  assert.ok(m[0].moreSources >= 9, 'the snapshot event already knew of ten outlets; the merged total is never below that');
  assert.equal(newsCounts([big]).articles, 10, 'ten outlets are ten articles, not six');
});


test('duplicate ids and shared URLs keep newly discovered sources, entities and dates', () => {
  const a = ev('s1', 'TCS Q2 net profit rises 5%');
  const b = ev('s1', a.headline, { sources: [...a.sources, src('b', 'B')], moreSources: 1, entities: [...E('TCS'), ...E('INFY')], updatedAt: new Date((T0 + 900) * 1000).toISOString() });
  for (const next of [b, { ...b, eventClusterId: 'other-id' }]) {
    const out = mergePools([a], [next]);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].sources.map(s => s.sourceId), ['a', 'b']);
    assert.equal(out[0].entities.length, 2);
    assert.equal(out[0].updatedAt, b.updatedAt);
    assert.equal(out[0].eventClusterId, a.eventClusterId);
    assert.deepEqual(mergePools(out, [next]), out, 'a repeated refresh is idempotent');
  }
  assert.equal(a.sources.length, 1, 'input snapshot untouched');
});
test('absent URLs are never a duplicate identity', () => {
  const a = ev('a', 'TCS Q2 profit rises 5%', { canonicalUrl: '', sources: [] });
  const b = ev('b', 'TCS declares interim dividend', { canonicalUrl: '', sources: [] });
  assert.equal(mergePools([a], [b]).length, 2);
});
