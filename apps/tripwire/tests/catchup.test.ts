// @ts-nocheck  (the Worker and the news modules are plain JavaScript)
// Worker-side catch-up: only when the published snapshot is older than two cadences AND the NSE session is on; market scope only; labelled on demand; edge-cached for a cadence;
// the published snapshot is never changed. Offline: the recorded feeds in fixtures/news/ok.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catchupDecision, runCatchup, CATCHUP_SCHEMA } from '../news/catchup.js';
import worker from '../worker.js';

const Z = (s: string) => Date.parse(s);
const fx = (f: string) => readFileSync(new URL(`./fixtures/news/ok/${f}`, import.meta.url), 'utf8');
const OPEN = Z('2026-10-27T06:00:00Z');                       // 11:30 IST, a Tuesday in session
const status = (agoMin: number, now = OPEN) => ({ ok: true, schema: 'tripwire-news-status/1', snapshotVersion: 4, status: 'ok', checkedAt: new Date(now - agoMin * 60000).toISOString(), lastSuccessfulAt: new Date(now - agoMin * 60000).toISOString() });

test('decision: late means older than two cadences (30 minutes in session, 60 outside it), at any hour', () => {
  assert.equal(catchupDecision({ status: status(29), nowMs: OPEN }).run, false, '29 minutes is inside two 15-minute cadences');
  const late = catchupDecision({ status: status(46), nowMs: OPEN }); assert.equal(late.run, true); assert.equal(late.ageMin, 46); assert.match(late.reason, /46 minutes ago/);
  const SHUT = Z('2026-10-27T11:00:00Z');                    // 16:30 IST, the session is over: the cadence is 30 minutes, so two cadences is 60
  assert.equal(catchupDecision({ status: status(59, SHUT), nowMs: SHUT }).run, false, '59 minutes is inside two 30-minute cadences');
  const eve = catchupDecision({ status: status(300, SHUT), nowMs: SHUT }); assert.equal(eve.run, true, 'news does not stop at the bell'); assert.equal(eve.allowedMin, 60);
  const sat = Z('2026-10-24T06:00:00Z'); assert.equal(catchupDecision({ status: status(300, sat), nowMs: sat }).run, true, 'Saturday');
  const hol = Z('2026-10-20T06:00:00Z'); assert.equal(catchupDecision({ status: status(300, hol), nowMs: hol }).run, true, 'Dussehra, an NSE holiday: RBI and SEBI still publish');
  assert.equal(catchupDecision({ status: null, nowMs: OPEN }).run, true, 'nothing ever published');
  assert.equal(catchupDecision({ status: { lastSuccessfulAt: new Date(OPEN + 3600e3).toISOString() }, nowMs: OPEN }).run, false, 'a check time in the future is not trusted, so it is not acted on either');
});

test('runCatchup: market scope through the same pipeline; labelled on demand; the published snapshot is quoted, not altered', async () => {
  const routes = async (u: string) => { const d = decodeURIComponent(u); if (/rbi\.org\.in/.test(d)) return new Response(fx('rbi.xml')); if (/sebi\.gov\.in/.test(d)) return new Response('', { status: 503 }); if (/rss\/search\?q=Sensex Nifty/.test(d)) return new Response(fx('google-market.xml')); if (/news\.google\.com/.test(d)) return new Response(fx('empty.xml')); return new Response(fx('empty.xml')); };
  const st = status(60); const snap = { names: { TCS: 'Tata Consultancy Services Ltd.' }, scopes: { paper: ['TCS'] } }; const before = JSON.stringify([st, snap]);
  const d = catchupDecision({ status: st, nowMs: OPEN });
  const b = await runCatchup({ fetchImpl: routes, nowMs: OPEN, status: st, snapshot: snap, decision: d });
  assert.equal(b.ok, true); assert.equal(b.schema, CATCHUP_SCHEMA); assert.equal(b.onDemand, true); assert.equal(b.scope, 'market'); assert.equal(b.refreshedAt, new Date(OPEN).toISOString());
  assert.equal(b.status, 'partial', 'SEBI answered 503, so coverage is partial and says so'); assert.ok(b.events.length > 0); assert.ok(b.events.every((e: any) => !('items' in e)));
  assert.equal(b.publishedSnapshot.lastSuccessfulAt, st.lastSuccessfulAt, 'the scheduled check keeps its own time'); assert.equal(JSON.stringify([st, snap]), before, 'inputs untouched');
  assert.ok(b.events.every((e: any) => e.publishedAt == null || Date.parse(e.publishedAt) <= OPEN + 600e3), 'every story keeps its own publication time, none is dated now');
});
test('runCatchup: when no source answers it says so and returns no events', async () => {
  const b = await runCatchup({ fetchImpl: async () => new Response('', { status: 500 }), nowMs: OPEN, status: status(60), snapshot: null });
  assert.equal(b.ok, false); assert.match(b.error, /did not answer/);
});

