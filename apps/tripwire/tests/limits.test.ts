// @ts-nocheck  (the Worker is plain JavaScript)
// The Worker's per-client limiter, its 429, input caps, cache keys and request coalescing, offline (docs/tripwire/beta/WORKER_LIMITS.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { LIMITS, ROUTE_CLASS, normSymbols, overLimit, slowDown, coalesce } from '../worker.js';

const store = new Map<string, Response>();
(globalThis as any).caches = { default: { match: async (k: Request) => store.get(k.url)?.clone(), put: async (k: Request, r: Response) => { store.set(k.url, r.clone()); } } };
const ctx = { waitUntil: (p: Promise<unknown>) => p }; const env = { ASSETS: { fetch: async () => new Response('asset') } };
const realFetch = globalThis.fetch;
let calls: string[] = [];
const yahoo = (u: string) => {
  calls.push(String(u));
  if (String(u).includes('/v8/finance/spark')) { const syms = decodeURIComponent(String(u).match(/symbols=([^&]+)/)![1]).split(','); const now = Math.floor(Date.now() / 1000); return new Response(JSON.stringify(Object.fromEntries(syms.map((s) => [s, { timestamp: [now - 600, now - 300], close: [100, 101], chartPreviousClose: 99 }])))); }
  if (String(u).includes('NOPE.NS')) return new Response('', { status: 404 });
  const ts = Array.from({ length: 40 }, (_, i) => 1700000000 + i * 86400); const close = ts.map((_, i) => 100 + i);
  return new Response(JSON.stringify({ chart: { result: [{ timestamp: ts, meta: {}, indicators: { quote: [{ open: close, high: close, low: close, close, volume: close }] } }] } }));
};
(globalThis as any).fetch = async (u: string) => yahoo(u);
const reset = () => { store.clear(); calls = []; };
const get = (path: string, ip: string | null = '9.9.9.9', host = 'tripwire.test') => worker.fetch(new Request(`https://${host}${path}`, { headers: ip ? { 'cf-connecting-ip': ip } : {} }), env, ctx);
const HSTS = 'max-age=31536000; includeSubDomains';
test.after(() => { (globalThis as any).fetch = realFetch; });

test('every route that calls an upstream has an allowance class, and the allowances are above any normal use', () => {
  for (const r of ['/api/tick', '/api/intraday', '/api/pulse', '/api/macro', '/api/breadth', '/api/news/catchup', '/api/chart', '/api/bars', '/api/news', '/api/news/version', '/api/ledger', '/api/factors', '/api/rsi', '/api/fiidii', '/api/health']) assert.ok(ROUTE_CLASS[r] && LIMITS[ROUTE_CLASS[r]], r);
  assert.ok(LIMITS.quote[0] / LIMITS.quote[1] * 60 >= 60, 'the Today poll (one tick every 8 s, about 8 a minute) with several tabs open');
  assert.ok(LIMITS.history[0] >= 10 * 3, 'compare of three names, repeated');
});

test('limiter: the (max+1)th call in a window is refused with the seconds to wait; another client and another class are untouched; a new window starts clean', async () => {
  reset(); const [max, win] = LIMITS.health; const t0 = Date.UTC(2026, 10, 2, 5, 0, 10); const req = (ip: string) => new Request('https://tripwire.test/api/health', { headers: { 'cf-connecting-ip': ip } });
  for (let i = 0; i < max; i++) assert.equal(await overLimit(req('1.1.1.1'), 'health', t0), 0, 'call ' + (i + 1));
  const wait = await overLimit(req('1.1.1.1'), 'health', t0); assert.ok(wait >= 1 && wait <= win, String(wait)); assert.equal(wait, 50);
  assert.equal(await overLimit(req('2.2.2.2'), 'health', t0), 0); assert.equal(await overLimit(req('1.1.1.1'), 'file', t0), 0);
  assert.equal(await overLimit(req('1.1.1.1'), 'health', t0 + win * 1000), 0, 'the next window');
});

