// The other screens' code is not fetched at start-up (it competed with the first screen), but it is fetched before the tap that needs it:
// a first-time visitor's touch on the welcome screen starts it, a returning visitor's page starts it once loaded and idle. Usage: node prefetch.mjs http://localhost:8801
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801'; let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const chunks = (log) => log.filter((u) => /\/app\.[^/]+\.chunk-[^/]+\.js$/.test(u)).length;
const mk = async (state) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); if (state) await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), state); await mockApi(ctx); const pg = await ctx.newPage(); const log = []; pg.on('requestfinished', (r) => log.push(r.url())); return { ctx, pg, log }; };

{ const { ctx, pg, log } = await mk(null); await pg.goto(base + '/'); await pg.waitForSelector('.welcome h1'); await pg.waitForTimeout(5500);
  const idle = chunks(log); ok(idle <= 2, `first-time visitor: ${idle} script chunks after 5.5 s of doing nothing (the welcome screen itself and its shared code, not the other screens)`);
  const names = log.filter((u) => /chunk-/.test(u)).length; void names;
  await pg.locator('.welcome').dispatchEvent('pointerdown'); await pg.waitForTimeout(2500); const touched = chunks(log);
  ok(touched >= idle + 5, `first-time visitor: touching the welcome screen fetches the other screens (${idle} → ${touched} chunks)`); await ctx.close(); }
{ const { ctx, pg, log } = await mk({ ...STATE, onboarded: true }); await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-sec="brief"]', { timeout: 20000 }); await pg.waitForTimeout(1200);
  const early = chunks(log); await pg.waitForTimeout(7500); const later = chunks(log);
  ok(later > early && later >= 6, `returning visitor: the other screens arrive once the page is idle, not at start-up (${early} chunks at 1.2 s, ${later} at 9 s)`);
  const t0 = Date.now(); await pg.locator('nav.tabs a[href="#/discover"]').click(); await pg.waitForSelector('.list .li', { timeout: 15000 }); ok(Date.now() - t0 < 2500, `and a tap on Discover is then quick (${Date.now() - t0} ms)`); await ctx.close(); }
await b.close(); console.log(fails ? `\n${fails} failed` : '\nprefetch: all passed'); process.exit(fails ? 1 : 0);
