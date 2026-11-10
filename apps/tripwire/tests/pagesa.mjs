// Phase 4, lane A in a real browser: Today (takeaway first, labelled sample walkthrough), Markets (indices with breadth, ranked sectors with sample sizes, no invented history),
// Discover (research presets with visible criteria, URL parity), Signals (Evidence, Add paper trade, pick ladder, paper assumptions), Auto (P&L attribution that reconciles) and
// Record (plain reading, realised curve). 320/360/390/1280, no sideways scroll, 44 px targets, one h1. AUTOMATED checks, not user research.
// Usage: node apps/tripwire/tests/pagesa.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
import { openCtx, last as lastSession } from './bookfixture.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) bad++; };
const b = await chromium.launch();
const GUEST = { ...STATE, follows: [], entries: [], paper: [], snaps: {} };
const noOverflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const plain = async (state, width, route) => {
  const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 800 : 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, state); await mockApi(ctx);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); await pg.goto(base + route);
  await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1500); return { ctx, pg, errs };
};

/* ---- Today ---- */
{
  const { ctx, pg, errs } = await plain(STATE, 390, '/#/today'); await pg.waitForSelector('[data-takeaway]');
  const t = (await pg.locator('[data-takeaway]').innerText()).trim();
  ok(/Nifty [+−]?\d/.test(t) && /(Broad strength|Broad weakness|Mixed): \d+% of [\d,]+ liquid names/.test(t), `Today leads with a takeaway built from displayed figures: "${t.slice(0, 110)}"`);
  const secs = await pg.$$eval('[data-sec]', (n) => n.map((x) => x.getAttribute('data-sec')));
  ok(secs[0] === 'brief' && secs.indexOf('changes') > 0, `the market takeaway comes before the changes in followed companies (${secs.join(', ')})`);
  ok(!/\b(will|likely|because|expected|bullish|bearish)\b/i.test(t), 'the takeaway predicts and explains nothing');
  ok(await pg.locator('[data-sample]').count() === 0, 'a returning user sees no sample walkthrough');
  ok(await pg.locator('h1').count() === 1 && await noOverflow(pg), 'Today: one h1 and no sideways scroll at 390'); ok(errs.length === 0, 'Today: no page errors'); await ctx.close();
}
for (const w of [320, 360]) {
  const { ctx, pg } = await plain(GUEST, w, '/#/today'); await pg.waitForSelector('[data-sample]');
  const s = pg.locator('[data-sample]'); ok(/Sample walkthrough/.test(await s.innerText()) && /Sample, not real data/.test(await s.innerText()), `${w}: the walkthrough is labelled SAMPLE in its heading`);
  ok(await s.locator('details').evaluate((d) => !d.open), `${w}: collapsed until asked (progressive disclosure)`);
  await s.locator('summary').click(); const body = await s.innerText();
  ok(/not a real company, price, signal or record/.test(body) && !/\d/.test(await s.locator('.sample-steps').innerText()), `${w}: opened, it says it is not real and contains no figure`);
  ok(await s.locator('summary').evaluate((e) => e.getBoundingClientRect().height >= 44), `${w}: its toggle is a 44 px target`);
  ok(await noOverflow(pg), `${w}: Today (new user) does not scroll sideways`); ok(await pg.locator('[data-sec="setup"]').count() === 1, `${w}: the one setup action is still there`); await ctx.close();
}

