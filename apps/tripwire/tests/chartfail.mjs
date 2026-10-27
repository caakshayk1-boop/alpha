// A price-history reply that is not a history ({ ok:false }, a changed shape, an upstream error page) must leave an unavailable-chart card, never crash the page.
// Found live: the company page showed "Something broke" because the chart reply had no `t` array.
// Usage: node apps/tripwire/tests/chartfail.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
for (const [label, status, body] of [['{ ok:false } with 200', 200, { ok: false, error: 'upstream' }], ['an error page with 502', 502, { ok: false, error: 'bad gateway' }], ['a changed shape', 200, { ok: true, series: [] }]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, STATE); await mockApi(ctx);
  await ctx.route('**/api/chart*', (r) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(base + '/#/c/TCS'); await pg.waitForFunction(() => !document.querySelector('.routewait') && /TCS/.test(document.body.innerText), null, { timeout: 20000 }); await pg.waitForTimeout(1500);
  ok((await pg.getByText('Something broke').count()) === 0, `company page with ${label}: no crash screen`);
  ok((await pg.getByText('Price history').count()) > 0, `company page with ${label}: the chart card says the history is unavailable`);
  ok(errs.length === 0, `company page with ${label}: no script error${errs[0] ? ` (${errs[0].slice(0, 80)})` : ''}`);
  await ctx.close();
}
await b.close(); console.log(fails ? `${fails} failed` : 'chartfail: all passed'); process.exit(fails ? 1 : 0);
