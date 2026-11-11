// The screens work in a real browser: Today's hero, gate card and hidden capture slot (no network), Discover's result cards on a phone and the refined table on a desktop,
// the reading column of Methodology and Help, the Data freshness pills, the Company header, and no horizontal overflow from 360 px. AUTOMATED checks.
// Usage: node apps/tripwire/tests/screens.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const mk = async (w, h = 800) => { const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, STATE);
  await mockApi(ctx); const pg = await ctx.newPage(); const reqs = []; pg.on('request', (r) => reqs.push(r.url())); return { ctx, pg, reqs }; };
const go = async (pg, route, sel) => { await pg.goto(base + route); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForSelector(sel, { timeout: 15000 }); await pg.waitForTimeout(500); };
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* ---- Signals: the market checks behind the gate are listed with their figures ---- */
{ const { ctx, pg } = await mk(390); await go(pg, '/#/signals?v=picks', 'details.signal-method summary'); /* 11 Nov 2026: the Book opens on Positions; the legacy context sits under Picks */ await pg.locator('details.signal-method summary', { hasText: 'Legacy market context' }).click(); await pg.waitForSelector('[data-gate-panel]', { state: 'visible', timeout: 5000 });   // the legacy market checks sit in their own section, apart from the model votes
  const rows = await pg.locator('[data-gate-panel] .gp-list li').count(); const txt = await pg.locator('[data-gate-panel]').innerText();
  ok(rows >= 3 && /market checks pass/.test(txt) && /statistical validation are separate/.test(txt), `Signals: the gate panel lists ${rows} market checks and says statistical validation is separate from them`);
  ok((await pg.locator('[data-gate-panel] .gp-list li .gp-val').count()) >= 1, 'each check shows the figures it was judged on'); await ctx.close(); }

/* ---- Today: hero, gate, capture off ---- */
{ const { ctx, pg, reqs } = await mk(390); await go(pg, '/#/today', '[data-sec="brief"]');
  await pg.waitForSelector('.ds-gate'); const gt = await pg.locator('.ds-gate').first().innerText(); const ga = await pg.locator('.ds-gate').first().getAttribute('aria-label');
  ok(await pg.locator('.research-status, .ds-gatecard').count() === 0 && (await pg.locator('.ds-gate').count()) === 1, 'Today: the gate is stated once, by the top-bar pill (no second row repeating it)');
  ok(/^Market (supportive|cautious)$/.test(gt.trim()) && /\d of \d legacy market checks pass/.test(ga) && /not a model-vote count/.test(ga) && !/validat/i.test(gt + ga), `the pill says what the gate is (a market filter for new setups), not "unvalidated": "${gt.trim()}" / "${ga.slice(0, 70)}"`);
  ok(await pg.locator('.ds-gate .gate-dots i').count() === 4, 'one dot per market check');
  const hy = await pg.evaluate(() => { const h = document.querySelector('[data-hero]'); const b = document.querySelector('[data-sec="brief"]'); return h.getBoundingClientRect().top > b.getBoundingClientRect().top; });
  ok(hy, 'Today: the market brief leads, before research diagnostics');
  const cap = pg.locator('[data-capture]'); ok(await cap.count() === 1 && await cap.getAttribute('data-capture') === 'off' && !(await cap.isVisible()) && (await cap.innerText()) === '', 'Today: the capture slot is present but hidden and empty (flag off)');
  ok(await pg.locator('form input[type=email]').count() === 0, 'Today: no email field is drawn while the flag is off');
  ok(!reqs.some((u) => /beehiiv|subscribe/i.test(u)), 'Today: no subscribe network call');
  ok(await pg.locator('.ident').count() === 1 && await pg.locator('a[href*="//askakshay.com"]').count() === 0, 'Today: the footer is there and links nowhere outside Tripwire (no askakshay.com link)');
  ok(await pg.locator('h1').count() === 1, 'Today: one h1');
  ok((await over(pg)) <= 1, 'Today: no horizontal overflow at 390'); await ctx.close(); }
/* ---- from 360 px, every screen in this lane ---- */
{ const bad = []; for (const [r, sel] of [['/#/today', '[data-sec="brief"]'], ['/#/discover?view=table', '.stbl'], ['/#/discover', '.list .li'], ['/#/c/GCSL', '.c-head'], ['/#/methodology', '.rulecards'], ['/#/help', '.helpsteps'], ['/#/data', '[data-fresh-table] tr[data-file]']]) {
    const { ctx, pg } = await mk(360); await go(pg, r, sel); const o = await over(pg); if (o > 1) bad.push(`${r} +${o}`); if ((await pg.locator('h1').count()) !== 1) bad.push(`${r} h1`); await ctx.close(); }
  ok(bad.length === 0, `360 px: no horizontal overflow and one h1 on Today, Discover (list and table), Company, Methodology, Help, Data ${bad.join('; ')}`); }
