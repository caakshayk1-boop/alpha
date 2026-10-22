// headers.mjs — the production header and redirect check (Pro §16 rows "Security headers", "Cache behaviour", "Legacy
// domains"). Run from a GitHub runner by smoke.yml: this repository's build containers cannot reach the site. Read-only
// HEAD/GET requests, no credentials. Prints one line per check and fails on any miss.
// Usage: node scripts/headers.mjs https://alpha.askakshay.com
const base = (process.argv[2] || 'https://alpha.askakshay.com').replace(/\/$/, '');
const SEC = {
  'content-security-policy': (v) => /frame-ancestors 'none'/.test(v) && (/default-src 'none'/.test(v) || (/default-src 'self'/.test(v) && /object-src 'none'/.test(v))),
  'strict-transport-security': (v) => /max-age=\d{8,}/.test(v),
  'x-frame-options': (v) => v.toUpperCase() === 'DENY',
  'x-content-type-options': (v) => v.toLowerCase() === 'nosniff',
  'referrer-policy': (v) => v.length > 0,
};
const rows = [];
const check = (name, ok, detail) => rows.push({ name, ok: !!ok, detail });
const get = (u, opt = {}) => fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(20000), ...opt });

async function security(label, url, wantStatus) {
  const r = await get(url);
  check(`${label}: status ${wantStatus}`, r.status === wantStatus, `${r.status}`);
  for (const [h, ok] of Object.entries(SEC)) { const v = r.headers.get(h) || ''; check(`${label}: ${h}`, v && ok(v), v ? v.slice(0, 90) : 'missing'); }
  return r;
}

const html = await security('HTML /', `${base}/`, 200);
check('HTML /: not cached as immutable', !/immutable/.test(html.headers.get('cache-control') || ''), html.headers.get('cache-control') || 'none');
// a page the browser may reuse for hours is a reader on yesterday's build (22 Oct 2026: the zone's Browser Cache TTL held pages 4h)
check('HTML /: revalidated on every load (no-cache, or max-age 60 or less)', /no-cache|no-store/.test(html.headers.get('cache-control') || '') || /max-age=([0-5]?\d|60)\b/.test(html.headers.get('cache-control') || ''), html.headers.get('cache-control') || 'none');
await security('404 page', `${base}/nope-not-a-page/`, 404);
const api = await security('JSON /api/quotes', `${base}/api/quotes`, 200);
check('JSON /api/quotes: content-type json', /application\/json/.test(api.headers.get('content-type') || ''), api.headers.get('content-type'));
// The Worker sends max-age=120. A larger value here is the Cloudflare zone's Browser Cache TTL overriding it (seen
// 21 Oct 2026: 14400). The site revalidates every data fetch (cache: 'no-cache'), so readers are safe either way, but the
// zone should say "Respect existing headers" (Caching → Configuration → Browser Cache TTL).
check('JSON /api/quotes: short browser cache (zone respects the Worker)', /max-age=(\d{1,3})\b/.test(api.headers.get('cache-control') || '') || /no-store/.test(api.headers.get('cache-control') || ''), api.headers.get('cache-control'));
const red = await get(`${base}/company/?s=TCS`);
check('Old company address: 301', red.status === 301, `${red.status}`);
check('Old company address: to /company/TCS/', /\/company\/TCS\/$/.test(red.headers.get('location') || ''), red.headers.get('location'));
const sw = await get(`${base}/sw.js`);
check('sw.js: no-cache', /no-cache/.test(sw.headers.get('cache-control') || ''), sw.headers.get('cache-control'));
const page = await (await get(`${base}/`)).text();
const asset = page.match(/\/_next\/static\/[^"']+\.js/)?.[0];
if (asset) { const a = await get(`${base}${asset}`); check('Hashed asset: immutable for a year', /max-age=31536000/.test(a.headers.get('cache-control') || '') && /immutable/.test(a.headers.get('cache-control') || ''), a.headers.get('cache-control')); }
else check('Hashed asset found on /', false, 'no /_next/static script in the page');
for (const sub of /localhost|127\.0\.0\.1/.test(base) ? [] : ['signal', 'gems', 'vision']) {
  const host = base.replace('://alpha.', `://${sub}.`);
  // vision.askakshay.com is not routed to this Worker (21 Oct 2026 it answered 200 from elsewhere). Whether it should
  // redirect is the owner's decision, so it is reported, not failed, until that is settled.
  const warnOnly = sub === 'vision';
  try { const r = await get(`${host}/`); const ok = r.status === 301 && /alpha\.askakshay\.com/.test(r.headers.get('location') || ''); check(`${sub}. redirects to alpha${warnOnly && !ok ? ' (WARN only)' : ''}`, ok || warnOnly, `${r.status} ${r.headers.get('location') || ''}`); }
  catch (e) { check(`${sub}. redirects to alpha`, warnOnly, e.message); }
}
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail ?? ''})`);
const failed = rows.filter((r) => !r.ok).length;
console.log(`\nheaders: ${rows.length - failed} of ${rows.length} passed`);
process.exit(failed ? 1 : 0);
