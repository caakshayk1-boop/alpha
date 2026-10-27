// @ts-nocheck  (the Worker is plain JavaScript)
// The Worker's news routes, offline: the published snapshot and its status (200 with ok:false when absent or unreadable), the live per-name query through the same pipeline, the forced-refresh limit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker.js';

const fx = (f: string) => readFileSync(new URL(`./fixtures/news/ok/${f}`, import.meta.url), 'utf8');
const store = new Map<string, Response>();
(globalThis as any).caches = { default: { match: async (k: Request) => store.get(k.url)?.clone(), put: async (k: Request, r: Response) => { store.set(k.url, r.clone()); } } };
const ctx = { waitUntil: (p: Promise<unknown>) => p }; const env = { ASSETS: { fetch: async () => new Response('asset') } };
const realFetch = globalThis.fetch;
const route = (table: Record<string, () => Response>) => { (globalThis as any).fetch = async (u: string) => { for (const k of Object.keys(table)) if (decodeURIComponent(String(u)).includes(k)) return table[k](); return new Response('', { status: 404 }); }; };
const get = (path: string, ip = '1.1.1.1') => worker.fetch(new Request(`https://tripwire.test${path}`, { headers: { 'cf-connecting-ip': ip } }), env, ctx);
const reset = () => { store.clear(); };

test('version and snapshot: served from the data branch, 200 ok:false when absent, 200 ok:false (with Retry-After passed on) when upstream fails, shape checked', async () => {
  reset(); route({ 'news-status.json': () => new Response(JSON.stringify({ schema: 'tripwire-news-status/1', snapshotVersion: 3, status: 'ok', checkedAt: '2026-10-27T06:00:00.000Z', lastSuccessfulAt: '2026-10-27T06:00:00.000Z' })) });
  const v = await get('/api/news/version'); assert.equal(v.status, 200); const vj = await v.json(); assert.deepEqual([vj.ok, vj.snapshotVersion, vj.status], [true, 3, 'ok']); assert.ok(vj.served_at);
  reset(); route({}); const a = await get('/api/news'); assert.equal(a.status, 200); assert.deepEqual(await a.json(), { ok: false, reason: 'absent', error: 'the first news check has not been published yet' });
  reset(); route({ 'news-browser.json': () => new Response('', { status: 429, headers: { 'retry-after': '120' } }) }); const u = await (await get('/api/news')).json(); assert.deepEqual([u.ok, u.reason, u.retry_after], [false, 'upstream', 120]);
  reset(); route({ 'news-browser.json': () => new Response(JSON.stringify({ schema: 'other/1' })) }); assert.equal((await (await get('/api/news')).json()).reason, 'shape');
  reset(); route({ 'news-browser.json': () => new Response('{"schema":"tripwire-news/1","events":[],"snapshotVersion":9}') }); const s = await (await get('/api/news')).json(); assert.deepEqual([s.ok, s.snapshotVersion], [true, 9]);
  assert.equal((await worker.fetch(new Request('https://tripwire.test/api/news/version', { method: 'POST' }), env, ctx)).status, 405);
});
test('live query: one company, through the same pipeline and gates; only stories that name it', async () => {
  reset(); route({ 'rss/search?q="Tata Consultancy Services"': () => new Response(fx('google-tcs.xml')) });
  const r = await get('/api/news?q=' + encodeURIComponent('"Tata Consultancy Services" when:7d') + '&sym=TCS'); assert.equal(r.status, 200); const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.schema, 'tripwire-news-q/1'); assert.equal(j.via, 'google-news'); assert.ok(j.events.length >= 3); assert.ok(j.events.every((e: any) => e.entities[0].sym === 'TCS' && !('items' in e)));
  assert.ok(j.rejections.quote_page >= 0 && j.rejections.landing_page === 1 && j.rejections.future_timestamp === 1, JSON.stringify(j.rejections)); assert.ok(!j.events.some((e: any) => /Wall Street|Nasdaq|Share Price Today|support at/.test(e.headline)));
  assert.equal(j.rankingVersion, 'news-rank-1');
});
test('live query: a market query admits only India-wide events; a bad query is a 400; both feeds down is 200 ok:false with Retry-After carried', async () => {
  reset(); route({ 'rss/search?q=Sensex Nifty': () => new Response(fx('google-market.xml')) }); const j = await (await get('/api/news?q=' + encodeURIComponent('Sensex Nifty when:2d'))).json();
  assert.ok(j.ok && j.events.length === 2 && j.events.every((e: any) => e.entities.length === 0), j.events?.map((e: any) => e.headline).join(' | '));
  assert.equal((await get('/api/news?q=' + encodeURIComponent('<script>'))).status, 400); assert.equal((await get('/api/news?q=' + encodeURIComponent('"A B" when:7d') + '&sym=bad%20sym')).status, 400);
  reset(); route({ 'news.google.com': () => new Response('', { status: 503, headers: { 'retry-after': '90' } }), 'bing.com': () => new Response('', { status: 503 }) });
  const d = await get('/api/news?q=' + encodeURIComponent('"Infosys" when:7d')); const dj = await d.json(); assert.equal(d.status, 200); assert.deepEqual([dj.ok, dj.retry_after], [false, 90]); assert.match(dj.error, /did not answer/);
});
test('refresh now is limited: a second forced call from one address within 30 seconds is 429 with Retry-After; another address is not limited', async () => {
  reset(); route({ 'news-status.json': () => new Response(JSON.stringify({ schema: 'tripwire-news-status/1', snapshotVersion: 3, status: 'ok' })) });
  assert.equal((await get('/api/news/version?force=1', '2.2.2.2')).status, 200); const second = await get('/api/news/version?force=1', '2.2.2.2'); assert.equal(second.status, 429); assert.equal(second.headers.get('retry-after'), '30');
  assert.equal((await second.json()).retry_after, 30); assert.equal((await get('/api/news/version?force=1', '3.3.3.3')).status, 200); assert.equal((await get('/api/news/version', '2.2.2.2')).status, 200, 'an unforced read is never limited');
});
test('health reports the published news status, not a probe of Google', async () => {
  reset(); route({ 'news-status.json': () => new Response(JSON.stringify({ schema: 'tripwire-news-status/1', snapshotVersion: 3, status: 'failed', checkedAt: 'c', lastSuccessfulAt: 'g' })), 'finance.yahoo': () => new Response(JSON.stringify({ chart: { result: [{ meta: { regularMarketTime: 1 } }] } })) });
  const h = await (await get('/api/health')).json(); assert.equal(h.news.ok, false); assert.equal(h.news.status, 'failed'); assert.equal(h.news.last_successful_at, 'g'); assert.match(h.news.error, /latest news check failed/);
});
test.after(() => { (globalThis as any).fetch = realFetch; });
