// Accessibility and layout gate for Tripwire, on the served build. axe-core: serious/critical fail; no horizontal overflow;
// no NaN/undefined/[object Object] in visible text; the sheet traps focus and Escape returns it.
// Usage: node apps/tripwire/tests/a11y.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2] ?? 'http://localhost:8801';
const ROUTES = ['/#/today', '/#/discover', '/#/signals', '/#/signals?v=tracker', '/#/signals?v=auto', '/#/signals?v=record', '/#/m/GOLD', '/#/compare?s=TCS', '/#/desk', '/#/desk?v=journal', '/#/desk?v=plans', '/#/desk?v=saved', '/#/profile', '/#/c/TCS', '/#/c/HDFCBANK', '/#/compare?s=TCS,INFY,HDFCBANK', '/#/report/TCS'];
const state = { v: 1, follows: ['TCS'], plans: [], compares: [], screens: [], snaps: {}, onboarded: true, reviews: [], paper: [{ id: 'pp1', sym: 'TCS', engine: 'MOM', asOf: '2026-10-23', ref: 2530, stop: 2400, horizon: 20, qty: 10, takenAt: 1761000000 }], prefs: { motion: 'off', haptics: false, horizon: '', experience: '', interests: [], equity: 1e6, cash: 1e6, riskPct: 0.5, maxPositionPct: 15 },
  entries: [{ id: 'x1', sym: 'TCS', created: '2026-10-01T00:00:00Z', archived: false, versions: [{ at: '2026-10-01T00:00:00Z', thesis: 'Seed', support: '', counter: '', decision: '', invalidation: '', trigger: '', reviewOn: '2026-10-10' }] }] };
