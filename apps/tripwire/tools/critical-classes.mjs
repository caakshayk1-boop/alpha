// Captures the classes the first viewport really renders, so the critical CSS is measured, not guessed. Run against a served build whenever the first screen changes:
//   node apps/tripwire/tools/critical-classes.mjs http://localhost:8801      (writes apps/tripwire/static/critical-classes.json)
// Views captured: Today as a guest at 390x844 and 1280x800 (the two layouts), each cut to what sits inside the first viewport plus 60 px, and the boot splash. tests/critical.mjs fails when
// a class rendered in that area is missing from the file.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATE, mockApi } from '../tests/fixtures.mjs';
export const VIEWS = [[390, 844], [1280, 800]];
export async function renderedClasses(base, view = '/#/today', sizes = VIEWS) {
  const b = await chromium.launch(); const found = new Set();
  /* Two fixed clocks, so the list covers both states of the clock-dependent classes (a live badge is `on` only while the NSE session is on): Mon 26 Oct 2026 11:00 IST (open) and Sun 1 Nov 2026 11:00 IST (shut). 2 Nov 2026: capturing on a Sunday alone left `on` out and CI, running on a Monday morning, failed. */
  for (const at of ['2026-10-26T05:30:00Z', '2026-11-01T05:30:00Z']) for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); await ctx.clock.setFixedTime(new Date(at));
    await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, { ...STATE, follows: [], entries: [], paper: [] }); await mockApi(ctx);
    const pg = await ctx.newPage(); await pg.goto(base + view); await pg.waitForSelector('[data-sec="brief"], .dsk', { timeout: 20000 }); await pg.waitForTimeout(1200);
    for (const c of await pg.evaluate((vh) => { const out = []; document.querySelectorAll('body *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.top < vh + 60 && r.bottom > -10 && r.width > 0) out.push(...e.classList); }); return out; }, h)) found.add(c);
    await ctx.close();
  }
  await b.close(); return [...found].sort();
}
/** The classes the FIRST-VISIT screen (the landing) renders in its first viewport, with no saved state: the page a new visitor sees must paint styled before the full stylesheet arrives. */
export async function firstVisitClasses(base, sizes = VIEWS) {
  const b = await chromium.launch(); const found = new Set();
  for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); await mockApi(ctx);
    const pg = await ctx.newPage(); await pg.goto(base + '/'); await pg.waitForSelector('.lp-hero h1', { timeout: 20000 }); await pg.waitForSelector('.lp-card', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1200);
    for (const c of await pg.evaluate((vh) => { const out = []; document.querySelectorAll('body *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.top < vh + 60 && r.bottom > -10 && r.width > 0) out.push(...e.classList); }); return out; }, h)) found.add(c);
    await ctx.close();
  }
  await b.close(); return [...found].sort();
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const base = process.argv[2] ?? 'http://localhost:8801'; const cls = [...await renderedClasses(base), ...await firstVisitClasses(base)]; cls.push('boot', 'view', 'routewait');
  writeFileSync(new URL('../static/critical-classes.json', import.meta.url), JSON.stringify([...new Set(cls)].sort(), null, 0) + '\n'); console.log(`critical-classes: ${new Set(cls).size} classes`);
}
