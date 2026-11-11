// Screenshots of Today (revamp v2, 11 Nov 2026) at 390 and 1280, with followed names that have changes, for a human to LOOK at. Not a check.
// Usage: node apps/tripwire/tests/todayv2shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801'; const out = process.argv[3] ?? 'docs/tripwire/revamp-v2/today'; mkdirSync(out, { recursive: true });
const prevAt = new Date(Date.now() - 3 * 86400000).toISOString();
const snap = { at: prevAt, day: '2026-10-20', px: 2380, rsi: 66, rs3m: 2, from_high: -20, atr_pct: 3, sma200: 2450, high52: 3350, low52: 1976.8, trend: 'mixed', rules: 2, next_earnings: null, risk: 'LOW', elig: 'full' };
const WITH = { ...STATE, follows: ['TCS', 'GCSL', 'INFY', 'RELIANCE'], seen: { TCS: [snap] } };
const GUEST = { ...STATE, follows: [], entries: [], paper: [], snaps: {} };
const b = await chromium.launch();
for (const [name, st] of [['with', WITH], ['guest', GUEST]]) for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w > 1000 ? 900 : 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch { /* private mode */ } }, st); await mockApi(ctx);
  const pg = await ctx.newPage(); await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-sec="brief"]', { timeout: 20000 }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `${out}/today-${name}-${w}.png`, fullPage: true });
  if (name === 'with') { const r = pg.locator('[data-board-row] .br-hit').first(); if (await r.count()) { await r.click(); await pg.waitForTimeout(500); await pg.screenshot({ path: `${out}/today-${name}-${w}-open.png`, fullPage: true }); } }
  await ctx.close();
}
await b.close();