/* ---- Discover: phone cards, desktop table ---- */
{ const { ctx, pg } = await mk(390, 844); await go(pg, '/#/discover?view=table', '.stbl tbody tr');
  const d = await pg.evaluate(() => { const tr = document.querySelector('.stbl tbody tr'); const cs = getComputedStyle(tr); const w = document.querySelector('.stbl-wrap'); return { disp: cs.display, scroll: w.scrollWidth - w.clientWidth, labels: [...tr.querySelectorAll('td.num')].filter((x) => x.dataset.label).length, h: tr.getBoundingClientRect().height }; });
  ok(d.disp === 'grid' && d.scroll <= 1, `phone: the table view is stacked cards, nothing scrolls sideways (display ${d.disp}, overflow ${d.scroll})`);
  ok(d.labels >= 4, `phone: each card labels its figures (${d.labels})`);
  const small = await pg.locator('.stbl tbody .icon-btn, .stbl tbody a').evaluateAll((e) => e.filter((x) => { const r = x.getBoundingClientRect(); return r.width && r.height < 43.5; }).length);
  ok(small === 0, 'phone: the buttons in a card are 44 px tall');
  await pg.getByRole('button', { name: /^Filters/ }).click(); ok(await pg.locator('[role=dialog]').count() === 1, 'phone: Filters opens the sheet'); await pg.keyboard.press('Escape'); await ctx.close(); }
{ const { ctx, pg } = await mk(1280, 900); await go(pg, '/#/discover?view=table', '.stbl tbody tr');
  const h = await pg.evaluate(() => Math.round(document.querySelector('.stbl tbody tr').getBoundingClientRect().height)); ok(h >= 52, `desktop: table rows are at least 52 px (${h})`);
  const z = await pg.evaluate(() => { const r = document.querySelectorAll('.stbl tbody tr'); return getComputedStyle(r[1].children[2]).backgroundColor === getComputedStyle(r[0].children[2]).backgroundColor; }); ok(z, 'desktop: no zebra striping');
  const tt = await pg.locator('.stbl thead .sortb').nth(1).getAttribute('title'); ok(/: /.test(tt ?? ''), `desktop: a column header carries a plain-language tooltip (${tt})`); await ctx.close(); }
/* ---- Methodology and Help: the reading column ---- */
{ const { ctx, pg } = await mk(1280, 900); await go(pg, '/#/methodology', '.rulecards');
  const w = await pg.evaluate(() => Math.round(document.querySelector('.read').getBoundingClientRect().width)); ok(w <= 720, `Methodology: the reading column is at most 720 px (${w})`);
  ok(await pg.locator('.rulecards li .n').count() >= 3 && await pg.locator('pre.formula').count() === 1, 'Methodology: rules are numbered cards and the formula sits in a code block');
  ok(/fill - stop/.test(await pg.locator('pre.formula').textContent()) && /paper/i.test(await pg.locator('body').innerText()), 'Methodology: the formula is stated, in paper-only wording');
  ok(await pg.locator('[data-capture="off"]').count() === 1 && await pg.locator('.ident').count() === 1, 'Methodology: capture slot (off) and the identity footer sit at the end');
  await go(pg, '/#/help', '.helpsteps'); const w2 = await pg.evaluate(() => Math.round(document.querySelector('.read').getBoundingClientRect().width)); ok(w2 <= 720, `Help: the reading column is at most 720 px (${w2})`); await ctx.close(); }
/* ---- Data and Company ---- */
{ const { ctx, pg } = await mk(1280, 900); await go(pg, '/#/data', '[data-fresh-table] tr[data-file]');
  const n = await pg.locator('[data-fresh-table] tr[data-file] .ds-status').count(); const rows = await pg.locator('[data-fresh-table] tr[data-file]').count();
  ok(n === rows && n >= 5 && (await pg.locator('[data-fresh-table] .ds-status').first().innerText()).trim().length > 2, `Data: every file's status is a pill with words (${n} of ${rows})`);
  await go(pg, '/#/c/TCS', '.c-head'); ok(await pg.locator('.c-head .ds-pill').count() >= 1, 'Company: the size class is a pill in the header (the sector is in the subtitle, once)');
  ok(await pg.locator('.sr', { hasText: /^(Passes|Fails|Not measured): /i }).count() >= 1, 'Company: rule checks say pass or fail in words'); await ctx.close(); }
await b.close(); console.log(fails ? `${fails} FAILED` : 'screens: all passed'); process.exit(fails ? 1 : 0);
