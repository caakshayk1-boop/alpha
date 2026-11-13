import { chromium, devices } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, STATE); await mockApi(ctx);
const pg = await ctx.newPage(); pg.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 200)));
await pg.goto('http://localhost:8811/#/desk?v=plans'); await pg.waitForTimeout(3000);
console.log('BTN', await pg.$$eval('button', (n) => n.map((x) => (x.getAttribute('aria-label') || x.textContent).trim().slice(0, 30)).join(' | ')));
console.log('BODY', (await pg.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | '));
await b.close();
