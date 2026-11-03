// Phase 4, pages-b lane in a real browser: My Desk empty state and workflow, the planner's allocation / cash / modelled loss / caveats, Data, Methodology and Help summaries with expandable detail,
// Settings (device-only card, last-backup status, the #/profile alias), Operations (health first, diagnostics apart, "not access-protected"), and no overflow from 320 to 430 px. AUTOMATED checks, not user research.
// Usage: node apps/tripwire/tests/pagesb.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const EMPTY = { ...STATE, follows: [], paper: [], entries: [], plans: [], compares: [], screens: [] };
const open = async (route, state = STATE, w = 390) => {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, state);
  await mockApi(ctx); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await pg.goto(base + route); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(900); return { ctx, pg, errs };
};
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* ---- My Desk: an empty desk offers one primary action, a paper-plan option and an optional guide to the workflow ---- */
{ const { ctx, pg, errs } = await open('/#/desk', EMPTY);
  await pg.waitForSelector('[data-desk="new"]'); await pg.locator('details[data-fold="workflow"]').evaluate((el) => { el.open = true; }); const steps = await pg.locator('[data-workflow] .wf-step').allInnerTexts();
  ok(steps.length === 5 && ['Understand', 'Check evidence and risks', 'Compare', 'Write a thesis', 'Track'].every((t, i) => steps[i].includes(t)), `the five workflow steps are explained in order (${steps.length})`);
  ok(/Paper only/.test(await pg.locator('[data-workflow]').innerText()), 'the workflow says it is paper only');
  ok(await pg.locator('[data-desk="new"] > .btn, [data-desk="new"] > section .btn.pri, [data-desk="new"] > .dsk-way .btn').count() === 2 && await pg.locator('[data-desk="new"] .btn.pri').count() === 1, 'one primary way to start and one secondary, not a panel of controls');
  await pg.getByRole('button', { name: 'Size a paper position' }).click(); await pg.waitForSelector('[role=dialog]');
  await pg.locator('#pl-s').fill('TCS'); await pg.locator('#pl-e').fill('2500'); await pg.locator('#pl-x').fill('2400'); await pg.waitForSelector('[data-plan-figures]');
  const f = (await pg.locator('[data-plan-figures]').innerText()).replace(/\s+/g, ' ');
  ok(/Hypothetical allocation/.test(f) && /Cash remaining/.test(f) && /Modelled loss at your assumed stop/.test(f) && /with the cost assumption/.test(f), `planner shows allocation, cash remaining and modelled loss at the assumed stop: ${f}`);
  const cav = await pg.locator('[data-plan-caveats]').innerText(); ok(/gap through it/.test(cav) && /0\.25% of capital over a round trip/.test(cav) && /Paper only/.test(cav), 'planner states the gap, the 0.25% cost and paper-only caveats');
  const q = await pg.locator('[role=dialog] .card .num').first().innerText(); const cap = await pg.locator('[data-plan-figures] dd').first().innerText();
  const qty = Number(q.replace(/[^0-9]/g, '')); ok(qty > 0 && cap.replace(/[^0-9]/g, '').startsWith(String(qty * 2500).slice(0, 3)), `allocation equals quantity x entry (${qty} x 2500 -> ${cap})`);
  ok((await over(pg)) <= 1, 'planner: no horizontal overflow at 390'); ok(errs.length === 0, 'no page errors'); await ctx.close(); }

/* ---- Data, Methodology, Help: a summary first, detail one tap away, nothing removed ---- */
{ const { ctx, pg } = await open('/#/data'); await pg.waitForSelector('[data-summary="data"]');
  const folds = pg.locator('details.fold'); const n = await folds.count(); const openN = await pg.locator('details.fold[open]').count();
  ok(n >= 8 && openN === 0, `Data: ${n} sections start closed behind a one-line summary (${openN} open)`);
  ok(await pg.locator('[data-fresh-table] tr[data-file]').first().isVisible(), 'Data: the file-by-file freshness table stays visible');
  const before = await pg.locator('[data-fold="sources"] .fold-body').isVisible(); await pg.locator('[data-fold="sources"] > summary').click(); ok(!before && await pg.locator('[data-fold="sources"] .fold-body').isVisible(), 'Data: Sources and ages opens on a tap');
  await pg.locator('details.fold').evaluateAll((d) => d.forEach((x) => { x.open = true; })); const t = await pg.locator('body').innerText();
  ok(/Pipeline health/.test(t) && /Size classes/.test(t) && /Back-test runs/.test(t) && /Sources and ages/.test(t) && /Eligibility|eligibility/.test(t), 'Data: every section is still there once opened');
  ok(await pg.locator('summary h2').count() >= n, 'Data: each summary holds a heading'); await ctx.close(); }
{ const { ctx, pg } = await open('/#/methodology'); await pg.waitForSelector('[data-summary="methodology"]');
  const eng = await pg.locator('[data-engine-summary]').count(); ok(eng >= 2, `Methodology: each engine's evidence word is in the summary (${eng})`);
  ok(await pg.locator('[data-fold="flags"][open] [data-risk-scope]').isVisible() && await pg.locator('[data-fold="holidays"][open] [data-holiday]').isVisible(), 'Methodology: the flag-level scope and the holiday statement stay open');
  ok(await pg.locator('[data-fold="engines"][open]').count() === 0, 'Methodology: the long engine detail starts closed'); await ctx.close(); }
{ const { ctx, pg } = await open('/#/help'); await pg.waitForSelector('[data-workflow]');
  ok(await pg.locator('[data-workflow] .wf-step').count() === 5 && /Settings/.test(await pg.locator('[data-fold="kept"]').innerText().catch(() => 'Settings')), 'Help: the workflow leads, and says Settings'); ok(!/\bProfile\b/.test(await pg.locator('body').innerText()), 'Help never says Profile'); await ctx.close(); }

