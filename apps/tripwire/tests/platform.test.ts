// @ts-nocheck  (the Worker is plain JavaScript)
// 1.5, offline: security headers on every Worker response, a real JSON 404 for an unknown /data/ path while real data files still serve, and the static pieces (_headers, sitemap, robots).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { dataAsset, SECURITY } from '../worker.js';

const ctx = { waitUntil: (p) => p };
// an asset layer that behaves like Cloudflare's single-page-application mode: a known file is itself, anything else is the shell with HTTP 200 text/html
const FILES = { '/data/screen.json': '{"rows":[]}', '/data/c/TCS.json': '{"sym":"TCS"}', '/index.html': '<!doctype html>' };
const env = { ASSETS: { fetch: async (req) => { const p = new URL(req.url).pathname; if (p in FILES) return new Response(FILES[p], { headers: { 'content-type': p.endsWith('.json') ? 'application/json' : 'text/html' } }); return new Response(FILES['/index.html'], { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }); } } };
const get = (path, init) => worker.fetch(new Request(`https://tripwire.test${path}`, init), env, ctx);
const HSTS = 'max-age=31536000; includeSubDomains';

test('every Worker JSON response carries HSTS and COOP: success, error, 404, 405 and the data passthrough', async () => {
  assert.equal(SECURITY['strict-transport-security'], HSTS); assert.equal(SECURITY['cross-origin-opener-policy'], 'same-origin');
  const probes = [await get('/api/nope'), await get('/api/bars'), await get('/api/bars', { method: 'POST' }), await get('/data/screen.json'), await get('/data/c/ZZZZ.json')];
  for (const r of probes) { assert.equal(r.headers.get('strict-transport-security'), HSTS, r.url + ' ' + r.status); assert.equal(r.headers.get('cross-origin-opener-policy'), 'same-origin', r.url); assert.equal(r.headers.get('x-content-type-options'), 'nosniff', r.url); }
});
test('an unknown /data/ path is a real 404 with a JSON body; real data files still serve with their own body', async () => {
  for (const p of ['/data/c/ZZZZNOTREAL.json', '/data/nothing.json', '/data/', '/data/research/ghost.json']) {
    const r = await get(p); assert.equal(r.status, 404, p); assert.match(r.headers.get('content-type'), /application\/json/); const j = await r.json(); assert.deepEqual([j.ok, j.error, j.path], [false, 'not found', p]);
    assert.equal(r.headers.get('cache-control'), 'no-store', 'a 404 is never cached as if it were data');
  }
  const ok = await get('/data/c/TCS.json'); assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { sym: 'TCS' });
  assert.equal((await get('/data/screen.json')).status, 200);
  assert.equal((await get('/data/c/ZZZZ.json', { method: 'HEAD' })).status, 404);
  assert.equal((await get('/data/screen.json', { method: 'POST' })).status, 405);
});
test('a 404 from the asset layer itself, and an asset-layer failure, are also JSON 404s (never the shell)', async () => {
  for (const status of [404, 500]) { const r = await dataAsset(new Request('https://tripwire.test/data/x.json'), { ASSETS: { fetch: async () => new Response('gone', { status, headers: { 'content-type': 'text/plain' } }) } }); assert.equal(r.status, 404); assert.equal((await r.json()).ok, false); }
});
test('the pages outside /data/ and /api/ are untouched: the Worker hands them to the asset layer', async () => {
  const r = await get('/'); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/html/);
});
test('static pieces: _headers carries HSTS and COOP and keeps the strict CSP unchanged; sitemap and robots are in the source', () => {
  const h = readFileSync(new URL('../static/_headers', import.meta.url), 'utf8');
  assert.match(h, /Strict-Transport-Security: max-age=31536000; includeSubDomains/); assert.match(h, /Cross-Origin-Opener-Policy: same-origin/);
  assert.match(h, /Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'self'/);
  const sm = readFileSync(new URL('../static/sitemap.xml', import.meta.url), 'utf8'); assert.match(sm, /<loc>https:\/\/tripwire\.askakshay\.com\/<\/loc>/); assert.match(sm, /sitemaps\.org\/schemas\/sitemap\/0\.9/);
  const b = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8'); assert.match(b, /Sitemap: https:\/\/tripwire\.askakshay\.com\/sitemap\.xml/); assert.match(b, /'sitemap\.xml'/);
  const cfg = readFileSync(new URL('../../../wrangler.tripwire.jsonc', import.meta.url), 'utf8'); assert.match(cfg, /"run_worker_first": \["\/api\/\*", "\/data\/\*"\]/);
});
