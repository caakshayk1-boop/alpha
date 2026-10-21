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
await security('404 page', `${base}/nope-not-a-page/`, 404);
const api = await security('JSON /api/quotes', `${base}/api/quotes`, 200);
check('JSON /api/quotes: content-type json', /application\/json/.test(api.headers.get('content-type') || ''), api.headers.get('content-type'));
check('JSON /api/quotes: short cache', /max-age=(\d{1,3})\b/.test(api.headers.get('cache-control') || '') || /no-store/.test(api.headers.get('cache-control') || ''), api.headers.get('cache-control'));
const red = await get(`${base}/company/?s=TCS`);
check('Old company address: 301', red.status === 301, `${red.status}`);
check('Old company address: to /company/TCS/', /\/company\/TCS\/$/.test(red.headers.get('location') || ''), red.headers.get('location'));
const sw = await get(`${base}/sw.js`);
check('sw.js: no-cache', /no-cache/.test(sw.headers.get('cache-control') || ''), sw.headers.get('cache-control'));
const page = await (await get(`${base}/`)).text();
const asset = page.match(/\/_next\/static\/[^"']+\.js/)?.[0];
if (asset) { const a = await get(`${base}${asset}`); check('Hashed asset: immutable for a year', /max-age=31536000/.test(a.headers.get('cache-control') || '') && /immutable/.test(a.headers.get('cache-control') || ''), a.headers.get('cache-control')); }
else check('Hashed asset found on /', false, 'no /_next/static script in the page');
for (const sub of /localhost|127\.0\.0\.1/.test(base) ? [] : ['signal', 'vision', 'gems']) {
  const host = base.replace('://alpha.', `://${sub}.`);
  try { const r = await get(`${host}/`); check(`${sub}. redirects to alpha`, r.status === 301 && /alpha\.askakshay\.com/.test(r.headers.get('location') || ''), `${r.status} ${r.headers.get('location') || ''}`); }
  catch (e) { check(`${sub}. redirects to alpha`, false, e.message); }
}
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail ?? ''})`);
const failed = rows.filter((r) => !r.ok).length;
console.log(`\nheaders: ${rows.length - failed} of ${rows.length} passed`);
process.exit(failed ? 1 : 0);
