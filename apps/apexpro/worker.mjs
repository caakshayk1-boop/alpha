const HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};
function response(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json', 'cache-control': 'no-store' } }); }
// 19 Nov 2026: alpha.askakshay.com now answers 301 to alphavision.askakshay.com, which serves the same /data/screen.json, /c/<SYM>.json and /signals.json. The old host returned an HTML page, so every screen and company request failed with 502.
const ALPHA = 'https://alpha.askakshay.com';
// While the hub address is being moved, alpha (the host main deploys the hub to, complete data) is tried first and alphavision second. A host that redirects to a page, or does not resolve, is skipped; it is never served as data.
const LEGACY_ALPHA = 'https://alphavision.askakshay.com';
// 19 Nov 2026: every data route is read from the hub; the market routes (/v1/market/*) name Tripwire's identical routes as their fallback until the hub has them in production and has proved itself.
const TW = 'https://tripwire.askakshay.com';
export function upstream(url) {
  const symbol = url.searchParams.get('s') || '';
  const valid = /^[A-Z0-9][A-Z0-9&.\-]{0,24}$/.test(symbol);
  const routes = {
    '/api/screen': [`${ALPHA}/data/screen.json`, 300],
    '/api/market': [`${ALPHA}/v1/market/pulse`, 30, `${TW}/api/pulse`],
    '/api/macro': [`${ALPHA}/v1/market/macro`, 30, `${TW}/api/macro`],
    '/api/signals': [`${ALPHA}/signals.json`, 300],
  };
  if (routes[url.pathname]) return routes[url.pathname];
  if (url.pathname === '/api/quotes') { // 18 Nov 2026: live quotes for the sector map's sample (up to 30 names a call); the same upstream the index strip uses, 30 s at the edge
    const list = symbol.split(',');
    return list.length >= 1 && list.length <= 30 && list.every(x => /^[A-Z0-9][A-Z0-9&.\-]{0,24}$/.test(x)) ? [`${ALPHA}/v1/market/tick?s=${list.map(encodeURIComponent).join(',')}`, 30, `${TW}/api/tick?s=${list.map(encodeURIComponent).join(',')}`] : null;
  }
  if (url.pathname === '/api/company' && valid) return [`${ALPHA}/c/${encodeURIComponent(symbol)}.json`, 300];
  if (['/api/chart','/api/spark'].includes(url.pathname) && valid) return [`${ALPHA}/v1/market/chart?s=${encodeURIComponent(symbol)}`, 1800, `${TW}/api/chart?s=${encodeURIComponent(symbol)}`];
  return null;
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) return response({ error: 'Method not allowed' }, 405);
    if (url.pathname.startsWith('/api/')) {
      if (url.search.length > (url.pathname === '/api/quotes' ? 600 : 100)) return response({ error: 'Request too long' }, 400);
      const route = upstream(url);
      if (!route) return response({ error: 'Unknown endpoint or invalid symbol' }, 400);
      const key = new Request(url.origin + url.pathname + (url.searchParams.has('s') ? '?s=' + encodeURIComponent(url.searchParams.get('s')) : ''));
      const cache = caches.default;
      const hit = await cache.match(key);
      if (hit) return hit;
      try {
        const candidates = route[2] ? [route[0], route[2]] : route[0].startsWith(ALPHA) ? [route[0], route[0].replace(ALPHA, LEGACY_ALPHA)] : [route[0]];
        let r = null, used = route[0];
        for (const c of candidates) { try { const x = await fetch(c, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } }); if (x.ok && x.headers.get('content-type')?.includes('json')) { r = x; used = c; break; } } catch { /* try the next host */ } }
        if (!r) return response({ error: 'The data source is temporarily unavailable. Please retry.' }, 502);
        let data = await r.json();
        if (data.ok === false) return response({ error: 'The data source has no response yet. Please retry.' }, 502);
        if (url.pathname === '/api/spark') data = { ok: true, sym: data.sym, t: (data.t || []).slice(-60), c: (data.c || []).slice(-60) };
        const result = new Response(JSON.stringify(data), { headers: { ...HEADERS, 'content-type': 'application/json', 'cache-control': `public, max-age=${route[1]}`, 'x-apex-source': used.split('/')[2] } });
        ctx.waitUntil(cache.put(key, result.clone()));
        return result;
      } catch { return response({ error: 'The data source timed out. Please retry.' }, 502); }
    }
    const asset = await env.ASSETS.fetch(request);
    const out = new Response(asset.body, asset);
    for (const [k, v] of Object.entries(HEADERS)) out.headers.set(k, v);
    // 18 Nov 2026: font files are never edited in place (a new face gets a new file), so they are cached for a year and not asked about again; images keep a day; code and pages are always revalidated.
    out.headers.set('cache-control', /\.woff2$/.test(url.pathname) ? 'public, max-age=31536000, immutable' : /\.(png|svg)$/.test(url.pathname) ? 'public, max-age=86400' : 'no-cache');
    return out;
  }
};
