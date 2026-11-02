// Before/after screenshots of the Phase 4 "pages-b" lane: News, My Desk (empty and filled), Data, Methodology, Help, Settings, Operations at 390 and 1280.
// Usage: node apps/tripwire/tests/pagesbshots.mjs <baseUrl> <outDir> <prefix>
import { chromium, newCtx, STATE } from './uimock.mjs';
import { mkdirSync } from 'node:fs';
const [base = 'http://localhost:8901', out = 'docs/tripwire/beta/pages-b', prefix = 'after'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const EMPTY = { ...STATE, follows: [], paper: [], entries: [], plans: [], compares: [], screens: [] };
const PAGES = [['news', '#/news', STATE], ['desk-empty', '#/desk', EMPTY], ['desk', '#/desk', STATE], ['data', '#/data', STATE], ['methodology', '#/methodology', STATE], ['help', '#/help', STATE], ['settings', '#/settings', STATE], ['operations', '#/ops', STATE]];
const b = await chromium.launch();
for (const w of [390, 1280]) for (const [name, hash, state] of PAGES) {
  const ctx = await newCtx(b, w, null, { state }); const pg = await ctx.newPage();
  const route = hash === '#/settings' && prefix === 'before' ? '#/profile' : hash;
  await pg.goto(base + '/' + route); await pg.reload(); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1800);
  await pg.screenshot({ path: `${out}/${prefix}-${name}-${w}.png`, fullPage: true }); await ctx.close();
}
await b.close(); console.log('shots in', out);
