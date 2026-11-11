// Pictures of the revamp-v2 Research lane: Research (list and table), a Company page (TCS) and News, at 390 and 1280, on the frozen screen fixture and the mocked news.
// Usage: node apps/tripwire/tests/researchshots.mjs <baseUrl> <outDir> [prefix]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8961'; const out = process.argv[3] ?? 'docs/tripwire/revamp-v2/research'; const pre = process.argv[4] ?? 'after'; mkdirSync(out, { recursive: true });
const VIEWS = [['research', '/#/discover', '[data-testid=count]'], ['research-table', '/#/discover?view=table&sort=roce_med.desc', '.stbl tbody tr'], ['company-tcs', '/#/c/TCS', 'h1'], ['news', '/#/news', 'section.nw, .nw']];
const b = await chromium.launch();
for (const [w, h] of [[390, 844], [1280, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, STATE);
  await mockApi(ctx); const pg = await ctx.newPage();
  for (const [name, r, sel] of VIEWS) {
    await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload();
    await pg.waitForSelector(sel, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(1500);
    await pg.screenshot({ path: `${out}/${pre}-${name}-${w}.png`, fullPage: process.env.FULL === '1' });
    if (process.env.FULL !== '1') await pg.screenshot({ path: `${out}/${pre}-${name}-${w}-full.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close(); console.log('shots in', out);
