// Beta gate: the first-use and decision journey end to end, the GCSL contradiction on screen, keyboard use, honest loading, stale and error states,
// backup round trip through the real UI, and lab Core Web Vitals. These are AUTOMATED checks. They are not user research.
// Usage: node apps/tripwire/tests/beta.mjs [baseUrl]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { STATE, mockApi, quoteOf } from './fixtures.mjs';
import { mockTick } from './tickmock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const mk = async (o = {}) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, ...o }); const T = await mockApi(ctx); return { ctx, T, pg: await ctx.newPage() }; };
const text = (pg) => pg.locator('body').innerText();
const saved = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1') ?? 'null'));

/* ---- 1. first use, then follow -> thesis -> plan -> review, with GCSL as the name ---- */
{
  const { ctx, pg } = await mk(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await pg.goto(base + '/'); await pg.waitForSelector('.welcome h1');
  const w = await text(pg);
  ok(!/Ten plain rules|Nifty 500 names/.test(w) && /two experimental ranking engines/.test(w), 'the welcome screen states what the product is, with no claim the data does not back');
  await pg.getByRole('button', { name: 'Explore as a guest' }).click(); await pg.waitForSelector('.journey');
  ok(/Your path · 0 of 4/i.test(await text(pg)) && /Follow a name/i.test(await pg.locator('.journey li.now').innerText()), 'Today starts a new user on step 1 of 4: follow a name');
  await pg.getByRole('button', { name: 'Find a name to follow' }).click(); await pg.waitForSelector('input.field[type=search]');
  await pg.getByLabel('Search companies').fill('GCSL'); await pg.waitForTimeout(250); await pg.locator('.li a[href="#/c/GCSL"]').first().click(); await pg.waitForSelector('.decision', { timeout: 15000 });
  const d = await pg.locator('.decision').innerText();
  for (const k of ['Why it surfaced', 'Strongest counterargument', 'Evidence status', 'Data quality', 'Invalidation', 'Next review']) ok(new RegExp(k, 'i').test(d), `the decision summary answers "${k}"`);
  ok(/Momentum picked it/.test(d) && /Rank \d+ of 100/.test(d) && /not a chance of winning/.test(d), 'a pick says which engine surfaced it and labels its number as a rank, not a probability');
  ok(/Experimental/i.test(d) && /Momentum: not supported/i.test(d), 'the pick\'s engine, its evidence state and an Experimental tag sit in the summary');
  ok(/financial sector/i.test(d) && /Size class not published|not published/i.test(d), 'data quality says what is not judged and that the size class is not published');
  const page = await text(pg);
  const caseBlock = await pg.locator('details.ev', { hasText: /^●\s*Case|Case \(/ }).first().innerText().catch(() => '');
  ok(!/capital employed|ROCE|Return on capital|operating margin|EBIT margin/i.test(caseBlock + (await pg.locator('details.ev', { hasText: 'Countercase' }).first().innerText())), 'GCSL: neither the case nor the countercase judges a figure that is withheld for a financial-sector company');
  ok(/Financial-sector company/.test(page) && /hidden for that reason/.test(page) && /Risk grade: not shown/.test(page), 'GCSL: the page says what was withheld and why, and does not print the risk grade as a finding');
  ok(!/A lender:/.test(page), 'GCSL is not called a lender');
  ok((await pg.locator('.decision .nextstep').innerText()).includes('Step 1 of 4'), 'the summary offers the next step of the journey');
  await pg.getByRole('button', { name: 'Follow GCSL' }).click(); await pg.waitForTimeout(300);
  ok((await saved(pg)).follows.includes('GCSL') && (await pg.locator('.decision .nextstep').innerText()).includes('Step 2 of 4'), 'step 1 done from saved state; the summary moves to step 2');
  await pg.getByRole('button', { name: 'Write a thesis' }).first().click(); await pg.waitForSelector('textarea#t-thesis');
  ok(/Without this you cannot tell a bad day from being wrong/.test(await text(pg)), 'a thesis without an invalidation is warned about');
  await pg.fill('#t-thesis', 'Momentum with a tiny base; revenue 13 to 66 crore in three years'); await pg.fill('#t-invalidation', 'Close below 675'); await pg.fill('#t-date', '2026-11-30');
  await pg.getByRole('button', { name: 'Save thesis' }).click(); await pg.waitForTimeout(400);
  ok((await saved(pg)).entries.length === 1 && /Step 3 of 4/.test(await pg.locator('.decision .nextstep').innerText()), 'step 2 done: the thesis is saved, with its invalidation and review date');
  ok(/close below ₹675\.37/i.test(await pg.locator('.decision').innerText()) || /Close below 675/.test(await pg.locator('.decision').innerText()), 'invalidation is shown in the summary');
  await pg.getByRole('button', { name: 'Size a plan' }).click(); await pg.waitForSelector('#pl-e');
  const sheet = await pg.locator('.sheet').innerText();
  ok(/Nobody buys at a past close/.test(sheet) && /NEXT open plus 0\.1% slippage/.test(sheet) && /Experimental engine/.test(sheet), 'the planner states its entry-price assumption and that the name is an experiment\'s pick');
  await pg.fill('#pl-x', '675.37'); await pg.waitForTimeout(250);
  ok(/If it opens 2% higher/.test(await pg.locator('.sheet').innerText()), 'the planner shows what a higher open does to the planned risk');
  await pg.getByRole('button', { name: 'Save plan' }).click(); await pg.waitForTimeout(500);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('.moodhero');
  ok((await pg.locator('.journey').count()) === 0, 'all four steps done: the path card is gone from Today');
  ok(errs.length === 0, 'no script errors through the whole journey' + (errs.length ? ': ' + errs[0] : '')); await ctx.close();
}

/* ---- 2. backup round trip through the real screens ---- */
{
  const { ctx, pg } = await mk(); await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('tripwire:v1', JSON.stringify(s)); } }, STATE);
  await pg.goto(base + '/#/profile'); await pg.waitForSelector('text=Export all (JSON)');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: 'Export all (JSON)' }).click()]); const path = '/tmp/tw-backup.json'; await dl.saveAs(path);
  const exported = JSON.parse(readFileSync(path, 'utf8')); ok(exported.entries[0].versions.length >= 1 && exported.follows.includes('GCSL') && exported.app === 'tripwire', 'the export holds the journal, follows and paper trades');
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForSelector('.welcome');
  await pg.getByRole('button', { name: 'Explore as a guest' }).click(); await pg.goto(base + '/#/profile'); await pg.waitForSelector('text=Import backup');
  await pg.locator('input[type=file]').setInputFiles(path); await pg.waitForTimeout(500);
  const back = await saved(pg); ok(JSON.stringify(back.entries) === JSON.stringify(STATE.entries) && JSON.stringify(back.paper) === JSON.stringify(STATE.paper) && back.follows.length === 2, 'import on a new device restores the journal, trades and follows exactly');
  await pg.setInputFiles('input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"v":99}') }); await pg.waitForTimeout(400);
  ok(/Not a Tripwire backup\. Nothing was changed\./.test(await text(pg)) && (await saved(pg)).entries.length === 1, 'a file that is not ours is refused and nothing changes');
  await pg.evaluate(() => localStorage.setItem('tripwire:v1', '{"v":7,corrupt')); await pg.reload(); await pg.waitForTimeout(800);
  ok(/could not be read/.test(await text(pg)) && (await pg.evaluate(() => localStorage.getItem('tripwire:v1:unreadable'))) === '{"v":7,corrupt', 'unreadable saved data is flagged and a copy is kept before anything is written over it'); await ctx.close();
}

