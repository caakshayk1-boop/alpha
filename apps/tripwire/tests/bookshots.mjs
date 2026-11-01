// Before / after pictures of the Book (Auto) and the Record at 390 and 1280, on the shared mocked ledger (bookfixture.mjs).
// Usage: node apps/tripwire/tests/bookshots.mjs <baseUrl> <outDir> <prefix>      e.g. ... http://localhost:8851 docs/tripwire/design/book-record after
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { openCtx } from './bookfixture.mjs';
const [base, dir, prefix] = [process.argv[2], process.argv[3], process.argv[4] ?? 'shot']; mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
for (const width of [390, 1280]) {
  const ctx = await openCtx(b, width); const pg = await ctx.newPage();
  for (const [name, route, wait] of [['book', '#/signals?v=auto', '.pcard, .card'], ['record', '#/signals?v=record', '[data-record], .card']]) {
    await pg.goto(`${base}/${route}`, { waitUntil: 'networkidle' }); await pg.waitForSelector(wait, { timeout: 20000 }); await pg.waitForTimeout(700);
    await pg.screenshot({ path: `${dir}/${prefix}-${name}-${width}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close(); console.log('shots written to', dir);
