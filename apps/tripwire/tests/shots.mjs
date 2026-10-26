// Screenshots of the key screens at the five widths. Usage: node apps/tripwire/tests/shots.mjs <baseUrl> <outDir> [widths]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801'; const out = process.argv[3] ?? '/tmp/shots'; mkdirSync(out, { recursive: true });
const widths = (process.argv[4] ?? '390,1440').split(',').map(Number);
const ROUTES = [['today', '/#/today'], ['discover', '/#/discover'], ['company-gcsl', '/#/c/GCSL'], ['picks', '/#/signals'], ['tracker', '/#/signals?v=tracker'], ['desk', '/#/desk'], ['profile', '/#/profile']];
const b = await chromium.launch();
for (const w of widths) {
  const h = w >= 1000 ? 900 : w >= 700 ? 1024 : 844;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, bypassCSP: true });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, STATE);
  await mockApi(ctx); const pg = await ctx.newPage();
  for (const [name, r] of ROUTES) { await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); await pg.waitForSelector('nav.tabs, nav'); await pg.waitForTimeout(1800); await pg.screenshot({ path: `${out}/${w}-${name}.png`, fullPage: name === 'today' || name === 'company-gcsl' }); }
  await ctx.close();
}
await b.close(); console.log('shots in', out);
