// Screenshots of Menu and the pages it leads to (revamp v2, 11 Nov 2026). Mocks as in the browser suites. Also reports any sideways overflow.
// Usage: node apps/tripwire/tests/menushots.mjs [baseUrl] [outDir] [pages, comma separated]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801'; const out = process.argv[3] ?? 'docs/tripwire/revamp-v2/menu'; mkdirSync(out, { recursive: true });
const PAGES = (process.argv[4] ?? 'more,desk,data,settings').split(',');
const b = await chromium.launch();
for (const [w, h, tag] of [[320, 700, '320'], [390, 844, '390'], [1280, 800, '1280']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, STATE); await mockApi(ctx);
  const pg = await ctx.newPage();
  for (const p of PAGES) {
    await pg.goto(base + '/#/' + p); await pg.reload(); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(1500);
    const over = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (over > 0) console.log(`OVERFLOW ${tag} ${p}: ${over}px`);
    const h1 = await pg.locator('main h1, [role=main] h1, h1').count(); if (h1 !== 1) console.log(`H1 ${tag} ${p}: ${h1}`);
    if (tag !== '320') await pg.screenshot({ path: `${out}/${tag}-${p}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();