test('limiter never applies to local development (no client address, or a localhost URL)', async () => {
  reset(); for (let i = 0; i < 200; i++) assert.equal(await overLimit(new Request('https://tripwire.test/api/health'), 'health'), 0);
  for (let i = 0; i < 200; i++) assert.equal(await overLimit(new Request('http://localhost:8931/api/health', { headers: { 'cf-connecting-ip': '1.1.1.1' } }), 'health'), 0);
});

test('429 shape: HTTP 429, JSON { ok:false, error:"too many requests", retryAfter }, Retry-After, no-store, and HSTS + COOP like every other response', async () => {
  reset(); const [max] = LIMITS.history; let last: Response | null = null;
  for (let i = 0; i <= max; i++) last = await get('/api/chart?s=NOPE', '5.5.5.5');
  assert.equal(last!.status, 429); const j = await last!.json(); assert.equal(j.ok, false); assert.equal(j.error, 'too many requests'); assert.ok(Number.isInteger(j.retryAfter) && j.retryAfter >= 1 && j.retryAfter <= 60);
  assert.equal(last!.headers.get('retry-after'), String(j.retryAfter)); assert.equal(last!.headers.get('cache-control'), 'no-store'); assert.match(last!.headers.get('content-type')!, /application\/json/);
  assert.equal(last!.headers.get('strict-transport-security'), HSTS); assert.equal(last!.headers.get('cross-origin-opener-policy'), 'same-origin'); assert.equal(last!.headers.get('x-content-type-options'), 'nosniff');
  const direct = slowDown(7); assert.deepEqual(await direct.json(), { ok: false, error: 'too many requests', retryAfter: 7 }); assert.equal(direct.headers.get('retry-after'), '7');
  assert.equal((await get('/api/chart?s=NOPE', '6.6.6.6')).status, 404, 'another client is not limited');
  assert.equal((await get('/api/tick?s=TCS', '5.5.5.5')).status, 200, 'another class is not limited');
});

test('a limited client is refused BEFORE any upstream call is made', async () => {
  reset(); const [max] = LIMITS.health; for (let i = 0; i < max; i++) await get('/api/health', '4.4.4.4'); const n = calls.length;
  assert.equal((await get('/api/health', '4.4.4.4')).status, 429); assert.equal(calls.length, n);
});

test('input caps: symbol charset and length, list length, raw length and query length are refused with 400/414, and nothing reaches Yahoo', async () => {
  reset();
  const many = Array.from({ length: 31 }, (_, i) => 'AB' + i).join(',');
  for (const bad of ['/api/bars?s=', '/api/bars?s=' + many, '/api/bars?s=TCS,<script>', '/api/bars?s=' + 'A'.repeat(21), '/api/bars?s=' + ','.repeat(1500) + 'TCS', '/api/intraday?s=TCS%00', '/api/intraday?s=' + many,
    '/api/tick?s=' + Array.from({ length: 61 }, (_, i) => 'AB' + i).join(','), '/api/tick?s=TCS,../x', '/api/chart?s=TC S', '/api/chart?s=' + 'A'.repeat(21), '/api/chart?s=a/b', '/api/chart', '/api/news?q=' + encodeURIComponent('<b>'), '/api/news?q=' + encodeURIComponent('"A B" when:7d') + '&sym=bad%20sym']) {
    const r = await get(bad); assert.equal(r.status, 400, bad.slice(0, 80)); assert.equal((await r.json()).ok, false);
  }
  const long = await get('/api/bars?s=TCS&x=' + 'a'.repeat(2100)); assert.equal(long.status, 414); assert.equal(long.headers.get('strict-transport-security'), HSTS);
  assert.deepEqual(calls, [], 'no upstream call for any refused request');
  assert.equal((await get('/api/tick?i=1&m=1')).status, 200, 'an empty list is allowed on tick (indices and macro only)');
  assert.deepEqual(normSymbols('b, a,A,,tcs', 30), ['A', 'B', 'TCS']); assert.equal(normSymbols('', 30), null); assert.deepEqual(normSymbols('', 60, 0), []); assert.equal(normSymbols('a'.repeat(1401), 30), null); assert.equal(normSymbols('M&M,BAJAJ-AUTO', 30)!.length, 2);
});

