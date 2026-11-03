// @ts-nocheck  (the Worker is plain JavaScript)
// 1.5, offline: security headers on every Worker response, a real JSON 404 for an unknown /data/ path while real data files still serve, and the static pieces (_headers, sitemap, robots).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { dataAsset, shellAsset, SECURITY } from '../worker.js';

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
  const cfg = readFileSync(new URL('../../../wrangler.tripwire.jsonc', import.meta.url), 'utf8'); assert.match(cfg, /"run_worker_first": \["\/", "\/index.html", "\/api\/\*", "\/data\/\*"\]/);
});

test('the app shell: the Worker marks it gzip so the runtime compresses it once (no-transform stops Cloudflare doing it); everything else is left alone', async () => {
  const html = '<!doctype html><html><body>' + 'tripwire '.repeat(2000) + '</body></html>';
  const asset = (headers: Record<string, string> = {}, status = 200) => ({ ASSETS: { fetch: async () => new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache, no-transform', etag: '"abc"', 'content-length': String(html.length), ...headers } }) } });
  const r = await shellAsset(new Request('https://tripwire.test/', { headers: { 'accept-encoding': 'br, gzip' } }), asset());
  assert.equal(r.headers.get('content-encoding'), 'gzip'); assert.match(r.headers.get('cache-control') ?? '', /no-transform/, 'still blocks Cloudflare\'s beacon injection'); assert.match(r.headers.get('vary') ?? '', /Accept-Encoding/);
  assert.equal(r.headers.get('content-length'), null); assert.equal(r.headers.get('etag'), null, 'the validator described the plain bytes');
  assert.equal(await r.text(), html, 'the body is handed to the runtime plain: compressing it here too would encode it twice (the first version of this did, and the page arrived as gzip inside gzip)');
  const js = await shellAsset(new Request('https://tripwire.test/'), asset({ 'content-type': 'application/javascript' })); assert.equal(js.headers.get('content-encoding'), null, 'only HTML is touched');
  const enc = await shellAsset(new Request('https://tripwire.test/'), asset({ 'content-encoding': 'br' })); assert.equal(enc.headers.get('content-encoding'), 'br', 'an already encoded response is not encoded again');
  const missing = await shellAsset(new Request('https://tripwire.test/'), asset({}, 404)); assert.equal(missing.status, 404); assert.equal(missing.headers.get('content-encoding'), null);
  for (const encoding of ['identity', 'gzip;q=0', 'br']) {
    const plain = await shellAsset(new Request('https://tripwire.test/', { headers: { 'accept-encoding': encoding } }), asset());
    assert.equal(plain.headers.get('content-encoding'), null); assert.equal(await plain.text(), html);
  }
});

test('the app shell is encoded from the client\'s original Accept-Encoding when Cloudflare has rewritten it (request.cf.clientAcceptEncoding)', async () => {
  const html = '<!doctype html><html><body>' + 'tripwire '.repeat(500) + '</body></html>';
  const env = { ASSETS: { fetch: async () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache, no-transform' } }) } };
  const req = (header: string | null, cf?: { clientAcceptEncoding?: string }) => { const r = new Request('https://tripwire.test/', header == null ? {} : { headers: { 'accept-encoding': header } }); if (cf) Object.defineProperty(r, 'cf', { value: cf }); return r; };
  const enc = async (r: Request) => (await shellAsset(r, env)).headers.get('content-encoding');
  assert.equal(await enc(req('br, gzip', { clientAcceptEncoding: 'identity' })), null, 'the edge rewrote the header to include gzip, but the client never asked for it');
  assert.equal(await enc(req('br, gzip', { clientAcceptEncoding: '' })), null, 'an empty original value is "no encodings", not a reason to fall back to the rewritten header');
  assert.equal(await enc(req('identity', { clientAcceptEncoding: 'gzip, deflate, br' })), 'gzip', 'the original value wins in the other direction too');
  assert.equal(await enc(req('gzip, br')), 'gzip', 'without cf (a local runtime) the header is the client\'s own');
  assert.equal(await enc(req('gzip;q=0')), null); assert.equal(await enc(req(null)), null);
  assert.equal((await shellAsset(req('br, gzip', { clientAcceptEncoding: 'identity' }), env)).headers.get('vary'), 'Accept-Encoding', 'the response still varies on the header');
});