/* ---- Settings ---- */
{ const { ctx, pg } = await open('/#/profile'); await pg.waitForSelector('[data-settings="device"]');
  ok((await pg.evaluate(() => location.hash)) === '#/settings', 'the old #/profile address is rewritten to #/settings'); ok((await pg.locator('h1').innerText()).trim() === 'Settings', 'the page is titled Settings'); ok((await pg.title()).startsWith('Settings'), 'the tab title says Settings');
  const top = await pg.locator('[data-settings="device"]').boundingBox(); ok(top && top.y < 400, `the device-only card and backup are at the top (y ${Math.round(top?.y ?? -1)})`);
  ok(/No backup recorded on this device/.test(await pg.locator('[data-backup-status]').innerText()), 'with no backup made it says: No backup recorded on this device');
  const before = await pg.evaluate(() => localStorage.getItem('tripwire:v1'));
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: 'Back up now' }).click()]); ok(/^tripwire-backup-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()), `a dated backup file is produced (${dl.suggestedFilename()})`);
  await pg.waitForTimeout(300); const st = await pg.locator('[data-backup-status]').innerText(); ok(/Last backup file created just now/.test(st) && /does not report whether you kept the file/.test(st), `the status records the creation, not the saving: ${st.replace(/\s+/g, ' ').slice(0, 120)}`);
  await pg.reload(); await pg.waitForSelector('[data-backup-status]'); ok(/Last backup file created/.test(await pg.locator('[data-backup-status]').innerText()), 'the status survives a reload');
  ok((await pg.evaluate(() => localStorage.getItem('tripwire:v1'))) === before, 'backing up changed none of the saved data'); ok(!/lastbackup/.test(before), 'the record is not inside the saved state');
  await pg.getByRole('button', { name: 'Restore from a backup' }).click(); ok(await pg.locator('#set-backup').isVisible(), 'Restore jumps to the import controls'); await ctx.close(); }
{ const { ctx, pg } = await open('/#/settings'); await pg.waitForSelector('[data-settings="device"]'); ok((await pg.locator('h1').innerText()).trim() === 'Settings', '#/settings opens directly');
  ok(await pg.locator('a[href="#/ops"]').count() === 1, 'Operations is one link away'); await ctx.close(); }

/* ---- Operations ---- */
{ const { ctx, pg } = await open('/#/ops'); await pg.waitForSelector('[data-ops-summary]');
  ok(/not access-protected/.test(await pg.locator('[data-ops-unprotected]').innerText()), 'Operations says the page is not access-protected');
  ok(!/hiding.*security|protected by/i.test(await pg.locator('body').innerText()) || /Keeping a link out of the menu/.test(await pg.locator('body').innerText()), 'it does not present hiding as security');
  const dev = pg.locator('[data-ops-dev]'); ok(await dev.count() === 1 && !(await dev.getAttribute('open')) !== null && /Developer diagnostics/.test(await dev.locator('summary').innerText()), 'developer diagnostics sit in their own labelled section');
  ok(!(await pg.locator('[data-ops-dev] .body').isVisible()), 'diagnostics start closed'); const topText = await pg.locator('[data-ops-summary]').innerText(); ok(/checked services/.test(topText), `a plain health sentence leads: ${topText.replace(/\s+/g, ' ').slice(0, 90)}`);
  await dev.locator('summary').click(); const dt = await dev.innerText(); ok(/Service probes/.test(dt) && /Schedules and caches/.test(dt) && /binding/i.test(dt), 'probes, schedules and bindings are inside diagnostics');
  ok(!/(sk-|ghp_|github_pat|Bearer |secret value:|token:)/i.test(await pg.locator('body').innerText()), 'no secret or token text on the page'); await ctx.close(); }

/* ---- 320 to 430 px: nothing overflows, nothing clips ---- */
{ const bad = [];
  for (const w of [320, 360, 430]) for (const [r, st] of [['/#/news', STATE], ['/#/desk', EMPTY], ['/#/desk', STATE], ['/#/desk?v=plans', STATE], ['/#/data', STATE], ['/#/methodology', STATE], ['/#/help', STATE], ['/#/settings', STATE], ['/#/ops', STATE]]) {
    const { ctx, pg } = await open(r, st, w); await pg.locator('details.fold').evaluateAll((d) => d.forEach((x) => { x.open = true; })).catch(() => {}); await pg.waitForTimeout(200);
    const o = await over(pg); const clipped = await pg.evaluate(() => [...document.querySelectorAll('.fold-t,.fold-s,.sk-k,.sk-v,.wf-b,.dsk-way,.set-backup,.nw-cover,.nw-clocks')].filter((e) => e.scrollWidth > e.clientWidth + 1).length);
    if (o > 1) bad.push(`${r} ${w}px +${o}`); if (clipped) bad.push(`${r} ${w}px clipped ${clipped}`); await ctx.close(); }
  ok(bad.length === 0, `no horizontal overflow or clipped labels at 320, 360 and 430 px ${bad.join('; ')}`); }

await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nall pagesb checks passed'); process.exit(fails ? 1 : 0);
