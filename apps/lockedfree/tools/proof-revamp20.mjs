// The 20 Nov 2026 revamp, in a real browser: the notice is the last block of every page; no text is set under 12px; the live pill says what is true in each session state;
// the first 25 screener rows and Today's leaders follow live quotes; the offline page is served when the network goes. Usage: node tools/proof-revamp20.mjs [baseUrl]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:8898';
const OPEN = new Date('2026-11-19T05:30:00Z'), SHUT = new Date('2026-11-19T12:00:00Z');   // Thursday 11:00 IST and 17:30 IST
const browser = await chromium.launch(); const errors = []; let n = 0; const ok = (m) => console.log(`PASS ${m}`);
const pxOf = (sym) => 100 + [...sym].reduce((a, c) => a + c.charCodeAt(0), 0) % 50;
async function ctxAt(at, w = 1280, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'allow', ...extra }); await ctx.clock.install({ time: at }); const t = Math.floor(at.getTime() / 1000) - 20;
  await ctx.route('**/api/quotes?*', (route) => { const syms = new URL(route.request().url()).searchParams.get('s').split(','); route.fulfill({ json: { ok: true, quotes: Object.fromEntries(syms.map((s) => [s, { px: pxOf(s) * 1.02, prev: pxOf(s), t, hi: pxOf(s) * 1.03, lo: pxOf(s) * .98 }])) } }); });
  await ctx.route('**/api/chart?*', (route) => route.fulfill({ json: { ok: true, points: [] } })); return ctx;
}
// 1. the notice is last, no banner above the content, on every kind of page and at three widths
for (const w of [360, 390, 1280]) {
  const ctx = await ctxAt(OPEN, w); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  for (const path of ['/', '/terminal/', '/calls/', '/screener/', '/stock/INFY/', '/about/', '/method/', '/plan/']) {
    await p.goto(base + path, { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => { const nt = document.querySelector('.notice'), m = document.querySelector('main'), f = document.querySelector('footer'); const pos = nt ? nt.compareDocumentPosition(m) : 0;
      const last = [...document.body.querySelectorAll('footer *')].filter((e) => e.offsetParent !== null).pop(); return { notice: !!nt, afterMain: !!(pos & Node.DOCUMENT_POSITION_PRECEDING), inFooter: !!(nt && f && f.contains(nt)), banner: !!document.querySelector('.disc'), sebi: /SEBI/.test(nt?.textContent ?? ''), lastInNotice: !!(last && nt.contains(last)), over: document.documentElement.scrollWidth - innerWidth }; });
    assert.ok(r.notice && r.afterMain && r.inFooter && r.sebi && r.lastInNotice && !r.banner, `${w} ${path}: notice ${JSON.stringify(r)}`); assert.ok(r.over <= 1, `${w} ${path}: overflow ${r.over}`);
  }
  await ctx.close(); ok(`${w}px: the notice (with the SEBI wording) is the last block of 8 pages, in the footer, after the content; no banner above it; no overflow`);
}
// 2. type scale: no rendered text under 12px, on the pages that carry the most small print
{
  const ctx = await ctxAt(OPEN, 390); const p = await ctx.newPage();
  for (const path of ['/', '/terminal/', '/calls/', '/screener/', '/stock/INFY/', '/method/']) {
    await p.goto(base + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    const small = await p.evaluate(() => { const bad = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { const e = t.parentElement; if (!e || !t.textContent.trim() || e.closest('script,style,noscript,svg,[hidden]') || e.offsetParent === null) continue; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 11.99) bad.push(`${e.tagName}.${e.className}:${fs}px "${t.textContent.trim().slice(0, 24)}"`); } return bad.slice(0, 4); });
    assert.deepEqual(small, [], `${path}: text under 12px`);
  }
  await ctx.close(); ok('no visible text under 12px on six pages at 390px');
  const ctx2 = await ctxAt(OPEN, 390); const q = await ctx2.newPage(); await q.goto(base + '/terminal/', { waitUntil: 'networkidle' });
  const fam = await q.evaluate(() => ({ body: getComputedStyle(document.body).fontFamily.split(',')[0], num: getComputedStyle(document.querySelector('[data-q-px]')).fontFamily.split(',')[0] }));
  assert.match(fam.body, /Fira Sans/); assert.match(fam.num, /JetBrains Mono/); await ctx2.close(); ok(`prose is ${fam.body}; figures are ${fam.num}`);
}
// 3. the live pill: open with fresh quotes, closed in the evening
{
  const ctx = await ctxAt(OPEN); const p = await ctx.newPage(); await p.goto(base + '/terminal/', { waitUntil: 'networkidle' }); await p.clock.runFor(16000); await p.waitForTimeout(400);
  const pill = p.locator('[data-livepill]'); assert.equal(await pill.getAttribute('data-state'), 'live', 'open and quotes arriving'); assert.match(await pill.innerText(), /^Live · \d+s$/); ok(`session open, quotes arriving: "${await pill.innerText()}"`);
  await p.clock.runFor(200000); assert.ok(['late', 'live'].includes(await pill.getAttribute('data-state'))); await ctx.close();
  const c2 = await ctxAt(SHUT, 390); const q = await c2.newPage(); await q.goto(base + '/', { waitUntil: 'networkidle' }); const t = (await q.locator('[data-livepill]').innerText()).trim();
  assert.equal(await q.locator('[data-livepill]').getAttribute('data-state'), 'closed'); assert.match(t, /closed/i); assert.ok(await q.locator('[data-livepill]').isVisible(), 'visible on a phone'); await c2.close(); ok(`session shut, on a phone: "${t}"`);
}
// 4. live rows: the first 25 screener rows and Today's leaders
{
  const ctx = await ctxAt(OPEN); const p = await ctx.newPage(); await p.goto(base + '/screener/', { waitUntil: 'networkidle' }); await p.waitForSelector('[data-body] tr[data-q]'); await p.clock.runFor(2000); await p.waitForTimeout(500);
  const rows = await p.locator('[data-body] tr[data-q]').evaluateAll((r) => r.map((x) => ({ s: x.dataset.q, px: x.querySelector('[data-q-px]')?.dataset.v ?? null, chg: x.querySelector('[data-q-chg]')?.dataset.chg ?? null, cells: x.children.length })));
  assert.equal(rows.length, 25, 'exactly the first 25 rows are live'); assert.ok(rows.every((r) => r.px && Math.abs(parseFloat(r.px) - pxOf(r.s) * 1.02) < 1e-6 && Math.abs(parseFloat(r.chg) - 2) < 1e-6), 'price and 1D are the quote\'s, recomputed here');
  const hdr = await p.locator('thead th').count(); assert.ok(rows.every((r) => r.cells === hdr), 'no stray stamp column was added'); assert.equal(await p.locator('[data-body] tr:not([data-q])').count() > 0, true, 'rows beyond 25 stay closes'); await ctx.close();
  ok(`screener: 25 live rows match the quotes (${rows[0].s} ${rows[0].px}), ${hdr} columns, the rest stay closes`);
  const c2 = await ctxAt(OPEN); const q = await c2.newPage(); await q.goto(base + '/terminal/', { waitUntil: 'networkidle' }); await q.clock.runFor(2000); await q.waitForTimeout(500);
  const lead = await q.locator('[data-widget="leaders"] tr[data-q]').evaluateAll((r) => r.map((x) => ({ s: x.dataset.q, px: x.querySelector('[data-q-px]').dataset.v, cells: x.children.length })));
  assert.ok(lead.length >= 5 && lead.every((r) => Math.abs(parseFloat(r.px) - pxOf(r.s) * 1.02) < 1e-6 && r.cells === 5), 'leaders show Last and Day from the quote'); await c2.close(); ok(`Today: ${lead.length} score leaders follow live quotes`);
}
// 5. installable and offline: manifest, worker, and the offline page when the network goes
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'allow' }); const p = await ctx.newPage();
  const man = await (await p.request.get(base + '/manifest.webmanifest')).json(); assert.ok(man.shortcuts.length === 3 && man.display === 'standalone' && man.start_url === '/terminal/');
  const meta = await (await p.request.get(base + '/terminal/')).text(); assert.match(meta, /viewport-fit=cover/); assert.match(meta, /apple-mobile-web-app-capable/);
  await p.goto(base + '/terminal/', { waitUntil: 'networkidle' }); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForFunction(() => navigator.serviceWorker.controller || true); await p.reload({ waitUntil: 'networkidle' });
  await ctx.setOffline(true); await p.goto(base + '/calls/').catch(() => {}); await p.waitForTimeout(800); const h1 = await p.locator('h1').innerText().catch(() => '');
  assert.match(h1, /offline/i, `offline page, got "${h1}"`); await ctx.setOffline(false); await ctx.close(); ok('manifest has 3 shortcuts and standalone display; viewport-fit=cover; offline navigation shows the offline page');
}
await browser.close(); assert.deepEqual(errors, [], 'no uncaught page errors'); ok('no uncaught page errors');
