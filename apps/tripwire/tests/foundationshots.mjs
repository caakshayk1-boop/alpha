// Before/after pictures of the design foundation: Today, Discover, a Company page and More at 390 and 1280, on the frozen screen fixture.
// Usage: node apps/tripwire/tests/foundationshots.mjs <baseUrl> <outDir> <prefix>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8831'; const out = process.argv[3] ?? 'docs/tripwire/design/foundation'; const pre = process.argv[4] ?? 'before'; mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const [w, h] of [[390, 844], [1280, 900]]) for (const [name, route] of [['today', '/#/today'], ['discover', '/#/discover'], ['company', '/#/c/GCSL'], ['more', '/#/more']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, STATE);
  await mockApi(ctx); const pg = await ctx.newPage();
  await pg.goto(base + route); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(3000);
  await pg.screenshot({ path: `${out}/${pre}-${name}-${w}.png`, fullPage: name !== 'discover' }); await ctx.close();
}
await b.close(); console.log('shots in', out);
