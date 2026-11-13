// #/info "About and data" (13 Nov 2026, v6): the route renders, every section has its anchor, the links from Menu, Book, Markets and Picks resolve to the right section,
// and what moved off the screens is really here. Does not read the clock: it checks text and structure only.
// Usage: node apps/tripwire/tests/info.mjs [baseUrl]
import { chromium } from 'playwright';
import { newCtx } from './uimock.mjs';
import { ledger, openCtx } from './bookfixture.mjs';
const base = process.argv[2] ?? 'http://localhost:8971';
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) bad++; };
const b = await chromium.launch();
const SECTIONS = ['data', 'pnl', 'book', 'markets', 'picks', 'method', 'legal', 'build'];

for (const width of [390, 1440]) {
  const ctx = await newCtx(b, width); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(`${base}/#/info`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-info]', { timeout: 20000 });
  ok(await pg.locator('h1').count() === 1 && /About and data/.test(await pg.locator('h1').innerText()), `${width}: #/info renders one h1, "About and data"`);
  ok((await pg.title()).startsWith('About and data'), `${width}: the tab title names the page`);
  for (const id of SECTIONS) ok(await pg.locator(`#info-${id}`).count() === 1, `${width}: anchor #info-${id} exists`);
  const toc = await pg.locator('.info-toc a').count(); ok(toc === SECTIONS.length, `${width}: the contents row lists every section (${toc})`);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: no sideways scroll`);
  ok(errs.length === 0, `${width}: no page errors${errs[0] ? ': ' + errs[0] : ''}`);
  /* a section opens from its address and says what moved there */
  const want = { pnl: /Total P&L[\s\S]*Realised[\s\S]*Unrealised[\s\S]*One R[\s\S]*T2[\s\S]*Awaiting entry[\s\S]*Exit verification[\s\S]*Snapshot id/, book: /How a trade is followed[\s\S]*The engine book/, markets: /Trend map[\s\S]*Sector heat[\s\S]*FII and DII flows[\s\S]*Provisional figures as published by NSE/, picks: /Ranked by each engine's own rank[\s\S]*signal close/, legal: /not investment advice[\s\S]*no order is ever placed[\s\S]*Privacy/, build: /Build\s+\S+/ };
  for (const [id, re] of Object.entries(want)) {
    await pg.goto(`${base}/#/info?s=${id}`); await pg.waitForSelector(`#info-${id}`); await pg.waitForTimeout(150);
    ok(await pg.locator(`#info-${id}`).evaluate((e) => e.open === true) && re.test(await pg.locator(`#info-${id}`).innerText()), `${width}: #/info?s=${id} opens its section with the moved text`);
  }
  await pg.goto(`${base}/#/info?s=data`); await pg.waitForSelector('#info-data'); ok(/Every data file, and how current it is/.test(await pg.locator('#info-data').innerText()), `${width}: the Data Health table is the Data status section`);
  await pg.goto(`${base}/#/info?s=method`); await pg.waitForSelector('#info-method'); ok(/Methodology|evidence/i.test(await pg.locator('#info-method').innerText()), `${width}: methodology is a section`);
  /* Menu links here */
  await pg.goto(`${base}/#/more`); await pg.waitForSelector('[data-more]');
  ok(await pg.locator('[data-more-row="info"][href="#/info"]').count() === 1, `${width}: the Menu links to About and data`);
  await pg.locator('[data-more-row="info"]').click(); await pg.waitForSelector('[data-info]'); ok(await pg.evaluate(() => location.hash) === '#/info', `${width}: the Menu row opens #/info`);
  /* Markets and Picks link to their sections */
  await pg.goto(`${base}/#/markets`); await pg.waitForSelector('.trendmap a[href="#/info?s=markets"]'); await pg.locator('.trendmap a[href="#/info?s=markets"]').click(); await pg.waitForSelector('#info-markets'); ok(await pg.locator('#info-markets').evaluate((e) => e.open), `${width}: Markets "About these numbers" opens the Markets section`);
  await pg.goto(`${base}/#/signals?v=picks`); await pg.waitForSelector('.pk-intro a[href="#/info?s=picks"]'); await pg.locator('.pk-intro a[href="#/info?s=picks"]').click(); await pg.waitForSelector('#info-picks'); ok(await pg.locator('#info-picks').evaluate((e) => e.open), `${width}: Picks "How to read these picks" opens its section`);
  await ctx.close();
}

/* the Book links here, and the id of the snapshot it drew is printed here, not in the Book */
for (const width of [390, 1265]) {
  const ctx = await openCtx(b, width, ledger); const pg = await ctx.newPage();
  await pg.goto(`${base}/#/signals?v=positions`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-strip]', { timeout: 20000 });
  const id = await pg.locator('[data-strip]').getAttribute('data-snapshot'); const strip = await pg.locator('[data-strip]').innerText();
  ok(!!id && !strip.includes(id), `${width}: the snapshot id is not printed in the Book's main view`);
  ok(await pg.locator('[data-total-note] a[href="#/info?s=pnl"]').count() === 1 && await pg.locator('[data-method] a[href="#/info?s=book"]').count() === 1, `${width}: the Book links to P&L definitions and to how the paper book works`);
  await pg.locator('[data-total-note] a').click(); await pg.waitForSelector('#info-pnl'); await pg.waitForTimeout(150);
  ok((await pg.locator('#info-pnl [data-snapshot-id]').innerText()).trim() === id, `${width}: #/info shows the same snapshot id the Book drew (${id})`);
  await ctx.close();
}
await b.close(); console.log(bad ? `info: ${bad} FAILED` : 'info: all passed'); process.exit(bad ? 1 : 0);
