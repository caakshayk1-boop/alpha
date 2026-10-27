// Screenshots of the news module on Today, the News page and Profile's service card. Usage: node apps/tripwire/tests/newsshots.mjs <baseUrl> <before|after> [outDir]
// The mocks are the shared ones in fixtures.mjs plus a health answer that reports the news probe as HTTP 503 (the owner's evidence: cached headlines on Today, "HTTP 503" on Profile).
// For "after" the news endpoints are answered from the recorded snapshot fixture (tests/fixtures/news/snapshot.json), as the browser test does.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8811'; const tag = process.argv[3] ?? 'before'; const out = process.argv[4] ?? 'docs/tripwire/revamp/news'; mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const [w, h] of [[390, 844], [1280, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, bypassCSP: true, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, STATE);
  await mockApi(ctx);
  const t = new Date().toISOString();
  if (tag === 'after') {
    const { mockNews } = await import('./newsmock.mjs'); await mockNews(ctx, { health503: true });
  } else {
    await ctx.route('**/api/health*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, checked_at: t, prices: { ok: true, ms: 200, last_print: t, age_sec: 30, error: null }, news: { ok: false, ms: 900, error: 'HTTP 503' }, bindings: ['ASSETS'], secrets_configured: 0 }) }));
  }
  const pg = await ctx.newPage();
  await pg.goto(base + '/#/today'); await pg.reload(); await pg.waitForSelector('.news, .nw-row', { timeout: 15000 }); await pg.waitForTimeout(1500);
  await pg.locator(tag === 'after' ? 'section.nw' : '.card:has(.news)').first().scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
  await pg.locator(tag === 'after' ? 'section.nw' : '.card:has(.news)').first().screenshot({ path: `${out}/${tag}-today-news-${w}.png` });
  await pg.goto(base + '/#/profile'); await pg.reload(); await pg.waitForTimeout(1500);
  const sum = pg.locator('details.ev summary', { hasText: /News/ }).first(); await sum.scrollIntoViewIfNeeded(); await sum.click(); await pg.waitForTimeout(500);
  await sum.locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${out}/${tag}-profile-services-${w}.png` });
  if (tag === 'after') { await pg.goto(base + '/#/news'); await pg.reload(); await pg.waitForTimeout(2000); await pg.screenshot({ path: `${out}/${tag}-news-page-${w}.png`, fullPage: false }); }
  await ctx.close();
}
await b.close(); console.log('screenshots in', out);
