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
const text = async (pg) => { await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); return pg.locator('body').innerText(); };
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
  ok(await pg.locator('.decision').filter({ hasText: /close below (₹)?\d/i }).waitFor({ timeout: 8000 }).then(() => true, () => false), 'invalidation is shown in the summary');
  await pg.getByRole('button', { name: 'Size a plan' }).click(); await pg.waitForSelector('#pl-e');
  const sheet = await pg.locator('.sheet').innerText();
  ok(/Nobody buys at a past close/.test(sheet) && /NEXT open plus 0\.1% slippage/.test(sheet) && /Experimental engine/.test(sheet), 'the planner states its entry-price assumption and that the name is an experiment\'s pick');
  await pg.fill('#pl-x', '675.37'); await pg.waitForTimeout(250);
  ok(/If it opens 2% higher/.test(await pg.locator('.sheet').innerText()), 'the planner shows what a higher open does to the planned risk');
  await pg.getByRole('button', { name: 'Save plan' }).click(); await pg.waitForTimeout(500);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('.moodhero');
  ok((await pg.locator('.journey').count()) === 0, 'all four steps done: the path card is gone from Today');
  ok(errs.length === 0, 'no script errors through the whole journey' + (errs.length ? ': ' + errs[0] : ''));
  // closing the browser and opening it again: the saved state travels in the profile, and the journal, follow and plan are still there
  const profile = await ctx.storageState(); await ctx.close();
  const again = await mk({ storageState: profile }); await again.pg.goto(base + '/#/desk'); await again.pg.waitForSelector('nav.tabs', { timeout: 15000 }); await again.pg.waitForTimeout(600);
  const st = await saved(again.pg);
  ok(st && st.follows.includes('GCSL') && st.entries.length === 1 && st.entries[0].versions[0].invalidation === 'Close below 675' && st.plans.length >= 1, 'after closing and reopening the browser the follow, the thesis with its invalidation and the plan are all still there');
  ok(/GCSL/.test(await text(again.pg)), 'and the Desk lists the followed name'); await again.pg.getByRole('tab', { name: 'Journal' }).or(again.pg.getByRole('button', { name: 'Journal' })).first().click(); await again.pg.waitForTimeout(400);
  ok(/Close below 675/.test(await text(again.pg)) && /Momentum with a tiny base/.test(await text(again.pg)), 'and the Journal shows the thesis and what would make it wrong');
  await again.ctx.close();
}

