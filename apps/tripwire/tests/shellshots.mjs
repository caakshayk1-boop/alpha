// Screenshots of the shell: bottom bar, sidebar, More, Settings reached through More, the iOS install hint. Mocks as in the browser suites.
// Usage: node apps/tripwire/tests/shellshots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801'; const out = process.argv[3] ?? 'docs/tripwire/launch/shell'; mkdirSync(out, { recursive: true });
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const b = await chromium.launch();
for (const [w, h, tag] of [[390, 844, '390'], [1280, 800, '1280']]) {
  for (const ios of w === 390 ? [false, true] : [false]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 2, ...(ios ? { userAgent: IOS_UA } : {}) });
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, STATE); await mockApi(ctx);
    const pg = await ctx.newPage(); const to = async (hash, sel) => { await pg.goto(base + '/'); await pg.goto(base + '/' + hash); await pg.reload(); await pg.waitForSelector(sel ?? 'nav.tabs'); await pg.waitForTimeout(1500); };
    if (!ios) {
      await to('#/today'); await pg.screenshot({ path: `${out}/${tag}-today-nav.png` });
      await to('#/more'); await pg.screenshot({ path: `${out}/${tag}-more.png`, fullPage: true });
      await pg.locator('[data-more-row=settings]').click(); await pg.waitForTimeout(1200); await pg.screenshot({ path: `${out}/${tag}-settings-via-more.png` });
    } else { await to('#/more', '[data-install]'); await pg.screenshot({ path: `${out}/${tag}-more-ios-install-hint.png`, fullPage: true }); }
    await ctx.close();
  }
}
await b.close();