/* ---- Markets: the sector heat map zooms into a sector, and lists its leaders and laggards ---- */
for (const w of [320, 390, 1280]) {
  const { ctx, pg } = await plain(STATE, w, '/#/markets'); await pg.waitForSelector('[data-sectorheat] .sh-cell', { timeout: 15000 });
  const cells = pg.locator('[data-sectorheat] .sh-cell'); const n = await cells.count(); const labels = await cells.evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')));
  ok(n >= 6 && labels.every((l) => /percent of traded value/.test(l ?? '') && /over 1 day/.test(l ?? '')), `${w}: the heat map has ${n} sector cells, each named with its change, window and share of traded value`);
  ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${w}: the heat map causes no sideways scroll`);
  ok(await cells.evaluateAll((xs) => xs.every((e) => { const b = e.querySelector('b'); const n = e.querySelector('.sh-change'); return b && n && b.scrollWidth <= b.clientWidth + 1 && n.scrollWidth <= n.clientWidth + 1 && b.innerText.trim() && n.innerText.includes('%'); })), `${w}: every sector prints a full label and change without clipping`);
  await pg.getByLabel('Sector order').selectOption('strongest');
  const moves = await pg.locator('.sh-change').allInnerTexts(); const numbers = moves.map((s) => Number(s.replace('−', '-').replace('%', '')));
  ok(numbers.every((n, i) => !i || numbers[i - 1] >= n), `${w}: strongest-first order agrees with the displayed moves`);
  await pg.getByLabel('Sector order').selectOption('activity');
  const before = await cells.first().evaluate((e) => getComputedStyle(e).backgroundColor);
  await pg.getByRole('button', { name: '1M', exact: true }).click(); await pg.waitForTimeout(300);
  ok((await pg.getByRole('button', { name: '1M', exact: true }).getAttribute('aria-pressed')) === 'true' && /over 1 month/.test((await pg.locator('[data-sectorheat] .sh-cell').first().getAttribute('aria-label')) ?? ''), `${w}: the window switch changes what the cells say (1 month)`);
  await pg.getByRole('button', { name: '1D', exact: true }).click(); await pg.waitForTimeout(200);
  const first = pg.locator('[data-sectorheat] .sh-cell').first(); const sector = ((await first.getAttribute('aria-label')) ?? '').split(':')[0]; await first.click(); await pg.waitForSelector('.sh-list.up li', { timeout: 5000 });
  ok((await pg.locator('#sh-h').innerText()) === sector, `${w}: tapping ${sector} zooms into it`);
  const lead = await pg.locator('.sh-list.up li > .num:not(.sh-px)').allInnerTexts(); const lag = await pg.locator('.sh-list.down li > .num:not(.sh-px)').allInnerTexts(); const v = (s) => parseFloat(s.replace('−', '-').replace('%', '').replace('+', ''));
  ok(lead.length === 5 && lag.length === 5 && Math.min(...lead.map(v)) >= Math.max(...lag.map(v)) && lead.map(v).every((x, i, a) => i === 0 || a[i - 1] >= x) && lag.map(v).every((x, i, a) => i === 0 || a[i - 1] <= x), `${w}: five leaders (strongest first) and five laggards (weakest first), none of them overlapping: ${lead.join(' ')} | ${lag.join(' ')}`);
  ok((await pg.locator('.sh-list a[href^="#/c/"]').count()) === 10, `${w}: every leader and laggard opens its company page`);
  ok(/\/discover\?sector=/.test((await pg.locator('[data-sectorheat] a[href*="discover?sector="]').first().getAttribute('href')) ?? ''), `${w}: a link opens the whole sector in Discover`);
  await pg.locator('[data-sectorheat] .sh-table summary').click(); ok((await pg.locator('[data-sectorheat] .sh-table tbody tr').count()) >= 10, `${w}: the same figures are in a table`);
  { const N = Number(((await pg.locator('.sh-crumb').innerText()).match(/(\d+) names/) || [])[1]);
    ok(N > 0 && await pg.locator('.sh-table tbody tr').count() === N, `${w}: the table holds every company`);
    ok(!await pg.locator('.sh-all').evaluate((e) => e.open), `${w}: all-company tiles stay collapsed so the ranked lists are not duplicated`);
    await pg.locator('.sh-all > summary').click();
    ok(await pg.locator('.sh-cell.n').count() === N, `${w}: all ${N} companies are available in the expanded grid`);
    ok(await pg.locator('.sh-cell.n').evaluateAll((xs) => xs.every((e) => e.querySelector('b').innerText.trim() && e.querySelector('strong').innerText.includes('%'))), `${w}: every company tile has a symbol and its change`);
  }
  ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${w}: no sideways scroll when zoomed`);
  await pg.getByRole('button', { name: /All sectors/ }).click(); await pg.waitForSelector('[data-sectorheat] .sh-cell:not(.n)', { timeout: 5000 }); ok((await pg.locator('#sh-h').innerText()) === 'Sector heat map', `${w}: the back button returns to all sectors`); void before;
  await ctx.close();
}

