// @ts-nocheck  (the pipeline under test is untyped JavaScript, see src/newsjs.d.ts; the assertions are the contract)
// 12 Nov 2026 (news-pipe-2): the global-cue lane. Fixtures are built relative to a fixed NOW, never the live clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameEvent, tokens } from '../news/cluster.js';
import { classify } from '../news/events.js';
import { hash } from '../news/urls.js';
import { buildRegistry } from '../news/entities.js';
import { capGlobal, runPipeline } from '../news/pipeline.js';
import { FEEDS, GLOBAL_LIMITS, PIPELINE_VERSION } from '../news/config.js';
import { queryPlan } from '../news/plan.js';

const NOW = Date.parse('2026-10-27T06:00:00Z');
const REG = buildRegistry([{ sym: 'TCS', name: 'Tata Consultancy Services Ltd.', aliases: ['TCS'] }]);
const gItem = (title: string, publisher: string, hoursAgo: number, n: number) => ({ title, link: `https://example.com/g/${n}`, dateText: new Date(NOW - hoursAgo * 3600e3).toUTCString(), publisher, publisherUrl: '', description: '', guid: `g${n}` });
const batch = (raws, scope) => ({ feed: FEEDS.google, rawItems: raws, fetchedAt: new Date(NOW).toISOString(), scope });
const gRun = (raws) => runPipeline({ batches: [batch(raws, 'global')], registry: REG, nowMs: NOW, paperSyms: ['TCS'] });
const cand = (headline: string, o = {}) => ({ headline, itemId: `it_${hash(headline)}`, tk: tokens(headline), eventType: classify(headline).eventType, publishedSec: NOW / 1000 - 3600, entities: [], canonicalUrl: `https://x.com/${hash(headline)}`, ...o });

test('global lane: the version is news-pipe-4 (12 Nov 2026, was news-pipe-2) and the plan carries the global searches in scope global', () => {
  assert.equal(PIPELINE_VERSION, 'news-pipe-4'); const plan = queryPlan({ names: { paper: [], covered: [], names: {} }, tick: 0 });
  assert.ok(plan.filter((s) => s.scope === 'global').length >= 5 && plan.filter((s) => s.scope === 'global').every((s) => s.feed === 'google' && s.query));
});
test('global lane: another country\'s market story is admitted when a cue rule matches, from a known tier, inside 36 h; it carries scope and cues and names no company', () => {
  const p = gRun([gItem('Wall Street ends lower as Federal Reserve officials signal caution', 'Reuters', 5, 1)]);
  assert.deepEqual(p.rejections, {}); assert.equal(p.events.length, 1); const e = p.events[0];
  assert.equal(e.scope, 'global'); assert.deepEqual(e.scopes, ['global']); assert.deepEqual(e.cues, ['fed_rates', 'us_equities']); assert.deepEqual(e.entities, []); assert.equal(e.todayEligible, false, 'never a Today candidate by itself');
});
test('global lane: no cue -> not_a_cue; aggregator or unknown -> global_source; older than 36 h -> global_window; a stock tip is still refused; three outlets, one event', () => {
  const p = gRun([gItem('Local council approves new parking rules', 'Reuters', 2, 1), gItem('Brent crude rises on supply worries', 'TradingView', 2, 2), gItem('Brent crude slips on demand worries', 'Some Blog', 2, 3),
    gItem('OPEC+ agrees output cut for crude oil', 'Reuters', 40, 4), gItem('Multibagger crude oil stock to buy now', 'Reuters', 2, 5), gItem('Gold prices rally as Treasury yields fall', 'Mint', 3, 6), gItem('Gold prices rally as Treasury yields fall sharply', 'Bloomberg', 4, 7), gItem('Gold prices rally as Treasury yields fall again', 'The Hindu', 5, 8)]);
  assert.deepEqual(p.rejections, { not_a_cue: 1, global_source: 2, global_window: 1, stocks_to_watch: 1 }); assert.equal(p.events.length, 1); assert.equal(p.events[0].moreSources, 2);
});
test('global lane: at most two events per cue and ten in all, and the cap is a pure function', () => {
  const ev = (i: number, cue: string, h = 1) => ({ eventClusterId: `e${i}`, scope: 'global', cues: [cue], publishedAt: new Date(NOW - h * 3600e3).toISOString() });
  const list = [ev(1, 'crude'), ev(2, 'crude'), ev(3, 'crude'), ev(4, 'fed_rates'), { eventClusterId: 'c', scope: undefined, publishedAt: null }, ev(5, 'metals', 40)];
  assert.deepEqual(capGlobal(list, NOW).map((e) => e.eventClusterId), ['e1', 'e2', 'e4', 'c'], 'third crude and the 40 h old one dropped; India events untouched');
  const many = Array.from({ length: 30 }, (_, i) => ev(i, ['a', 'b', 'c', 'd', 'e', 'f', 'g'][i % 7])); assert.equal(capGlobal(many, NOW).length, GLOBAL_LIMITS.total);
});
test('global lane: never merges with an India event, and the same link in both lanes keeps the India reading', () => {
  const g = { ...cand('Brent crude rises on supply worries'), scope: 'global' }, m = cand('Brent crude rises on supply worries'); assert.ok(!sameEvent(g, m)); assert.ok(sameEvent(g, { ...g }));
  const raw = gItem('India crude imports: Brent rises, rupee weak', 'Reuters', 2, 9);
  const p = runPipeline({ batches: [batch([raw], 'market'), batch([raw], 'global')], registry: REG, nowMs: NOW });
  assert.equal(p.events.length, 1); assert.ok(!p.events[0].scope); assert.deepEqual(p.events[0].scopes, ['market']);
});
test('global lane: a re-run over the previous snapshot keeps the global event (scope survives) and ages it out after 36 h', () => {
  const first = gRun([gItem('Brent crude rises on supply worries', 'Reuters', 5, 11)]); const prevItems = first.events.flatMap((e) => e.items);
  const again = runPipeline({ batches: [], registry: REG, prevItems, nowMs: NOW + 3600e3, paperSyms: [] }); assert.equal(again.events.length, 1); assert.equal(again.events[0].scope, 'global');
  const late = runPipeline({ batches: [], registry: REG, prevItems, nowMs: NOW + 40 * 3600e3, paperSyms: [] }); assert.equal(late.events.length, 0); assert.equal(late.rejections.global_window, 1);
});
