// Screenshots of the Book (revamp v2, 11 Nov 2026): Positions, Picks and Record at 390 and 1280, on the committed ledger (ledger/ledger.json), with the shared mocks.
// Usage: node --experimental-strip-types apps/tripwire/tests/book2shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8951'; const out = process.argv[3] ?? 'docs/tripwire/revamp-v2/book'; mkdirSync(out, { recursive: true });
const ledger = readFileSync(new URL('../ledger/ledger.json', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, serviceWorkers: 'block', deviceScaleFactor: w < 600 ? 2 : 1 });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, STATE);
  await mockApi(ctx);
  await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: `{"ok":true,"ledger":${ledger}}` }));
  const pg = await ctx.newPage();
  for (const [name, v, wait] of [['positions', 'positions', '[data-strip]'], ['picks', 'picks', '.pk-eng'], ['record', 'record', '[data-record]']]) {
    await pg.goto(`${base}/#/signals?v=${v}`); await pg.waitForSelector(wait, { timeout: 20000 }); await pg.waitForTimeout(1500);
    await pg.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: false });
  }
  await pg.goto(`${base}/#/signals?v=positions`); await pg.waitForSelector('.pc-row .pc-head'); await pg.locator('.pc-row .pc-head').first().click(); await pg.waitForTimeout(500);
  await pg.locator('.pc-row').first().screenshot({ path: `${out}/positions-row-open-${w}.png` });
  await ctx.close();
}
await b.close(); console.log(`shots in ${out}`);