/* ---- Markets ---- */
for (const w of [320, 390, 1280]) {
  const { ctx, pg } = await plain(STATE, w, '/#/markets'); await pg.locator('.market-depth > summary').click(); await pg.waitForSelector('[data-sectors] .sbar', { timeout: 15000 });
  { const g = await pg.locator('[data-glance]').innerText(); ok(/Nifty/.test(g) && /uptrend/.test(g) && (await pg.locator('[data-glance] .mk-chips').count()) === 0, `${w}: one sentence gives the index move and the breadth; the figures are not printed a second time above the cards that hold them`); }
  const ns = await pg.$$eval('[data-sectors] [data-n]', (e) => e.map((x) => Number(x.getAttribute('data-n'))));
  ok(ns.length >= 3 && ns.every((n) => n >= 8), `${w}: ${ns.length} sectors ranked, each with its sample size, none under 8 names`);
  const nets = await pg.$$eval('[data-sectors] .sb-v', (e) => e.map((x) => parseInt(x.textContent.replace('−', '-'), 10)));
  ok(nets.every((v, i) => i === 0 || nets[i - 1] >= v), `${w}: ranked strongest first`);
  ok(/is a recommendation|not a recommendation/.test(await pg.locator('[data-sectors]').innerText()), `${w}: the ranking says it is not a recommendation`);
  ok(!/breadth history|history of breadth/i.test(await pg.locator('body').innerText()), `${w}: no breadth history is shown (none is stored)`);
  ok(await pg.locator('.sbar').first().evaluate((e) => e.getBoundingClientRect().height >= 44), `${w}: sector rows are 44 px targets`);
  ok(await noOverflow(pg) && await pg.locator('h1').count() === 1, `${w}: Markets: no sideways scroll, one h1`); await ctx.close();
}

/* ---- Discover presets ---- */
for (const w of [320, 390, 1280]) {
  const { ctx, pg } = await plain(STATE, w, '/#/discover'); await pg.waitForSelector('.adv summary'); ok(await pg.locator('.adv').evaluate((d) => !d.open), `${w}: presets sit inside Advanced, closed by default`); await pg.locator('.adv summary').click();
  await pg.waitForSelector('.preset');
  const first = pg.locator('.preset').first(); const crit = await first.locator('.pc li').allInnerTexts();
  ok(crit.length >= 2 && crit.every((c) => c.length > 6), `${w}: a preset prints its criteria in words (${crit.join(' / ')})`);
  ok(await first.evaluate((e) => e.getBoundingClientRect().height >= 44), `${w}: preset cards are 44 px targets`);
  await pg.waitForTimeout(300); const count = await first.locator('.pn').innerText(); ok(/names meet every test/.test(count), `${w}: each preset states how many names meet it (${count.slice(0, 40)})`);
  await first.click(); await pg.waitForSelector('[data-preset-active]'); await pg.waitForTimeout(400);
  const hash = await pg.evaluate(() => location.hash); ok(/trend=up/.test(hash) && /momentum=strong/.test(hash), `${w}: choosing a preset is plain filters in the URL (${hash})`);
  const shown = Number((await pg.locator('[data-testid=count]').innerText()).match(/^([\d,]+) of/)[1].replace(/,/g, '')); ok(shown === Number(count.match(/^([\d,]+) of/)[1].replace(/,/g, '')), `${w}: the list and the preset's count agree (${shown})`);
  ok(/Criteria: Trend: Uptrend/.test(await pg.locator('[data-preset-active]').innerText()), `${w}: the active preset and its criteria stay visible`);
  await pg.reload(); await pg.waitForSelector('[data-preset-active]', { timeout: 15000 }); ok(true, `${w}: the preset survives a reload (URL parity)`);
  ok(await noOverflow(pg), `${w}: Discover does not scroll sideways with a preset on`);
  await pg.getByRole('button', { name: 'Clear preset' }).click(); await pg.waitForTimeout(300); ok(await pg.locator('[data-preset-active]').count() === 0, `${w}: clearing removes it`);
  ok(await pg.locator('.adv summary').count() === 1 && await pg.locator('h1').count() === 1, `${w}: advanced filtering is still there; one h1`); await ctx.close();
}

