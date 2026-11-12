// @ts-nocheck  (the pipeline under test is untyped JavaScript, see src/newsjs.d.ts; the assertions are the contract)
// 12 Nov 2026 (news-pipe-3): two days at most, and no duplicates. Fixtures are the owner's three real headlines plus negative cases. The clock is a fixed NOW, never the live one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameEvent, tokens, normTitle, clusterItems } from '../news/cluster.js';
import { classify } from '../news/events.js';
import { FEEDS, MAX_AGE_DAYS, TODAY_WINDOW_H, PIPELINE_VERSION, sourceTier } from '../news/config.js';
import { judge, isPromoRewrite } from '../news/rules.js';
import { buildRegistry, runPipeline } from '../news/pipeline.js';
import { archiveList, collapseDuplicates, groupNews, mergePools, newsCounts, fitForToday } from '../src/newsview.ts';

const NOW = Date.parse('2026-11-12T06:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60e3).toISOString();
const REG = buildRegistry([{ sym: 'ECLERX', name: 'eClerx Services Ltd.', aliases: ['eClerx'] }, { sym: 'CUPID', name: 'Cupid Ltd.', aliases: [] }, { sym: 'TCS', name: 'Tata Consultancy Services Ltd.', aliases: ['TCS'] }]);
const raw = (title: string, publisher: string, link: string, min: number) => ({ title, link, dateText: ago(min), publisher, publisherUrl: '', description: '' });
const run = (rawItems: unknown[], extra = {}) => runPipeline({ batches: [{ feed: FEEDS.google, rawItems, fetchedAt: ago(0) }], registry: REG, nowMs: NOW, ...extra });

const A = 'eClerx Services Acquires RegEdge LLC to Expand Risk and Regulatory Capabilities', B = 'eClerx acquires RegEdge for enhanced compliance services';
const EC = [{ sym: 'ECLERX', name: 'eClerx Services Ltd.', confidence: 0.95, matchedOn: 'name' }];
const cand = (headline: string, min: number, o = {}) => ({ headline, tk: tokens(headline), eventType: classify(headline).eventType, publishedSec: Math.floor((NOW - min * 60e3) / 1000), entities: EC, canonicalUrl: `https://x.com/${encodeURIComponent(headline)}`, ...o });

test('the version and the window: news-pipe-3, two days, Today 48 h for both kinds', () => {
  assert.equal(PIPELINE_VERSION, 'news-pipe-3'); assert.equal(MAX_AGE_DAYS, 2); assert.equal(TODAY_WINDOW_H.company, 48); assert.equal(TODAY_WINDOW_H.market, 48); assert.equal(TODAY_WINDOW_H.global, 36);
  const base = { title: 'TCS Q2 net profit rises 5% to Rs 12,300 crore', url: 'https://www.livemint.com/a/1', nowMs: NOW };
  assert.deepEqual(judge({ ...base, publishedSec: NOW / 1000 - 47 * 3600 }).reasons, []); assert.deepEqual(judge({ ...base, publishedSec: NOW / 1000 - 49 * 3600 }).reasons, ['stale']);
});

test('the owner\'s pair: eClerx / RegEdge told by two outlets with no figure is ONE event', () => {
  assert.ok(sameEvent(cand(A, 54), cand(B, 35)), 'the distinctive word RegEdge, the company, the kind of event and the hour');
  assert.ok(sameEvent(cand(B, 35), cand(A, 54)), 'symmetric');
  assert.equal(classify(A).eventType, 'Deal'); assert.equal(classify(B).eventType, 'Deal');
});
test('the pair merges through the pipeline: one event, every outlet link kept, the better-tier outlet primary; later copies never become rows', () => {
  const items = [raw(`${B} - InvestyWise`, 'InvestyWise', 'https://investywise.com/a', 54), raw(`${A} - Sahi`, 'Sahi', 'https://sahi.com/b', 35), raw(`${A} - Mint`, 'Mint', 'https://www.livemint.com/c', 20)];
  const p = run(items); assert.equal(p.events.length, 1, p.events.map((e) => e.headline).join(' | '));
  const e = p.events[0]; assert.equal(e.sources.length, 3); assert.equal(e.moreSources, 2); assert.equal(e.sourceTitle, 'Mint', 'the major outlet is primary'); assert.deepEqual(e.sources.map((s) => s.canonicalUrl).sort(), ['https://investywise.com/a', 'https://livemint.com/c', 'https://sahi.com/b']);
  assert.equal(newsCounts(p.events).events, 1); assert.equal(newsCounts(p.events).articles, 3);
  const later = run([...items, raw(`${B} - Moneycontrol`, 'Moneycontrol', 'https://moneycontrol.com/d', 5)], { prevItems: p.events.flatMap((x) => x.items) });
  assert.equal(later.events.length, 1); assert.equal(later.events[0].eventClusterId, e.eventClusterId); assert.equal(later.events[0].sources.length, 4);
});
test('negatives: two real different developments of one company stay two events', () => {
  assert.ok(!sameEvent(cand(A, 54), cand('eClerx acquires Acme Analytics Inc to add insurance data skills', 35)), 'a different target');
  assert.ok(!sameEvent(cand('eClerx Services Acquires RegEdge LLC', 60), cand('eClerx announces share buyback worth Rs 400 crore', 50)), 'a deal and a buyback');
  assert.ok(!sameEvent(cand('eClerx Q2 net profit rises 5% to Rs 120 crore', 60), cand('eClerx Q2 net profit falls 3% to Rs 99 crore', 50)), 'different figures');
  assert.ok(!sameEvent(cand('eClerx Q2 profit rises sharply on RegEdge integration', 60), cand('eClerx Q2 profit falls sharply on RegEdge integration', 50)), 'up and down with no figure');
  assert.ok(!sameEvent(cand(A, 54), cand(B, 54 + 40 * 60)), 'the same words 40 hours apart are not merged on a shared word alone');
  assert.ok(!sameEvent(cand(A, 54), cand(B, 35, { entities: [{ sym: 'TCS', name: 'Tata Consultancy Services Ltd.', confidence: 0.95, matchedOn: 'name' }] })), 'a different company');
  assert.ok(!sameEvent(cand('Oil rises as Opec weighs cuts', 30, { entities: [], scope: 'global' }), cand('Oil rises as Opec weighs cuts', 30, { entities: [] })), 'global and India never merge');
  const items = [raw('eClerx Services Acquires RegEdge LLC to Expand Risk Capabilities - Mint', 'Mint', 'https://www.livemint.com/1', 90), raw('eClerx wins Rs 200 crore order from a US bank - Mint', 'Mint', 'https://www.livemint.com/2', 80)];
  assert.equal(run(items).events.length, 2);
});
test('the same title under another outlet, case or prefix is one row', () => {
  assert.equal(normTitle('Exclusive: eClerx Acquires RegEdge LLC - Mint'), normTitle('ECLERX ACQUIRES REGEDGE LLC!'));
  assert.equal(normTitle('Bank of India Q2 profit up 8% | Moneycontrol'), 'bank of india q2 profit up 8%'.replace('%', ''));
  const p = run([raw('Exclusive: eClerx Acquires RegEdge LLC for Rs 40 crore - Mint', 'Mint', 'https://www.livemint.com/x?utm=1', 40), raw('ECLERX ACQUIRES REGEDGE LLC FOR RS 40 CRORE', 'Business Standard', 'https://www.business-standard.com/y', 30)]);
  assert.equal(p.events.length, 1); assert.equal(p.events[0].sources.length, 2);
});
test('the older merges still hold: one results night in different words', () => {
  const t = { entities: [{ sym: 'TCS', confidence: 0.95 }] };
  assert.ok(sameEvent(cand('TCS Q2 net profit rises 5% to Rs 12,300 crore', 60, t), cand('Tata Consultancy Services Q2 profit up 5%, beats estimates', 50, t)));
});

test('promotional rewrite: Cupid / MarketsMojo is an aggregator; kept only as the sole report of a results event, labelled, low and off Today', () => {
  const H = 'Cupid Ltd Reports Very Positive Quarterly Financial Performance Amid Strong Market Returns';
  assert.equal(sourceTier('MarketsMojo', 'marketsmojo.com').tier, 'aggregator'); assert.ok(isPromoRewrite(H));
  const only = run([raw(H, 'MarketsMojo', 'https://www.marketsmojo.com/news/cupid-1', 40)]); assert.equal(only.events.length, 1); const e = only.events[0];
  assert.equal(e.sourceTier, 'aggregator'); assert.ok(e.qualityFlags.includes('promotional_rewrite') && e.qualityFlags.includes('aggregator_source')); assert.ok(e.significance <= 0.3); assert.equal(e.todayEligible, false);
  const both = run([raw(H, 'MarketsMojo', 'https://www.marketsmojo.com/news/cupid-1', 40), raw('Cupid Q2 net profit rises 12% to Rs 30 crore', 'Business Standard', 'https://www.business-standard.com/cupid', 100)]);
  assert.equal(both.events.length, 1); assert.equal(both.events[0].sourceTitle, 'Business Standard'); assert.equal(both.rejections.promotional_rewrite, 1);
  for (const pub of ['Reuters', 'Mint', 'PTI']) { const r = run([raw(H, pub, `https://example.com/${pub}`, 40)]); assert.equal(r.events.length, 1); assert.ok(!r.events[0].qualityFlags.includes('promotional_rewrite')); assert.ok(r.events[0].significance > 0.3); }
  assert.ok(!isPromoRewrite('Cupid reports strong quarterly results, net profit up 12%'));
  const stock = run([raw('Cupid Ltd stock gains amid strong market returns', 'MarketsMojo', 'https://www.marketsmojo.com/news/cupid-2', 40)]); assert.equal(stock.events.length, 0);
});

test('cross-lane: an event under Your names and Paper book is shown once, with the real shapes', () => {
  const p = run([raw(A, 'Sahi', 'https://sahi.com/b', 35), raw(B, 'InvestyWise', 'https://investywise.com/a', 54)], { paperSyms: ['ECLERX'] });
  const live = run([raw(`${B} - Moneycontrol`, 'Moneycontrol', 'https://moneycontrol.com/d', 30)]);
  const strip = (x) => x.events.map(({ items: _i, ...e }) => e);
  const pool = mergePools(strip(p), strip(live));
  const L = { follows: ['ECLERX'], paper: ['ECLERX'] }; const rows = archiveList(pool, { tab: 'all', types: [], days: 2, includeOther: false, covered: false, text: '' }, L, NOW);
  assert.equal(rows.length, 1); const g = groupNews(rows, L); assert.deepEqual(g.map((x) => x.items.length), [0, 1, 0, 0, 0]); assert.equal(g[1].items[0].inPaper, true);
  assert.equal(newsCounts(rows).events, 1); assert.equal(rows[0].sources.length, 3);
  const dup = strip(p); assert.equal(collapseDuplicates([dup[0], { ...dup[0], eventClusterId: 'ev_other' }]).length, 1);
});
test('two days: the archive drops older events, and old stored events age out without a crash', () => {
  const p = run([raw(A, 'Mint', 'https://www.livemint.com/a', 35)]); const e = p.events.map(({ items: _i, ...x }) => x)[0];
  const old = { ...e, eventClusterId: 'ev_old', canonicalUrl: 'https://x.com/old', sources: [], moreSources: 0, headline: 'eClerx old', publishedAt: new Date(NOW - 10 * 86400e3).toISOString() };
  const L = { follows: ['ECLERX'], paper: [] }; const f = { tab: 'all', types: [], days: MAX_AGE_DAYS, includeOther: false, covered: false, text: '' };
  assert.deepEqual(archiveList([e, old], f, L, NOW).map((x) => x.eventClusterId), [e.eventClusterId]); assert.equal(fitForToday(old, NOW), false);
  const again = run([], { prevItems: p.events.flatMap((x) => x.items).map((i) => ({ ...i, publishedAt: new Date(NOW - 3 * 86400e3).toISOString() })) });
  assert.equal(again.events.length, 0); assert.ok(again.rejections.stale >= 1);
});
test('clusterItems keeps an event id when a syndicated copy joins', () => {
  const mk = (h: string, id: string, min: number) => ({ ...cand(h, min), itemId: id });
  const first = clusterItems([mk(A, 'it_a', 54)], new Map()); const again = clusterItems([mk(A, 'it_a', 54), mk(B, 'it_b', 35)], new Map([['it_a', first[0].eventClusterId]]));
  assert.equal(again.length, 1); assert.equal(again[0].eventClusterId, first[0].eventClusterId);
});
