// Screenshot of the first screen of a company page (the 30-second read). Usage: node apps/tripwire/tests/uitop.mjs <baseUrl> <out.png> [width] [sym]
import { chromium, newCtx, ohlcSeries } from './uimock.mjs';
const [base = 'http://localhost:8813', out = '/tmp/top.png', w = '390', sym = '360ONE'] = process.argv.slice(2);
const b = await chromium.launch(); const ctx = await newCtx(b, Number(w), ohlcSeries(1700, sym)); const pg = await ctx.newPage();
await pg.goto(`${base}/#/c/${sym}`); await pg.waitForSelector('.decision', { timeout: 20000 }); await pg.waitForTimeout(1500);
await pg.screenshot({ path: out, clip: { x: 0, y: 0, width: Number(w), height: Number(w) >= 1000 ? 900 : 1100 }, fullPage: true });
await b.close();