const problems = []; const b = await chromium.launch(); let n = 0;
for (const [w, h, tag] of [[390, 844, 'phone'], [360, 740, 'small'], [320, 640, 'tiny'], [1280, 900, 'desktop']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, bypassCSP: true });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, state);
  const mockSeries = (() => { const t = [], c = []; let d = Date.UTC(2014, 0, 1, 4) / 1000, px = 100; for (let i = 0; i < 3000; i++) { d += 86400; px *= 1 + 0.0004 + Math.sin(i / 17) * 0.004; t.push(d); c.push(px); } return JSON.stringify({ ok: true, sym: 'X', t, c }); })();
  await ctx.route('**/api/chart*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: mockSeries }));
  await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ledger: { schema: 'tripwire-ledger/1', started: '2026-10-23', updated: 'x', cost: 0.25, days: [{ asOf: '2026-10-23', recorded: 'x', engines: { MOM: { eligible: 750, passed: 9, picked: 1, skippedWideStop: 0 } } }], picks: [{ id: 'a', engine: 'MOM', sym: 'TCS', asOf: '2026-10-23', ref: 100, stop: 95, horizon: 20, score: 90, rank: 1 }], outcomes: { a: { status: 'closed', final: true, r: 1.1, pct: 3, niftyPct: 1, reason: 'Stop', sessions: 4, exitDay: '2026-10-28' } } } }) }));
  const nowS = Math.floor(Date.now() / 1000); const qq = (prev, px) => ({ t: Array.from({ length: 30 }, (_, i) => nowS - (30 - i) * 300), c: Array.from({ length: 30 }, (_, i) => prev + (px - prev) * (i / 29)), px, pt: nowS - 60, prev, live: true });
  await ctx.route('**/api/pulse*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', quotes: { NIFTY: qq(24000, 24120), BANKNIFTY: qq(52000, 51800), VIX: qq(14, 14.6) }, missing: [] }) }));
  await ctx.route('**/api/intraday*', (r) => { const s = (new URL(r.request().url()).searchParams.get('s') || '').split(',').filter(Boolean); const quotes = {}; for (const k of s) quotes[k] = qq(2500, 2550); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', quotes, missing: [] }) }); });
  await ctx.route('**/api/macro*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', quotes: { GOLD: qq(2600, 2650.5), SILVER: qq(30, 31.2), BRENT: qq(80, 79.1), WTI: qq(76, 75.2), USDINR: qq(88.2, 88.5), MYRINR: qq(20.1, 20.2), USDMYR: qq(4.4, 4.38), BTC: qq(67000, 68000) }, missing: [] }) }));
  await ctx.route('**/api/news*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', q: 'q', items: [{ title: 'Sensex ends higher as banks rally; Q2 results in focus for several large companies this week', source: 'Mint', url: 'https://example.com/a', t: nowS - 3600, tags: ['Results'], also: 2, sources: ['Mint'] }, { title: 'RBI keeps rates unchanged', source: 'Reuters', url: 'https://example.com/b', t: nowS - 7200, tags: ['Regulator'], also: 0, sources: ['Reuters'] }] }) }));
  await ctx.route('**/api/factors*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, schema: 'tripwire-factors/1', as_of: '2026-10-23', universe: 700, rows: { TCS: { mom12_1: 80, smooth_fip: 70, eff_ratio60: 20, resid_mom: 55 }, HDFCBANK: { mom12_1: 30 } }, study: { mom12_1: { adopt: false, kind: 'common baseline' }, smooth_fip: { adopt: false, kind: 'candidate' } } }) }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  for (const r of ROUTES) {
    await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(1400); n++;
    // the worst case on a small screen: a wider fallback font than the one the design was drawn in (CI runners and some phones have no Inter or SF)
    if (tag === 'tiny' || tag === 'small') await pg.addStyleTag({ content: '*{font-family:"DejaVu Sans",Verdana,sans-serif !important}' });
    await pg.addScriptTag({ content: axe });
    const res = await pg.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].html.slice(0, 90)}`));
    for (const v of res) problems.push(`${tag} ${r}: ${v}`);
    const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) problems.push(`${tag} ${r}: horizontal overflow ${over}px`);
    const txt = await pg.locator('body').innerText();
    if (/\bNaN\b|\bundefined\b|\[object Object\]/.test(txt)) problems.push(`${tag} ${r}: placeholder text in the page`);
  }
  // sheet focus trap
  await pg.goto(base + '/#/today'); await pg.waitForSelector('nav.tabs');
  await pg.getByRole('button', { name: 'Search' }).click();
  for (let i = 0; i < 6; i++) await pg.keyboard.press('Tab');
  if (!(await pg.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) problems.push(`${tag}: focus left the open sheet`);
  await pg.keyboard.press('Escape');
  if (await pg.locator('[role=dialog]').count()) problems.push(`${tag}: Escape did not close the sheet`);
  if (errs.length) problems.push(`${tag}: script errors ${errs[0]}`);
  await ctx.close();
}
// every colour theme keeps the contrast the scan demands
for (const theme of ['ocean', 'violet', 'sunset', 'rose']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, { ...state, prefs: { ...state.prefs, theme } });
  const nowS = Math.floor(Date.now() / 1000); const qq = (prev, px) => ({ t: Array.from({ length: 30 }, (_, i) => nowS - (30 - i) * 300), c: Array.from({ length: 30 }, (_, i) => prev + (px - prev) * (i / 29)), px, pt: nowS - 60, prev, live: true });
  await ctx.route('**/api/pulse*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', quotes: { NIFTY: qq(24000, 24120), BANKNIFTY: qq(52000, 51800), VIX: qq(14, 14.6) }, missing: [] }) }));
  await ctx.route('**/api/macro*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', quotes: { GOLD: qq(2600, 2650), SILVER: qq(30, 31), BRENT: qq(80, 79), WTI: qq(76, 75), USDINR: qq(88, 88.5), MYRINR: qq(20, 20.2), USDMYR: qq(4.4, 4.38), BTC: qq(67000, 68000) }, missing: [] }) }));
  await ctx.route('**/api/news*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', q: 'q', items: [{ title: 'Sensex ends higher as banks rally', source: 'Mint', url: 'https://example.com/a', t: nowS - 3600, tags: ['Results', 'IPO'], also: 1, sources: ['Mint'] }] }) }));
  await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' }));
  await ctx.route('**/api/intraday*', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }));
  await ctx.route('**/api/bars*', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }));
  const pg = await ctx.newPage();
  for (const r of ['/#/today', '/#/signals?v=auto', '/#/profile']) {
    await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(900); n++;
    await pg.addScriptTag({ content: axe });
    const res = await pg.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].html.slice(0, 90)}`));
    for (const v of res) problems.push(`theme ${theme} ${r}: ${v}`);
  }
  await ctx.close();
}
// the biggest text sizes: nothing may push the page sideways at 150% and 200% of the system text size
for (const [pct, tag] of [[150, '150%'], [200, '200%']]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, state);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }));
  const pg = await ctx.newPage();
  for (const r of ['/#/today', '/#/discover', '/#/signals', '/#/signals?v=auto', '/#/c/TCS', '/#/desk', '/#/profile']) {
    await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); await pg.waitForSelector('nav.tabs'); n++;
    await pg.addStyleTag({ content: `html{font-size:${pct}% !important}` }); await pg.waitForTimeout(500);
    const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) problems.push(`text ${tag} ${r}: horizontal overflow ${over}px`);
    const clipped = await pg.evaluate(() => [...document.querySelectorAll('.btn,.chip,.seg button,.tabs a')].filter((e) => e.scrollHeight - e.clientHeight > 2 || e.scrollWidth - e.clientWidth > 2).slice(0, 2).map((e) => (e.textContent || '').trim().slice(0, 24)));
    if (clipped.length) problems.push(`text ${tag} ${r}: controls clip their text: ${clipped.join(', ')}`);
  }
  await ctx.close();
}
await b.close();
console.log(problems.length ? problems.map((p) => 'FAIL  ' + p).join('\n') : `PASS  ${n} page loads, axe serious/critical clean, no overflow, no placeholder text, sheet focus trap`);
process.exit(problems.length ? 1 : 0);