test('cache keys are normalised: the same symbols in another order or case are one upstream call; a repeat is served from the edge copy', async () => {
  reset(); assert.equal((await get('/api/intraday?s=tcs,infy')).status, 200); const first = calls.length; assert.equal(first, 1);
  assert.equal((await get('/api/intraday?s=INFY,TCS,tcs')).status, 200); assert.equal(calls.length, first, 'reordered and repeated: no new call');
  reset(); await get('/api/bars?s=TCS,INFY'); const b = calls.length; await get('/api/bars?s=INFY,TCS'); assert.equal(calls.length, b);
  reset(); await get('/api/news?q=' + encodeURIComponent('"Tata  Consultancy" when:7d') + '&sym=TCS'); const n1 = calls.length; await get('/api/news?q=' + encodeURIComponent('"tata consultancy" when:7d') + '&sym=TCS'); assert.equal(calls.length, n1, 'whitespace and case in a live news query');
});

test('an unknown symbol is remembered (404 cached), so a bad client cannot make one Yahoo call per request', async () => {
  reset(); assert.equal((await get('/api/chart?s=NOPE', '7.7.7.1')).status, 404); const n = calls.length; assert.ok(n >= 1);
  const again = await get('/api/chart?s=nope', '7.7.7.2'); assert.equal(again.status, 404); assert.equal(calls.length, n); assert.equal((await again.json()).error, 'no price history for this symbol');
});

test('coalescing: concurrent callers share one upstream fetch, and a failure is not remembered', async () => {
  reset(); const rs = await Promise.all(Array.from({ length: 5 }, (_, i) => get('/api/chart?s=TCS', '8.8.8.' + i))); assert.deepEqual(rs.map((r) => r.status), [200, 200, 200, 200, 200]);
  assert.equal(calls.filter((c) => c.includes('/chart/TCS.NS')).length, 1, 'five concurrent reads of one company, one Yahoo call'); const bodies = await Promise.all(rs.map((r) => r.json())); assert.ok(bodies.every((b) => b.ok && b.sym === 'TCS'));
  let n = 0; const run = () => coalesce('k', async () => { n++; await new Promise((r) => setTimeout(r, 5)); return n; });
  const [a, b] = await Promise.all([run(), run()]); assert.deepEqual([a, b, n], [1, 1, 1]);
  await assert.rejects(coalesce('bad', async () => { throw new Error('x'); })); assert.equal(await coalesce('bad', async () => 5), 5, 'after a failure the next call runs afresh');
});

test('the app side: a 429 reads as the plain words "Slow down a moment", never "HTTP 429" or a crash, and Retry-After is honoured within sane bounds', async () => {
  const { getJson, SLOW_DOWN, retryAfterOf } = await import('../src/data.ts');
  assert.equal(SLOW_DOWN, 'Slow down a moment');
  const was = (globalThis as any).fetch; (globalThis as any).fetch = async () => slowDown(12);
  try { await assert.rejects(getJson('/api/chart?s=TCS'), { message: 'Slow down a moment' }); await assert.rejects(getJson('/api/chart?s=TCS'), { message: 'Slow down a moment' }, 'a failure is not memoised: asking again asks again'); }
  finally { (globalThis as any).fetch = was; }
  assert.equal(retryAfterOf(slowDown(12)), 12); assert.equal(retryAfterOf(slowDown(1)), 5, 'never hammer sooner than 5 s'); assert.equal(retryAfterOf(new Response('{}', { headers: { 'retry-after': '99999' } })), 120);
  assert.equal(retryAfterOf(new Response('{}'), { retryAfter: 30 }), 30); assert.equal(retryAfterOf(new Response('{}')), null);
});
