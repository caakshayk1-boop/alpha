// Screenshots of the v6 Today at 1440x900 and 390x844, viewport and full page, for a human to LOOK at. Not a check.
// Usage: node apps/tripwire/tests/v6homeshots.mjs [baseUrl] [outDir] [tag]
import { mkdirSync } from 'node:fs';
import { chromium, newCtx, STATE } from './uimock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801'; const out = process.argv[3] ?? '/tmp/v6home'; const tag = process.argv[4] ?? 'after'; mkdirSync(out, { recursive: true });
const prevAt = new Date(Date.now() - 3 * 86400000).toISOString();
const snap = { at: prevAt, day: '2026-10-20', px: 2380, rsi: 66, rs3m: 2, from_high: -20, atr_pct: 3, sma200: 2450, high52: 3350, low52: 1976.8, trend: 'mixed', rules: 2, next_earnings: null, risk: 'LOW', elig: 'full' };
const b = await chromium.launch();
for (const [name, st] of [['with', { ...STATE, follows: ['TCS', 'GCSL', 'INFY', 'RELIANCE'], seen: { TCS: [snap] } }], ['guest', { ...STATE, follows: [], entries: [], paper: [], snaps: {} }]]) for (const w of [1440, 390]) {
  const ctx = await newCtx(b, w, null, { state: st }); const pg = await ctx.newPage(); await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-sec="brief"], [data-sec="market"]', { timeout: 20000 }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `${out}/${tag}-${name}-${w}.png` }); await pg.screenshot({ path: `${out}/${tag}-${name}-${w}-full.png`, fullPage: true });
  await ctx.close();
}
await b.close();
