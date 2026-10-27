// Before/after pictures of Today (guest, with follows) and My Desk at 390 and 1280.
// Usage: node apps/tripwire/tests/todayshots.mjs <baseUrl> <outDir> <prefix>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8814'; const out = process.argv[3] ?? 'docs/tripwire/revamp/today'; const pre = process.argv[4] ?? 'before'; mkdirSync(out, { recursive: true });
const GUEST = { ...STATE, follows: [], entries: [], paper: [], snaps: {} };
const old = new Date(Date.now() - 3 * 86400000).toISOString();
const FOLLOW = { ...STATE, snaps: { TCS: [{ at: old, day: '2026-10-20', px: 2380, rsi: 28, rs3m: -2, from_high: -26 }], GCSL: [{ at: old, day: '2026-10-20', px: 640, rsi: 61, rs3m: 5, from_high: -18 }] } };
const b = await chromium.launch();
for (const [w, h] of [[390, 844], [1280, 900]]) for (const [name, st, route] of [['guest', GUEST, '/#/today'], ['follows', FOLLOW, '/#/today'], ['desk', FOLLOW, '/#/desk']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, st);
  await mockApi(ctx); const pg = await ctx.newPage();
  await pg.goto(base + route); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(3500);
  await pg.screenshot({ path: `${out}/${pre}-${name}-${w}.png`, fullPage: true }); await ctx.close();
}
await b.close(); console.log('shots in', out);
