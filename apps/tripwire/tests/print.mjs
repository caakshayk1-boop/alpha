// Print, in a real browser: the Company report (thesis present and absent, the principal chart with its takeaway and basis, the compact first/last/high/low table, material risks, dated facts and
// sources, an explicit Missing evidence section), and the print layout of everything else (disclosures open, the app's navigation gone, one page width and nothing clipped, no split cards).
// Uses Playwright's print-media emulation and page.pdf(); also writes a sample PDF and PNG of a printed Company report to docs/tripwire/beta/print/. AUTOMATED checks in Chromium; a physical printer
// and other browsers' print engines are NOT tested here.
// Usage: node apps/tripwire/tests/print.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const OUT = fileURLToPath(new URL('../../../docs/tripwire/beta/print/', import.meta.url)); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
// A4 at 96 dpi is 794 px wide; the @page margin is 12 mm (about 45 px) each side, so the printable column is about 704 px.
const PAGE_W = 704;

// a price history with a Nifty line and volume, so the report's chart is the stock-against-Nifty view the Company page starts in
const richChart = () => { const t = [], c = [], n = [], v = []; let d = Date.UTC(2023, 0, 2, 4) / 1000, px = 100, nx = 100; for (let i = 0; i < 900; i++) { d += 86400; px *= 1 + 0.0006 + Math.sin(i / 17) * 0.011; nx *= 1 + 0.0004 + Math.sin(i / 23) * 0.006; t.push(d); c.push(+px.toFixed(2)); n.push(+(nx * 200).toFixed(2)); v.push(1e6 + (i % 50) * 1e4); } return JSON.stringify({ ok: true, sym: 'TCS', t, c, n, v }); };
async function mk(w, state, o = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch { /* none */ } }, state);
  await mockApi(ctx);
  if (o.rich) await ctx.route('**/api/chart*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: richChart() }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  return { ctx, pg, errs };
}
const settled = (pg) => pg.waitForFunction(() => !document.querySelector('.routewait') && !document.querySelector('[aria-busy=true]'), null, { timeout: 20000 }).catch(() => {});
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const rgb = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b2) => { const [x, y] = [lum(a), lum(b2)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const NOENTRY = { ...STATE, entries: [] };

/* ---- 1. the Company report with a saved thesis ---- */
{ const { ctx, pg, errs } = await mk(PAGE_W, STATE, { rich: true });
  await pg.goto(base + '/#/report/TCS'); await pg.waitForSelector('[data-rp="chart"] svg', { timeout: 20000 }); await pg.waitForSelector('[data-missing]'); await settled(pg);
  // on screen first: the report is the app's own dark page, and the disclosures are as the person left them
  const closedBefore = await pg.locator('details:not([open])').count();
  ok(closedBefore > 0, `on screen some disclosures are closed (${closedBefore}), as the person left them`);
  ok(await pg.locator('.tabs').isVisible(), 'on screen the navigation is there');
  ok(await pg.locator('a[data-print-report], button[aria-label="Print or save as PDF"]').first().isVisible(), 'there is a Print action on the report');

  await pg.emulateMedia({ media: 'print' }); await pg.waitForTimeout(400);
  // ---- print layout ----
  const vis = (sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].some((e) => getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0), sel);
  ok(!(await vis('.tabs')) && !(await vis('.statusbar')) && !(await vis('.fab-row')) && !(await vis('.banner')) && !(await vis('.sheet')) && !(await vis('.noprint')), 'print: the tab bar, status bar, action bar, banners and sheets do not print');
  const bg = rgb(await pg.evaluate(() => getComputedStyle(document.body).backgroundColor)); ok(bg.every((v) => v === 255), `print: the page background is white (${bg})`);
  const ink = rgb(await pg.evaluate(() => getComputedStyle(document.querySelector('.cf-lead')).color)); ok(contrast(ink, [255, 255, 255]) >= 12, `print: body ink on white contrast ${contrast(ink, [255, 255, 255]).toFixed(1)} (needs 12 or more)`);
  const mute = rgb(await pg.evaluate(() => getComputedStyle(document.querySelector('.cf-basis')).color)); ok(contrast(mute, [255, 255, 255]) >= 7, `print: the basis line on white contrast ${contrast(mute, [255, 255, 255]).toFixed(1)} (needs 7 or more)`);
  const stroke = rgb(await pg.evaluate(() => getComputedStyle(document.querySelector('[data-rp="chart"] svg path.c-line')).stroke)); ok(contrast(stroke, [255, 255, 255]) >= 7, `print: the stock line is a dark paper colour (${stroke}, contrast ${contrast(stroke, [255, 255, 255]).toFixed(1)})`);
  const dashes = await pg.evaluate(() => [...document.querySelectorAll('[data-rp="chart"] svg path.c-line')].map((p) => ({ d: getComputedStyle(p).strokeDasharray, w: getComputedStyle(p).strokeWidth })));
  ok(dashes.length === 2 && dashes.filter((x) => x.d.includes(',')).length === 1, `print: the two lines differ by dash, not only by colour (one is a dash pattern: ${JSON.stringify(dashes.map((x) => x.d))})`);
  ok((await pg.locator('[data-rp="chart"] .cf-legend svg.cf-sw').count()) === 2, 'print: the legend carries a line-and-marker sample for each series');
  const lim = await pg.evaluate(() => { const bad = []; for (const e of document.querySelectorAll('.rp *')) { const r = e.getBoundingClientRect(); if (r.width && r.right > document.documentElement.clientWidth + 1) bad.push(`${e.tagName}.${e.className}`.slice(0, 40)); } return bad.slice(0, 5); });
  ok((await over(pg)) <= 1 && lim.length === 0, `print: one page width, nothing clipped at ${PAGE_W}px (overflow ${await over(pg)}, offenders ${lim.join(',') || 'none'})`);
  // ---- disclosures print open ----
  const shut = await pg.evaluate(() => [...document.querySelectorAll('details:not([data-print-closed])')].filter((d) => !d.open).length);
  ok(shut === 0, `print: every disclosure is open (${shut} still closed)`);
  const about = pg.locator('[data-rp="chart"] details:has(> summary:text-is("About this chart▾")), [data-rp="chart"] details:has(summary:has-text("About this chart"))').first();
  ok(await about.locator('.body').isVisible(), 'print: "About this chart" shows its text');
  const keptClosed = await pg.evaluate(() => { const d = document.querySelector('details.cf-tbl'); return d ? { open: d.open, vis: !!d.querySelector('.body')?.getClientRects().length } : null; });
  ok(keptClosed && !keptClosed.open && !keptClosed.vis, 'print: the long table alternative stays collapsed (the compact table stands in for it)');
  // ---- sections ----
  const text = (await pg.locator('.rp').innerText()).replace(/\s+/g, ' ');
  for (const k of ['head', 'thesis', 'chart', 'figures', 'risks', 'facts', 'missing', 'source']) ok((await pg.locator(`[data-rp="${k}"]`).count()) === 1, `report: section "${k}" is present`);
  ok(/Tata Consultancy/i.test(text) && /\(TCS\)/.test(text), 'report: company name and symbol');
  ok(/Printed/.test(text) && /Data through/.test(text), 'report: print date and data-through date');
  const ist = new Date(Date.now() + 330 * 60000); ok(text.includes(String(ist.getUTCFullYear())) && /Printed [A-Za-z]{3}/.test(text), 'report: the print date is today in India');
  ok(/Not investment advice|not investment advice/.test(text) && /Paper research only/.test(text), 'report: paper-only, not-advice line');
  ok(/Seed thesis/.test(text) && /Close below 2,400/.test(text) && /Invalidation/.test(text), 'report: the saved thesis and its invalidation are printed');
  ok((await pg.locator('[data-rp-empty="thesis"]').count()) === 0, 'report: with a thesis there is no "No thesis recorded" note');
  ok((await pg.locator('[data-rp="chart"] [data-takeaway]').count()) >= 1 && (await pg.locator('[data-rp="chart"] .cf-basis').count()) === 1, 'report: the chart frame prints its takeaway and its basis line');
  ok(/dividends/i.test(await pg.locator('[data-rp="chart"] .cf-basis').innerText()), 'report: the basis line states the dividend treatment');
  const kp = await pg.locator('[data-keypoints] tbody tr').allInnerTexts(); ok(kp.length === 4 && /First close/.test(kp[0]) && /Last close/.test(kp[1]) && /Highest/.test(kp[2]) && /Lowest/.test(kp[3]), `report: compact first / last / high / low table (${kp.length} rows)`);
  ok(!(await pg.locator('[data-rp="chart"] .c-prim').count()) && !(await pg.locator('[data-rp="chart"] button').count()), 'report: the chart has no controls on paper');
  ok(/Screen flag level/.test(text) || /did not grade/.test(text), 'report: material risks begins with the screen flag level sentence');
  ok(/No screen flag was raised\. That is not a finding that there are no risks/.test(text) || (await pg.locator('[data-rp="risks"] ul.rp-list li').count()) > 0, 'report: risks list the flags, or say a clean screen is not a clean bill (NO_FLAGS_SENTENCE)');
  ok(/Scope: this counts the warning flags/.test(text), 'report: the risk grade states what it measures (scope line)');
  ok(await pg.locator('[data-rp="facts"] tbody tr').count() >= 3 && /Yahoo Finance|Alpha screen/.test(text), 'report: dated facts each carry a source');
  const miss = await pg.locator('[data-missing] li').allInnerTexts(); ok(miss.length >= 3 && miss.some((m) => /^Event annotations/.test(m)) && miss.some((m) => /^Valuation history/.test(m)), `report: Missing evidence lists what is absent (${miss.length} items)`);
  ok(!miss.some((m) => /^Nifty 50 comparison/.test(m)), 'report: a Nifty line is held in this run, so it is NOT listed as missing');
  ok(!/\bsecret|api[_ -]?key|token\b/i.test(text), 'report: no secrets');
  // ---- no split cards ----
  const bi = await pg.evaluate(() => ({ card: getComputedStyle(document.querySelector('.rp .card')).breakInside, cf: getComputedStyle(document.querySelector('.cf')).breakInside, h: getComputedStyle(document.querySelector('.rp-h')).breakAfter }));
  ok(bi.card === 'avoid' && bi.cf === 'avoid' && bi.h === 'avoid', `print: cards and the chart are not split across pages, headings stay with what follows (${JSON.stringify(bi)})`);
  // ---- the PDF and the picture ----
  const pdf = await pg.pdf({ preferCSSPageSize: true, printBackground: false }); writeFileSync(OUT + 'company-report-TCS.pdf', pdf);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  ok(pdf.subarray(0, 4).toString() === '%PDF' && pdf.length > 20000, `pdf: a PDF was produced (${(pdf.length / 1024).toFixed(0)} kB)`);
  ok(pages >= 1 && pages <= 4, `pdf: ${pages} A4 page(s) (1 to 4 expected)`);
  await pg.screenshot({ path: OUT + 'company-report-TCS.png', fullPage: true });
  // ---- back to screen: what the print opened is closed again ----
  await pg.emulateMedia({ media: 'screen' }); await pg.waitForTimeout(300);
  const closedAfter = await pg.locator('details:not([open])').count(); ok(closedAfter === closedBefore, `screen again: the disclosures print opened are closed again (${closedAfter} of ${closedBefore})`);
  ok(await pg.locator('.tabs').isVisible(), 'screen again: the navigation is back');
  ok(errs.length === 0, `no page errors (${errs.join('; ')})`); await ctx.close(); }

/* ---- 2. no thesis, no Nifty line, no volume: the absences are stated ---- */
{ const { ctx, pg, errs } = await mk(PAGE_W, NOENTRY);
  await pg.goto(base + '/#/report/GCSL'); await pg.waitForSelector('[data-rp="chart"] svg', { timeout: 20000 }); await pg.waitForSelector('[data-missing]'); await settled(pg); await pg.emulateMedia({ media: 'print' }); await pg.waitForTimeout(300);
  ok((await pg.locator('[data-rp-empty="thesis"]').innerText()).startsWith('No thesis recorded.'), 'no thesis: the block is replaced by the one-line "No thesis recorded" note');
  ok((await pg.locator('[data-rp-field]').count()) === 0, 'no thesis: no thesis or invalidation line is printed');
  const miss = await pg.locator('[data-missing] li').allInnerTexts();
  ok(miss.some((m) => /^Your reasoning/.test(m)), 'no thesis: it is listed under Missing evidence');
  ok(miss.some((m) => /^Nifty 50 comparison/.test(m)) && miss.some((m) => /^Volume/.test(m)), `absent Nifty line and volume are listed (${miss.map((m) => m.split('.')[0]).join(' | ')})`);
  ok((await over(pg)) <= 1, 'no thesis: no horizontal overflow'); ok(errs.length === 0, 'no page errors'); await ctx.close(); }

/* ---- 3. the rest of the app prints sensibly ---- */
const PAGES = ['#/c/TCS', '#/methodology', '#/help', '#/data', '#/today', '#/discover', '#/compare?s=TCS,GCSL', '#/signals', '#/settings'];
for (const route of PAGES) {
  const { ctx, pg, errs } = await mk(PAGE_W, STATE, { rich: true });
  await pg.goto(base + '/' + route); await pg.waitForFunction(() => !document.querySelector('.routewait') && document.querySelector('main h1, main h2'), null, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(1200); await settled(pg);
  const before = await pg.locator('details:not([open])').count();
  await pg.emulateMedia({ media: 'print' }); await pg.waitForTimeout(400);
  const r = await pg.evaluate(() => ({
    shut: [...document.querySelectorAll('details:not([data-print-closed])')].filter((d) => !d.open).length,
    total: document.querySelectorAll('details').length,
    nav: [...document.querySelectorAll('.tabs, .fab-row, .statusbar, .sheet, .scrim, .banner')].filter((e) => getComputedStyle(e).display !== 'none').length,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    wide: [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5 || e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0).slice(-4).map((e) => e.tagName + '.' + String(e.className).slice(0, 30) + ' r' + Math.round(e.getBoundingClientRect().right) + ' sw' + e.scrollWidth + '/' + e.clientWidth).join(' '),
    bg: getComputedStyle(document.body).backgroundColor,
    sticky: [...document.querySelectorAll('main *')].filter((e) => (getComputedStyle(e).position === 'sticky' || getComputedStyle(e).position === 'fixed') && e.getClientRects().length > 0).length,
    cardSplit: [...document.querySelectorAll('.card, .cf')].filter((e) => getComputedStyle(e).breakInside !== 'avoid').length,
    hidden: [...document.querySelectorAll('details[open] > :not(summary)')].filter((e) => getComputedStyle(e).display === 'none' && !e.closest('[data-print-closed]')).length,
  }));
  ok(r.shut === 0, `${route}: every disclosure is open in print (${r.total} on the page, ${before} were closed on screen)`);
  ok(r.nav === 0, `${route}: tab bar, action bar, status bar, sheets and banners are hidden`);
  ok(r.over <= 1, `${route}: no horizontal clipping at the A4 column (${r.over}px ${r.over > 1 ? r.wide : ''})`);
  ok(r.bg === 'rgb(255, 255, 255)', `${route}: white paper`);
  ok(r.sticky === 0, `${route}: nothing is sticky or fixed on paper (${r.sticky})`);
  ok(r.cardSplit === 0, `${route}: no card or chart may split across pages (${r.cardSplit} may)`);
  ok(r.hidden === 0, `${route}: no open disclosure keeps hidden content (${r.hidden})`);
  const pdf = await pg.pdf({ preferCSSPageSize: true }); ok(pdf.subarray(0, 4).toString() === '%PDF' && pdf.length > 5000, `${route}: prints to a PDF (${(pdf.length / 1024).toFixed(0)} kB)`);
  await pg.emulateMedia({ media: 'screen' }); await pg.waitForTimeout(300);
  ok((await pg.locator('details:not([open])').count()) === before, `${route}: back on screen the disclosures are as they were (${before} closed)`);
  ok(errs.length === 0, `${route}: no page errors (${errs.join('; ')})`); await ctx.close();
}

/* ---- 4. a disclosure the person opened stays open ---- */
{ const { ctx, pg } = await mk(PAGE_W, STATE, { rich: true });
  await pg.goto(base + '/#/methodology'); await pg.waitForSelector('details.fold'); await pg.waitForTimeout(800);
  const id = await pg.locator('details.fold:not([open])').first().getAttribute('data-fold'); await pg.locator(`details[data-fold="${id}"] > summary`).click();
  await pg.emulateMedia({ media: 'print' }); await pg.waitForTimeout(300); await pg.emulateMedia({ media: 'screen' }); await pg.waitForTimeout(300);
  ok(await pg.locator(`details[data-fold="${id}"]`).evaluate((d) => d.open), `a disclosure the person opened (${id}) is still open after printing`);
  ok((await pg.locator('details[data-print-opened]').count()) === 0, 'no print marker is left behind'); await ctx.close(); }

/* ---- 5. the helper source: the same words the page prints, no colours of its own ---- */
{ const css = readFileSync(fileURLToPath(new URL('../src/print.css', import.meta.url)), 'utf8'); ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'print.css: tokens only, no hex colour'); }

await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nall print checks passed'); process.exit(fails ? 1 : 0);
