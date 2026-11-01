// 1.5 against the real asset layer (wrangler dev): headers on every path, JSON 404s for unknown data, sitemap and robots served. Usage: node platform.mjs http://localhost:8801
const base = process.argv[2] ?? 'http://localhost:8801'; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('FAIL  ' + m); } else console.log('ok    ' + m); };
const HSTS = 'max-age=31536000; includeSubDomains';
const paths = ['/', '/index.html', '/manifest.webmanifest', '/robots.txt', '/sitemap.xml', '/data/screen.json', '/data/c/TCS.json', '/data/freshness.json', '/api/nope', '/data/c/ZZZZNOTREAL.json', '/some/spa/route'];
for (const p of paths) {
  const r = await fetch(base + p);
  ok(r.headers.get('strict-transport-security') === HSTS, `${p} (${r.status}) carries HSTS`);
  ok(r.headers.get('cross-origin-opener-policy') === 'same-origin', `${p} carries COOP`);
}
const csp = (await fetch(base + '/')).headers.get('content-security-policy');
ok(csp === "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'self'", 'the CSP is exactly the strict one it was');
for (const p of ['/data/c/ZZZZNOTREAL.json', '/data/nothing.json', '/data/research/ghost.json']) {
  const r = await fetch(base + p); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* not JSON */ }
  ok(r.status === 404 && /application\/json/.test(r.headers.get('content-type') ?? '') && j?.ok === false, `${p} is a real 404 with a JSON body`);
}
for (const p of ['/data/screen.json', '/data/c/TCS.json', '/data/freshness.json']) { const r = await fetch(base + p); ok(r.status === 200 && /json/.test(r.headers.get('content-type') ?? '') && !!(await r.json()), `${p} still serves`); }
const spa = await fetch(base + '/some/spa/route'); ok(spa.status === 200 && /text\/html/.test(spa.headers.get('content-type') ?? ''), 'an app route outside /data/ still gets the shell');
const sm = await fetch(base + '/sitemap.xml'); const smt = await sm.text(); ok(sm.status === 200 && /xml/.test(sm.headers.get('content-type') ?? '') && smt.includes('<loc>https://tripwire.askakshay.com/</loc>') && !smt.includes('__LASTMOD__'), '/sitemap.xml is XML with the canonical root');
const rb = await (await fetch(base + '/robots.txt')).text(); ok(/Sitemap: https:\/\/tripwire\.askakshay\.com\/sitemap\.xml/.test(rb) && /Disallow: \/data\//.test(rb), 'robots.txt names the sitemap and keeps /data/ out');
process.exit(fails ? 1 : 0);
