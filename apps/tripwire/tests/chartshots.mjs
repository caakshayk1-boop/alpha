// Before/after pictures of Company and Compare at 390 and 1280. Usage: node apps/tripwire/tests/chartshots.mjs <baseUrl> <outDir> <prefix>
// The data-behind banner is pinned ON (staleBanner), so every picture shows the first screen the way a person meets it on a stale day; the pictures do not depend on the clock.
import { mkdirSync } from 'node:fs';
import { chromium, newCtx, ohlcSeries, staleBanner } from './uimock.mjs';
const [base = 'http://localhost:8801', out = 'docs/tripwire/beta/charts', prefix = 'after'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const w of [390, 1280]) {
  const ctx = await newCtx(b, w, ohlcSeries(1300, 'TCS', { nifty: true })); await staleBanner(ctx); const pg = await ctx.newPage();
  const go = async (route, sel) => { await pg.goto(base + '/'); await pg.goto(base + route); await pg.reload(); await pg.waitForSelector(sel, { timeout: 25000 }); await pg.waitForTimeout(900); };
  await go('/#/c/TCS', '.chart-plot svg'); await pg.screenshot({ path: `${out}/${prefix}-company-${w}.png`, fullPage: false });
  await pg.screenshot({ path: `${out}/${prefix}-company-${w}-full.png`, fullPage: true });
  await go('/#/compare?s=TCS,INFY', '.cchart svg path, .chart-plot svg'); await pg.screenshot({ path: `${out}/${prefix}-compare-${w}.png`, fullPage: false });
  await pg.screenshot({ path: `${out}/${prefix}-compare-${w}-full.png`, fullPage: true });
  await ctx.close();
}
await b.close();
