// Before/after pictures of Discover plus the pixel height of everything above the first result.
// Usage: node apps/tripwire/tests/discovershots.mjs <baseUrl> <outDir> <prefix: before|after>
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8812'; const out = process.argv[3] ?? '/tmp/shots'; const pre = process.argv[4] ?? 'after'; mkdirSync(out, { recursive: true });
const VIEWS = [['list-default', '/#/discover'], ['table-default', '/#/discover?view=table'], ['list-uptrend-rsi', '/#/discover?trend=up&rsi=30-56'], ['table-uptrend-rsi', '/#/discover?view=table&trend=up&rsi=30-56']];
const b = await chromium.launch(); const heights = {};
for (const [w, h] of [[390, 844], [1280, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, STATE);
  await mockApi(ctx); const pg = await ctx.newPage();
  for (const [name, r] of VIEWS) {
    await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload();
    await pg.waitForFunction(() => !document.querySelector('.routewait') && (document.querySelector('.stbl tbody tr, .list .li, .card .lead')), null, { timeout: 20000 }); await pg.waitForTimeout(1200);
    // the top of the first result (a list row or the table's first body row), measured from the top of the page
    const y = await pg.evaluate(() => { const el = document.querySelector('.stbl tbody tr, .list .li'); return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null; });
    const hd = await pg.evaluate(() => { const el = document.querySelector('.stbl thead, .list'); return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null; });
    heights[`${w}-${name}`] = { firstResultTop: y, resultsBlockTop: hd };
    await pg.screenshot({ path: `${out}/${pre}-${name}-${w}.png` });
  }
  await ctx.close();
}
await b.close(); writeFileSync(`${out}/${pre}-heights.json`, JSON.stringify(heights, null, 1)); console.log(JSON.stringify(heights, null, 1));
