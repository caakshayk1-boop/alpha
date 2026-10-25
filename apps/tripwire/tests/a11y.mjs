// Accessibility and layout gate for Tripwire, on the served build. axe-core: serious/critical fail; no horizontal overflow;
// no NaN/undefined/[object Object] in visible text; the sheet traps focus and Escape returns it.
// Usage: node apps/tripwire/tests/a11y.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2] ?? 'http://localhost:8801';
const ROUTES = ['/#/today', '/#/discover', '/#/signals', '/#/signals?v=tracker', '/#/desk', '/#/desk?v=journal', '/#/desk?v=plans', '/#/desk?v=saved', '/#/profile', '/#/c/TCS', '/#/c/HDFCBANK', '/#/compare?s=TCS,INFY,HDFCBANK', '/#/report/TCS'];
const state = { v: 1, follows: ['TCS'], plans: [], compares: [], screens: [], snaps: {}, onboarded: true, reviews: [], paper: [{ id: 'pp1', sym: 'TCS', engine: 'MOM', asOf: '2026-10-23', ref: 2530, stop: 2400, horizon: 20, qty: 10, takenAt: 1761000000 }], prefs: { motion: 'off', haptics: false, horizon: '', experience: '', interests: [], equity: 1e6, cash: 1e6, riskPct: 0.5, maxPositionPct: 15 },
  entries: [{ id: 'x1', sym: 'TCS', created: '2026-10-01T00:00:00Z', archived: false, versions: [{ at: '2026-10-01T00:00:00Z', thesis: 'Seed', support: '', counter: '', decision: '', invalidation: '', trigger: '', reviewOn: '2026-10-10' }] }] };
const problems = []; const b = await chromium.launch(); let n = 0;
for (const [w, h, tag] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, bypassCSP: true });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, state);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  for (const r of ROUTES) {
    await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(1400); n++;
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
await b.close();
console.log(problems.length ? problems.map((p) => 'FAIL  ' + p).join('\n') : `PASS  ${n} page loads, axe serious/critical clean, no overflow, no placeholder text, sheet focus trap`);
process.exit(problems.length ? 1 : 0);