/* ---- 3. keyboard, focus and the chart ---- */
{
  const { ctx, pg } = await mk({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE);
  await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('.chart-plot'); await pg.waitForTimeout(800);
  await pg.keyboard.press('Tab'); const first = await pg.evaluate(() => document.activeElement?.textContent?.trim());
  ok(/Skip to Today/.test(first ?? ''), 'the first Tab stop is the skip link');
  await pg.locator('.chart-plot').focus(); const before = await pg.locator('.chart-plot').getAttribute('aria-valuetext');
  await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft'); const after = await pg.locator('.chart-plot').getAttribute('aria-valuetext');
  ok(before !== after && /₹|\d/.test(after ?? ''), 'the chart can be read with the arrow keys, and says what each position is');
  ok((await pg.locator('details', { hasText: 'The same chart as a table' }).count()) === 1, 'the chart has a table alternative');
  const ring = await pg.evaluate(() => { const e = document.querySelector('.chart-plot'); const c = getComputedStyle(e); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2; });
  ok(ring, 'a focused control shows a visible 2px focus ring');
  await pg.keyboard.press('Control+k'); await pg.waitForSelector('.sheet'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
  ok((await pg.locator('.sheet').count()) === 0, 'search opens from the keyboard and Escape closes it'); await ctx.close();
}

/* ---- 4. loading says nothing factual; slow and failing services say so ---- */
{
  const { ctx, pg } = await mk(); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE);
  await ctx.route('**/data/research/engines_backtest.json', async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.continue(); });
  await ctx.route('**/api/ledger*', async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' }); });
  await pg.goto(base + '/#/signals'); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(500);
  const t0 = await text(pg);
  ok(!/has not been published|None of the engines|Not yet tested|has not started/i.test(t0), 'while the study loads, no claim about it is made');
  ok((await pg.locator('.sk').count()) >= 1, 'a neutral skeleton stands in for what is loading');
  await pg.goto(base + '/#/signals?v=auto'); await pg.waitForTimeout(500);
  ok(!/has not started|No position yet/i.test(await text(pg)), 'the automatic book does not say "not started" while the record is loading'); await ctx.close();
}
{
  const { ctx, pg, T } = await mk(); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE);
  // the session is on by the Indian clock (Mon 26 Oct 2026, 14:32 IST), and every print is 40 minutes old: the age comes from the print, not from the refresh
  const NOW = new Date('2026-10-26T09:02:00Z'); await ctx.clock.install({ time: NOW });
  const old = (prev, px) => ({ ...quoteOf(prev, px), pt: Math.floor(NOW.getTime() / 1000) - 40 * 60, live: true });
  T.pulse = { NIFTY: old(22600, 22700), BANKNIFTY: old(54000, 54100), VIX: old(16, 16.2) };
  await pg.goto(base + '/#/today'); await pg.waitForSelector('.moodhero'); await pg.clock.runFor(20000); await pg.waitForTimeout(300);
  const t = await text(pg);
  ok(/No print since 13:\d\d IST/.test(t) && /holiday, or the price source is quiet/.test(t), 'a 40-minute-old print in a live session is called stale, with its own time, even though the app refreshed');
  ok(!(await pg.locator('.moodhero .livebadge.on').count()), 'no LIVE badge on a stale print');
  T.pulse = { NIFTY: { ...quoteOf(22600, 22700), pt: Math.floor(NOW.getTime() / 1000) - 20, live: true }, BANKNIFTY: old(54000, 54100), VIX: old(16, 16.2) };
  await pg.clock.runFor(20000); await pg.waitForTimeout(400);
  ok(/\d\d:\d\d IST · \d+ s old/.test(await text(pg)) || /IST · \d+ min old/.test(await text(pg)), 'a fresh print shows its time and its age'); await ctx.close();
}
{
  const { ctx, pg } = await mk(); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('.moodhero'); await pg.waitForTimeout(1200);
  await ctx.route('**/api/tick*', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' })); await pg.waitForTimeout(100);
  await ctx.setOffline(true); await pg.reload().catch(() => {}); await pg.waitForTimeout(1500);
  ok(/Offline/.test(await text(pg)) && (await pg.locator('.moodhero').count()) === 1, 'offline: the saved copy still opens and says it is offline'); await ctx.close();
}

/* ---- 5. layout at five widths, and the desktop workspace ---- */
for (const [w, h] of [[360, 740], [390, 844], [430, 932], [768, 1024], [1440, 900]]) {
  const { ctx, pg } = await mk({ viewport: { width: w, height: h } }); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE);
  let bad = [];
  for (const r of ['/#/today', '/#/discover', '/#/c/GCSL', '/#/signals', '/#/data']) { await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(900); const o = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 1) bad.push(`${r} ${o}px`); }
  ok(bad.length === 0, `${w}px: no sideways scroll on Today, Discover, a company, Signals and Data${bad.length ? ' (' + bad.join(', ') + ')' : ''}`);
  if (w === 1440) {
    await pg.goto(base + '/#/today'); await pg.waitForSelector('.split'); await pg.waitForTimeout(800);
    const cols = await pg.evaluate(() => [...document.querySelectorAll('.split > .col')].map((c) => Math.round(c.getBoundingClientRect().width)));
    ok(cols.length === 2 && cols[0] > cols[1] && cols[1] >= 340, `1440px: Today is a two-column workspace (${cols.join(' + ')} px)`);
    await pg.goto(base + '/#/discover'); await pg.waitForSelector('.lens'); const lensW = await pg.locator('.lens').evaluateAll((e) => e.map((x) => Math.round(x.getBoundingClientRect().width)));
    ok(lensW.length === 5 && lensW.every((x) => x > 150) && (await pg.locator('.li .wide').first().isVisible()), '1440px: Discover shows its five lenses side by side and a figure table on each row');
  }
  await ctx.close();
}

