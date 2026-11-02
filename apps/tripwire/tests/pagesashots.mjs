// Before / after pictures of Today, Markets, Discover, Signals (Picks), Auto and Record at 390 and 1280. Auto and Record use the shared mocked ledger (bookfixture.mjs).
// Usage: node apps/tripwire/tests/pagesashots.mjs <baseUrl> <outDir> <prefix>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { openCtx } from './bookfixture.mjs';
const [base, dir, prefix] = [process.argv[2], process.argv[3], process.argv[4] ?? 'shot']; mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
const ROUTES = [['today', '#/today'], ['markets', '#/markets'], ['discover', '#/discover'], ['signals', '#/signals'], ['auto', '#/signals?v=auto'], ['record', '#/signals?v=record']];
for (const width of [390, 1280]) {
  const ctx = await openCtx(b, width); const pg = await ctx.newPage();
  for (const [name, route] of ROUTES) {
    await pg.goto(`${base}/${route}`, { waitUntil: 'networkidle' }); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(2500);
    await pg.screenshot({ path: `${dir}/${prefix}-${name}-${width}.png`, fullPage: name !== 'discover' });
  }
  await ctx.close();
}
await b.close(); console.log('shots written to', dir);