/* ---- 1b. a browser that will not keep data says so, before a person writes anything that vanishes ---- */
{
  const { ctx, pg } = await mk(); await ctx.addInitScript((s) => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; void s; }, 0);
  await pg.goto(base + '/'); await pg.waitForSelector('.welcome h1', { timeout: 15000 }); await pg.getByRole('button', { name: /Explore as a guest/ }).click(); await pg.waitForTimeout(800);
  const banner = await pg.locator('.banner[role=alert]').innerText().catch(() => '');
  ok(/not keeping Tripwire's data/.test(banner), 'when storage refuses to write, a banner says the data is not being kept: ' + banner.slice(0, 70)); await ctx.close();
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
  const { ctx, pg } = await mk({ serviceWorkers: 'block' }); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE);   // no service worker: it would answer the data requests itself, past the delay set below
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
  // the exchange is shut (Saturday 13:30 IST): after the first load the app asks for no prices and no trend map, however long the page stays open, and it says "closed"
  const { ctx, pg, T } = await mk(); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE);
  await ctx.clock.install({ time: new Date('2026-10-24T08:00:00Z') });
  const fri = Math.floor(new Date('2026-10-23T09:59:00Z').getTime() / 1000); const shut = (prev, px) => ({ ...quoteOf(prev, px), pt: fri, live: false });   // Friday's last print
  T.pulse = { NIFTY: shut(22600, 22700), BANKNIFTY: shut(54000, 54100), VIX: shut(16, 16.2) };
  await ctx.route('**/api/bars*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"fetched_at":"x","bars":{},"missing":[]}' }));
  const seen = []; pg.on('request', (r) => { const u = r.url(); if (/\/api\/(tick|breadth|bars)/.test(u)) seen.push(u); });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('.moodhero'); await pg.clock.runFor(5000); await pg.waitForTimeout(600);
  const t0 = await text(pg); await pg.clock.runFor(2 * 60 * 1000); await pg.waitForTimeout(300); const n0 = seen.length;   // the first load may fetch names that mount a moment later (the paper book); that is the one fetch each name gets
  ok(/Market closed/i.test(t0) && /NSE\s*CLOSED/i.test(t0.replace(/\s+/g, ' ')), 'Saturday: the page says the market is closed (header strip and mood card)');
  await pg.clock.runFor(10 * 60 * 1000); await pg.waitForTimeout(400);
  const fresh = seen.slice(n0).filter((u) => !/[?&]m=1/.test(u) || /[?&](i=1|s=[^&])/.test(u));
  ok(fresh.length === 0, `Saturday: ten minutes open, no price, pulse, bars or trend-map request after the first load (${fresh.length} made${fresh.length ? ': ' + fresh[0].slice(0, 90) : ''})`);
  await ctx.close();
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
const runs = [];   // a lab sample on a shared machine moves by tens of milliseconds, so the verdict is the median of three loads
for (let rep = 0; rep < 3; rep++) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE); await mockApi(ctx);
  const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await pg.addInitScript(() => { window.__v = { lcp: 0, cls: 0, inp: 0, src: [] }; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__v.cls += e.value; window.__v.src.push(`${e.value.toFixed(3)}@${Math.round(e.startTime)}ms ${(e.sources || []).map((x) => (x.node?.nodeName ?? '') + '.' + (x.node?.className ?? '')).join(' | ')}`); } }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > window.__v.inp) { window.__v.inp = e.duration; window.__v.what = `${e.name} on ${e.target?.nodeName ?? ''}.${e.target?.className ?? ''} ${e.target?.getAttribute?.('href') ?? ''}`; } }).observe({ type: 'event', durationThreshold: 16, buffered: true }); });
  await pg.goto(base + '/#/today', { waitUntil: 'load' }); await pg.waitForSelector('.moodhero'); await pg.waitForTimeout(4000);
  for (const sel of ['nav.tabs a[href="#/discover"]', '.lens', 'nav.tabs a[href="#/today"]']) { await pg.locator(sel).first().click(); await pg.waitForTimeout(600); }
  const v = await pg.evaluate(() => window.__v); const size = await pg.evaluate(() => performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0));
  console.log(`VITALS (lab, 4x CPU slowdown, 1.6 Mbit/s, 150 ms RTT): LCP ${Math.round(v.lcp)} ms, CLS ${v.cls.toFixed(3)}, slowest interaction ${Math.round(v.inp)} ms (${v.what ?? 'none'}), transferred ${(size / 1024).toFixed(0)} kB`); if (v.cls >= 0.05) console.log('  shifts: ' + v.src.join(' ; '));
  mkdirSync('/tmp/tw', { recursive: true }); writeFileSync('/tmp/tw/vitals.json', JSON.stringify({ lcp: Math.round(v.lcp), cls: +v.cls.toFixed(3), inp: Math.round(v.inp), kB: Math.round(size / 1024) }));
  runs.push(v);
  await ctx.close();
}
const med = (k) => runs.map((r) => r[k]).sort((x, y) => x - y)[1];
ok(med('lcp') < 4000, `LCP ${Math.round(med('lcp'))} ms (median of 3) is under 4 s on a throttled phone (good is 2.5 s)`); ok(med('cls') < 0.1, `CLS ${med('cls').toFixed(3)} is under 0.1`); ok(med('inp') < 200, `slowest interaction ${Math.round(med('inp'))} ms (median of 3) is under 200 ms (good)`);
await b.close(); console.log(fails ? `\nbeta: ${fails} failed` : '\nbeta: all passed'); process.exit(fails ? 1 : 0);