/* ---- 6. lab Core Web Vitals on a throttled phone ---- */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE); await mockApi(ctx);
  const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await pg.addInitScript(() => { window.__v = { lcp: 0, cls: 0, inp: 0 }; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.inp = Math.max(window.__v.inp, e.duration); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); });
  await pg.goto(base + '/#/today', { waitUntil: 'load' }); await pg.waitForSelector('.moodhero'); await pg.waitForTimeout(4000);
  for (const sel of ['nav.tabs a[href="#/discover"]', '.lens', 'nav.tabs a[href="#/today"]']) { await pg.locator(sel).first().click(); await pg.waitForTimeout(600); }
  const v = await pg.evaluate(() => window.__v); const size = await pg.evaluate(() => performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0));
  console.log(`VITALS (lab, 4x CPU slowdown, 1.6 Mbit/s, 150 ms RTT): LCP ${Math.round(v.lcp)} ms, CLS ${v.cls.toFixed(3)}, slowest interaction ${Math.round(v.inp)} ms, transferred ${(size / 1024).toFixed(0)} kB`);
  mkdirSync('/tmp/tw', { recursive: true }); writeFileSync('/tmp/tw/vitals.json', JSON.stringify({ lcp: Math.round(v.lcp), cls: +v.cls.toFixed(3), inp: Math.round(v.inp), kB: Math.round(size / 1024) }));
  ok(v.lcp < 4000, `LCP ${Math.round(v.lcp)} ms is under 4 s on a throttled phone (good is 2.5 s)`); ok(v.cls < 0.1, `CLS ${v.cls.toFixed(3)} is under 0.1`); ok(v.inp < 200, `slowest interaction ${Math.round(v.inp)} ms is under 200 ms (good)`);
  await ctx.close();
}
await b.close(); console.log(fails ? `\nbeta: ${fails} failed` : '\nbeta: all passed'); process.exit(fails ? 1 : 0);