/* ---- the Worker route ---- */
const store = new Map<string, Response>();
(globalThis as any).caches = { default: { match: async (k: Request) => store.get(k.url)?.clone(), put: async (k: Request, r: Response) => { store.set(k.url, r.clone()); } } };
const ctx = { waitUntil: (p: Promise<unknown>) => p }; const env = { ASSETS: { fetch: async () => new Response('asset') } };
const realFetch = globalThis.fetch; const RealNow = Date.now;
const withClock = async (ms: number, fn: () => Promise<void>) => { Date.now = () => ms; try { await fn(); } finally { Date.now = RealNow; } };
const hits: string[] = [];
const route = (agoMin: number) => { (globalThis as any).fetch = async (u: string) => { const d = decodeURIComponent(String(u)); hits.push(d);
  if (d.includes('news-status.json')) return new Response(JSON.stringify({ schema: 'tripwire-news-status/1', snapshotVersion: 4, status: 'ok', checkedAt: new Date(OPEN - agoMin * 60000).toISOString(), lastSuccessfulAt: new Date(OPEN - agoMin * 60000).toISOString() }));
  if (d.includes('news-browser.json')) return new Response(JSON.stringify({ schema: 'tripwire-news/1', snapshotVersion: 4, events: [], names: { TCS: 'Tata Consultancy Services Ltd.' }, scopes: { paper: ['TCS'], covered: [] } }));
  if (/rbi\.org\.in/.test(d)) return new Response(fx('rbi.xml')); if (/rss\/search\?q=Sensex Nifty/.test(d)) return new Response(fx('google-market.xml')); return new Response(fx('empty.xml')); }; };
const get = (path: string) => worker.fetch(new Request(`https://tripwire.test${path}`, { headers: { 'cf-connecting-ip': '1.1.1.1' } }), env, ctx);

test('route: on schedule means no work and no feed request; late means one market run, cached for the cadence, and the second call does no work', async () => {
  await withClock(OPEN, async () => {
    store.clear(); hits.length = 0; route(10);
    const ok = await (await get('/api/news/catchup')).json(); assert.deepEqual([ok.ok, ok.onDemand], [true, false]); assert.match(ok.reason, /on schedule/); assert.ok(!hits.some((h) => /rbi|google|bing|sebi/.test(h)), 'no feed was asked');
    store.clear(); hits.length = 0; route(50);
    const a = await (await get('/api/news/catchup')).json(); assert.equal(a.onDemand, true); assert.equal(a.schema, CATCHUP_SCHEMA); assert.ok(a.events.length > 0); assert.equal(a.publishedSnapshot.lastSuccessfulAt, new Date(OPEN - 50 * 60000).toISOString());
    const feedHits = hits.filter((h) => /rbi|news\.google|bing|sebi/.test(h)).length; assert.ok(feedHits >= 5, `one run asked the market feeds (${feedHits})`);
    await get('/api/news/catchup'); assert.equal(hits.filter((h) => /rbi|news\.google|bing|sebi/.test(h)).length, feedHits, 'the edge copy answered the second call');
    assert.equal((await worker.fetch(new Request('https://tripwire.test/api/news/catchup', { method: 'POST' }), env, ctx)).status, 405);
  });
});
test('route: the published snapshot route is unchanged by a catch-up (same version, same times)', async () => {
  await withClock(OPEN, async () => { store.clear(); route(50); await get('/api/news/catchup'); const v = await (await get('/api/news/version')).json(); assert.equal(v.snapshotVersion, 4); assert.equal(v.lastSuccessfulAt, new Date(OPEN - 50 * 60000).toISOString()); });
  (globalThis as any).fetch = realFetch;
});