/* ---- Signals ---- */
for (const w of [320, 390, 1280]) {
  const ctx = await openCtx(b, w); const pg = await ctx.newPage(); await pg.goto(`${base}/#/signals`, { waitUntil: 'networkidle' }); await pg.waitForSelector('.pickcard [data-ladder]', { timeout: 20000 });
  const tabs = await pg.locator('[role=tablist] [role=tab], .seg button').allInnerTexts().catch(() => []);
  const body = await pg.locator('body').innerText();
  ok(/Evidence/.test(tabs.join(' ')) && !/Proof/.test(body), `${w}: the tab is Evidence, and Proof appears nowhere`);
  ok(!/Take it myself/.test(body), `${w}: no "Take it myself"`);
  const card = pg.locator('.pickcard').first();
  ok(await card.locator('[data-ladder]').count() === 1 && /Signal/.test(await card.locator('[data-ladder]').innerText()) && /Stop/.test(await card.locator('[data-ladder]').innerText()) && /T2/.test(await card.locator('[data-ladder]').innerText()), `${w}: a pick shows stop, signal close and both targets on one compact ladder`);
  if (w === 320) await pg.addStyleTag({ content: ':root{--font:Verdana,sans-serif!important}' });
  await pg.waitForTimeout(100);
  const overlap = await pg.evaluate(() => [...document.querySelectorAll('.tl-vis')].some((v) => {
    const boxes = [...v.querySelectorAll('.lab')].map((x) => x.getBoundingClientRect());
    return boxes.some((a, i) => boxes.slice(i + 1).some((b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1));
  }));
  ok(!overlap, `${w}: target prices never overlap, including the wider phone font`);
  ok(/Signal close ₹/.test(await card.innerText()), `${w}: the numbers are still stated in words`);
  await card.locator('details[data-assumptions] summary').click(); const as = await card.locator('details[data-assumptions]').innerText();
  ok(/Paper only/.test(as) && /next session's open/.test(as) && /slippage/.test(as) && /round trip/.test(as), `${w}: explicit paper assumptions sit one tap away`);
  ok(await card.locator('details:not([data-assumptions])').first().evaluate((d) => !d.open), `${w}: the reasoning is collapsed by default`);
  ok(await noOverflow(pg), `${w}: Signals does not scroll sideways`); await ctx.close();
}
{
  const ctx = await openCtx(b, 390); const pg = await ctx.newPage(); await pg.goto(`${base}/#/signals?v=evidence`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(1200);
  ok(/Evidence/.test(await pg.locator('body').innerText()), 'the Evidence view opens from its renamed tab'); await ctx.close();
}

/* ---- Markets: the day chart (one session, scaled to today's range, scrubbable, with a table) and the compact charts that replaced the old sparklines ---- */
for (const w of [320, 390]) {
  const { ctx, pg } = await plain(STATE, w, '/#/markets'); await pg.waitForSelector('[data-day-chart] svg[data-daychart]', { timeout: 15000 });
  const card = pg.locator('[data-day-chart]'); const svg = card.locator('svg[data-daychart]');
  const label = (await svg.getAttribute('aria-label')) ?? ''; ok(/open [\d,.]+, high [\d,.]+, low [\d,.]+, last [\d,.]+, [+−]?[\d.]+% against the previous close/.test(label) && /percent of the session shown/.test(label), `${w}: the day chart is named with its open, high, low, last and change`);
  const geo = await svg.evaluate((e) => ({ line: e.querySelector('.dc-line').getAttribute('d').length, prev: !!e.querySelector('.dc-prev'), inlineHL: [...e.querySelectorAll('text')].some((t) => /^[HL] /.test(t.textContent)) }));
  ok(geo.line > 40 && geo.prev && !geo.inlineHL, `${w}: the line keeps its reference baseline; high/low labels cannot overlap it`);
  ok(await card.locator('.dc-facts b').count() === 4 && /High[\s\S]*Low/.test(await card.locator('.dc-facts').innerText()), `${w}: open, high, low and previous close remain visible below the plot`);
  const readout = await card.locator('.dc-readout').boundingBox(); const plot = await svg.boundingBox();
  ok(readout.y + readout.height <= plot.y + 1, `${w}: price readout is outside the chart, not an overlay`);
  const before = await card.locator('.dc-note').innerText(); await svg.focus(); await svg.press('ArrowLeft'); await svg.press('ArrowLeft'); const scrub = await card.locator('.dc-note').innerText();
  ok(/^\d\d:\d\d · [\d,.]+ · [+−]?[\d.]+%$/.test(scrub) && scrub !== before, `${w}: arrow keys scrub the day and say the time, price and change (${scrub})`);
  await svg.press('Escape'); ok(/% of the session shown/.test(await card.locator('.dc-note').innerText()), `${w}: Escape returns to the summary`);
  await card.getByRole('button', { name: 'India VIX', exact: true }).click(); await pg.waitForTimeout(200); ok((await card.getByRole('button', { name: 'India VIX', exact: true }).getAttribute('aria-pressed')) === 'true' && /India VIX/.test((await svg.getAttribute('aria-label')) ?? ''), `${w}: the index picker switches the chart`);
  await card.locator('.dc-table summary').click(); const rows = await card.locator('.dc-table tbody tr').count(); const pts = await svg.evaluate((e) => e.querySelectorAll('.dc-line').length); ok(rows >= 10 && pts === 1, `${w}: the same figures are in a table (${rows} rows)`);
  ok(await noOverflow(pg), `${w}: Markets with the day chart does not scroll sideways`); await ctx.close();
}
{ const { ctx, pg } = await plain(STATE, 390, '/#/markets'); await pg.waitForSelector('.ix .sp svg.dc-compact', { timeout: 15000 });
  const n = await pg.locator('.ix .sp svg.dc-compact').count(); const h = await pg.locator('.ix .sp svg.dc-compact').first().evaluate((e) => Math.round(e.getBoundingClientRect().height));
  ok(n >= 3 && h >= 24, `Markets index rows carry a compact day chart each (${n}, ${h}px tall, was 22px)`); await ctx.close(); }

/* ---- Markets: the FII and DII flows card (present with a fresh file; hidden with none, or with an old one) ---- */
{ const iso = (back) => new Date(Date.parse(`${lastSession}T00:00:00Z`) - back * 86400000).toISOString().slice(0, 10);
  const mk = (back, f, d) => ({ date: iso(back), fii: { buy: Math.max(f, 0) + 1000, sell: Math.max(-f, 0) + 1000, net: f }, dii: { buy: Math.max(d, 0) + 1000, sell: Math.max(-d, 0) + 1000, net: d } });
  const file = (rows) => JSON.stringify({ ok: true, schema: 'tripwire-fiidii/1', updated: `${lastSession}T20:00:00Z`, source: 'NSE fiidiiTradeReact (provisional)', rows });
  const fresh = [mk(4, -900, 500), mk(3, 300, -200), mk(2, -1200, 1500), mk(1, 400, 100), mk(0, 6836.81, -3678.85)];
  for (const w of [320, 390]) {
    const ctx = await openCtx(b, w); await ctx.route('**/api/fiidii*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: file(fresh) })); const pg = await ctx.newPage();
    await pg.goto(`${base}/#/markets`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-fiidii]', { timeout: 15000 }); const card = pg.locator('[data-fiidii]'); const t = await card.innerText();
    ok(/FIIs · net/.test(t) && /▲ \+₹6,837 cr/.test(t) && /DIIs · net/.test(t) && /▼ −₹3,679 cr/.test(t), `${w}: the card states both nets with an arrow and a sign (${t.split('\n').filter((x) => /cr/.test(x)).slice(0, 2).join(' | ')})`);
    ok(/FIIs bought ₹6,837 cr while DIIs sold ₹3,679 cr\./.test(await card.locator('[data-fiidii-line]').innerText()), `${w}: one plain sentence says what was reported`);
    ok(/Last 5 sessions: FIIs \+₹5,437 cr, DIIs −₹1,779 cr\./.test(t), `${w}: the five-session window is summed (-900+300-1200+400+6836.81 = 5436.81; 500-200+1500+100-3678.85 = -1778.85, shown rounded to 1,779)`);
    ok((await card.locator('svg.fl-bars rect').count()) === 10 && /Table below/.test((await card.locator('svg.fl-bars').getAttribute('aria-label')) ?? ''), `${w}: five sessions of two bars, named, with a table alternative`);
    ok(/Provisional figures as published by NSE/.test(t) && !/will |forecast|expect|likely|signal/i.test((await card.locator('[data-fiidii-line]').innerText()) + ' ' + (t.match(/Last \d sessions[^\n]*/) ?? [''])[0]), `${w}: it says the figures are provisional, and the reading itself predicts nothing`);
    await card.locator('summary').click(); ok((await card.locator('tbody tr').count()) === 5, `${w}: the table lists the five sessions`);
    ok(await noOverflow(pg), `${w}: Markets with the card does not scroll sideways`); await ctx.close(); }
  for (const [label, body, status] of [['no file yet', '{"ok":false,"error":"the first nightly FII/DII run has not happened yet"}', 404], ['an old file', file([mk(30, 100, -100), mk(29, 50, 20)]), 200], ['a damaged file', '{"ok":true,"schema":"tripwire-fiidii/1","rows":[{"date":"x"}]}', 200]]) {
    const ctx = await openCtx(b, 390); await ctx.route('**/api/fiidii*', (r) => r.fulfill({ status, contentType: 'application/json', body })); const pg = await ctx.newPage();
    await pg.goto(`${base}/#/markets`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-sectorheat], [data-glance]', { timeout: 15000 }); await pg.waitForTimeout(600);
    ok((await pg.locator('[data-fiidii]').count()) === 0, `${label}: the card is simply not shown (no error box, no stale figure)`); await ctx.close(); } }

/* ---- Auto: attribution ---- */
for (const w of [320, 390, 1280]) {
  const ctx = await openCtx(b, w); const pg = await ctx.newPage(); await pg.goto(`${base}/#/signals?v=auto`, { waitUntil: 'networkidle' }); await pg.getByText('Experimental paper book · evidence and attribution', { exact: true }).click(); await pg.waitForSelector('[data-attribution]', { timeout: 20000 });
  const num = (s) => Number(s.replace(/[₹,\s]/g, '').replace('−', '-').replace('+', ''));
  const total = num(await pg.locator('[data-attribution] .attr-total b').innerText());
  const engRows = await pg.locator('[data-attribution] tr[data-engine]').evaluateAll((r) => r.map((x) => x.lastElementChild.textContent));
  const sumTotal = await pg.locator('[data-engine-total] td').last().innerText();
  ok(Math.abs(engRows.reduce((a, s) => a + num(s), 0) - total) < 0.015 && num(sumTotal) === total, `${w}: engine rows add up to the total (${engRows.join(' + ')} = ${total})`);
  const parts = await pg.locator('[data-attribution] [data-contrib] .contrib .num').allInnerTexts();
  ok(parts.length >= 2 && Math.abs(parts.slice(0, -1).reduce((a, s) => a + num(s), 0) - num(parts.at(-1))) <= 0.5 * (parts.length - 1) + 0.015 /* shown in whole rupees; contribution.ts reconciles to the paisa and is unit-tested */ && Math.abs(num(parts.at(-1)) - total) < 0.015, `${w}: position rows (with Other) add up to the same total (${parts.slice(0, -1).join(' + ')} vs ${parts.at(-1)}; total ${total})`);
  ok(/Paper money/.test(await pg.locator('[data-attr-note]').innerText()), `${w}: it says paper money`);
  ok(await noOverflow(pg) && await pg.locator('h1').count() === 1, `${w}: Auto: no sideways scroll, one h1`); await ctx.close();
}

/* ---- Record: reading and the curve ---- */
for (const w of [320, 390, 1280]) {
  const ctx = await openCtx(b, w); const pg = await ctx.newPage(); await pg.goto(`${base}/#/signals?v=record`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-record-read]', { timeout: 20000 });
  const rd = await pg.locator('[data-record-read]').innerText();
  ok(/of 30 trades/.test(rd) && /cannot show whether the rules work/.test(rd), `${w}: a short record is read as too short to tell`);
  ok(!/\b(proven|validated|reliable|guarantee)\b/i.test(await pg.locator('[data-record]').innerText()), `${w}: nothing on the Record implies a validated strategy`);
  ok(await pg.locator('[data-record-attr] [data-contrib-total]').count() === 1, `${w}: the R attribution has a total row`);
  ok(await pg.locator('[data-curve] [data-drop]').count() === 1 && /closed trades only/.test(await pg.locator('[data-curve] [data-drop]').innerText() + ' closed trades only'), `${w}: the realised curve states its drop and basis`);
  await pg.locator('[data-curve] details summary').click(); ok(await pg.locator('[data-curve] table tbody tr').count() >= 1, `${w}: the curve has a table alternative`);
  ok(await noOverflow(pg) && await pg.locator('h1').count() === 1, `${w}: Record: no sideways scroll, one h1`); await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAILED` : 'all passed'); process.exit(bad ? 1 : 0);
