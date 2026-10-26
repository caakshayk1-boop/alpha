import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const [route, out, w = '390', sel = ''] = process.argv.slice(2);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +w, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE); await mockApi(ctx);
const pg = await ctx.newPage(); await pg.goto('http://localhost:8801/' ); await pg.goto('http://localhost:8801/#' + route); await pg.reload(); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(2500);
if (sel) { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(300); await el.screenshot({ path: out }); } else await pg.screenshot({ path: out, fullPage: true });
await b.close();
