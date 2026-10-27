// Probe: what the condition sheet's numeric inputs hold, as a real DOM + accessibility-tree check. Usage: node discoverprobe.mjs <baseUrl>
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8812';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE); await mockApi(ctx); const pg = await ctx.newPage();
await pg.goto(base + '/#/discover?rsi=30-56'); await pg.waitForFunction(() => !document.querySelector('.routewait') && document.querySelector('.chip.on-x'));
await pg.getByRole('button', { name: '+ Condition' }).click(); await pg.waitForSelector('[role=dialog]');
const out = await pg.evaluate(() => [...document.querySelectorAll('[role=dialog] input')].map((i) => ({ id: i.id, type: i.type, value: i.value, placeholder: i.placeholder, label: (document.querySelector(`label[for="${i.id}"]`) || {}).textContent })));
console.log(JSON.stringify(out, null, 1));
const snap = await pg.locator('[role=dialog]').ariaSnapshot(); console.log(snap.split('\n').filter((l) => /textbox|slider|spinbutton/.test(l)).join('\n'));
await b.close();
