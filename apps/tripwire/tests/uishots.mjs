// Before/after screenshots of the UI revamp: a company page on candles (5Y, monthly), Today and Profile, at 390 and 1280.
// Usage: node apps/tripwire/tests/uishots.mjs <baseUrl> <outDir> <prefix>
import { chromium, newCtx, ohlcSeries } from './uimock.mjs';
import { mkdirSync } from 'node:fs';
const [base = 'http://localhost:8813', out = 'docs/tripwire/revamp/ui', prefix = 'after'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const series = ohlcSeries(1700, '360ONE');
for (const w of [390, 1280]) {
  const ctx = await newCtx(b, w, series); const pg = await ctx.newPage();
  const wait = async () => { await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1500); };
  await pg.goto(base + '/#/c/360ONE'); await pg.waitForSelector('.chart-plot svg', { timeout: 20000 });
  for (const name of ["5Y", "MONTHLY", "CANDLES"]) await pg.locator(".c-bar").getByText(name, { exact: true }).click();
  await pg.waitForSelector('.c-candles rect'); await pg.waitForTimeout(700);
  await pg.locator('section.chart').scrollIntoViewIfNeeded(); await pg.locator('section.chart').screenshot({ path: `${out}/${prefix}-chart-candles-${w}.png` });
  await pg.screenshot({ path: `${out}/${prefix}-company-${w}.png`, fullPage: true });
  await pg.goto(base + '/#/today'); await pg.reload(); await wait(); await pg.screenshot({ path: `${out}/${prefix}-today-${w}.png`, fullPage: true });
  await pg.goto(base + '/#/profile'); await pg.reload(); await wait(); await pg.screenshot({ path: `${out}/${prefix}-profile-${w}.png`, fullPage: true });
  await ctx.close();
}
await b.close(); console.log('shots in', out);
