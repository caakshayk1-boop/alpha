// The shared chart system in a browser: the first screen, the factual takeaway, the Chart / Table agreement, keyboard and touch, series identity beyond colour,
// reduced motion, the saved range, missing and non-positive data, the comparison (coverage notes, drawdown, compact add control), the financial panels, no overflow at 360 and 1280.
// AUTOMATED checks in a desktop Chromium; they do not replace a real phone or a screen reader. Usage: node apps/tripwire/tests/charts.mjs [baseUrl]
import { chromium, newCtx, ohlcSeries, openOptions, closeOptions, staleBanner } from './uimock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const wait = (pg) => pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {});
const open = async (pg, route, sel) => { await pg.goto(base + '/'); await pg.goto(base + route); await pg.reload(); await wait(pg); if (sel) await pg.waitForSelector(sel, { timeout: 20000 }); await pg.waitForTimeout(400); };
const overflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const radio = (pg, group, name) => pg.locator(`[role=radiogroup][aria-label="${group}"]`).getByRole('radio', { name, exact: true });
const series = (n, sym, opts) => ohlcSeries(n, sym, opts);

/* 1. the first screen on a phone: the chart is in it, with its takeaway, and it opens on one year against the Nifty */
{ const ctx = await newCtx(b, 390, series(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  const top = await pg.evaluate(() => document.querySelector('.chart-plot').getBoundingClientRect().top); ok(top > 0 && top < 844, `the principal chart starts inside the first 844px (top ${Math.round(top)})`);
  const take = (await pg.locator('[data-takeaway]').allInnerTexts()).join('\n');
  ok(/^TCS (rose|fell|was flat) [\d.]+% over the last year, against [+−]?[\d.]+% for the Nifty 50/.test(take) && /percentage points|level with it/.test(take) && /Closes through \d+ \w{3} \d{4}/.test(take), `the takeaway is a factual sentence with the benchmark and the data-through date (${take.split('\n')[0].slice(0, 90)})`);
  ok(!/because|will |likely|expect|forecast|confidence/i.test(take), 'the takeaway makes no causal claim, forecast or confidence statement');
  ok((await radio(pg, 'Range', '1Y').getAttribute('aria-checked')) === 'true' && (await radio(pg, 'Compare', 'VS NIFTY').getAttribute('aria-checked')) === 'true', 'a new person starts on 1Y, stock against the Nifty');
  // 2 Nov 2026 (owner: "too congested"): the two figures are now two chips BELOW the plot, labelled "Absolute change" and "Relative to the Nifty 50" (was "Price change (absolute)", too long for a half-width chip)
  const head = await pg.locator('.chart-head').innerText(); ok(/Absolute change/.test(head) && /Relative to the Nifty 50/.test(head) && /pts/.test(head), 'absolute change and relative performance are two labelled figures');
  ok(await pg.locator('.cf-chips .cf-chip').count() === 2, 'the two figures are one compact row of two chips');
  const leg = await pg.locator('.cf-legend li').count(); const shapes = await pg.locator('.cf-legend li svg path').count(); ok(leg === 2 && shapes === 2 && (await pg.locator('.cf-legend li svg line[stroke-dasharray]').count()) === 1, 'the legend gives each line its own marker, and the benchmark a dash');
  ok(/[▲▼■]/.test(await pg.locator('.chart-head').innerText()) && /[▲▼■]/.test(await pg.locator('.c-end').first().innerText()), 'direction is carried by an arrow and a sign, not by colour alone');
  const meta = await pg.locator('.cf-meta').innerText(); ok(/1Y/.test(meta) && /indexed to 100/.test(meta) && /through \d+ \w{3} \d{4}/.test(meta), `timeframe, units and data-through date are printed (${meta})`);
  const basis = await pg.locator('.cf-basis').innerText(); ok(basis.length < 110 && /split-adjusted/i.test(basis) && /dividends not included/i.test(basis), `one short basis line sits under the chart (${basis})`);
  await pg.locator('summary', { hasText: 'About this chart' }).click(); ok(/Yahoo/.test(await pg.locator('.chart').innerText()) && /dividends are neither reinvested nor added back/.test(await pg.locator('.chart').innerText()), 'the full source and dividend treatment are in About this chart');
  ok(await pg.locator('.cf-tbl > summary').count() === 1 && (await pg.locator('.cf-tbl > summary').boundingBox()).height >= 43.5, 'the table is a disclosure with a 44px summary');
  ok((await overflow(pg)) <= 0, 'no horizontal overflow at 390');
  await ctx.close(); }

/* On a phone the plot starts inside the first screen even with the stale-data banner, and the complete takeaway follows it. */
for (const [w, h] of [[390, 844], [360, 800]]) {
  const ctx = await newCtx(b, w, series(900, 'TCS', { nifty: true })); await staleBanner(ctx); const pg = await ctx.newPage(); await pg.setViewportSize({ width: w, height: h }); await open(pg, '/#/c/TCS', '.chart-plot svg');
  ok(await pg.locator('.banner[role=status]').filter({ hasText: 'Treat everything as old' }).count() === 1, `${w}: the stale-data banner is on screen for this check (the fixture is pinned stale, not left to the clock)`);
  const m = await pg.evaluate(() => { const top = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }; const lead = document.querySelector('.cf-lead'); const lh = parseFloat(getComputedStyle(lead).lineHeight);
    const sty = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; }; const lg = sty('.cf-legend'), tt = sty('.cf-h');
    return { plot: top('.chart-plot'), card: top('.cf'), leadLines: Math.round(lead.clientHeight / lh), clamped: lead.scrollHeight > lead.clientHeight + 1, copy: document.querySelectorAll('[data-clamped-copy]').length, legendBelowTitle: lg && tt ? lg.top >= tt.bottom - 1 : null, chipsBelowPlot: top('.cf-chips') > top('.chart-plot'), ctrlRows: document.querySelectorAll('.c-prim > .mini-seg, .c-prim > .c-prim2, .c-prim > [role=radiogroup]').length }; });
  ok(m.plot != null && m.plot < 700, `${w}x${h}: with the stale-data banner the plot starts at ${m.plot}px, under 700 (the card starts at ${m.card})`);
  ok(!m.clamped && await pg.locator('.cf-lead').evaluate((e) => e.getBoundingClientRect().top > document.querySelector('.chart-plot').getBoundingClientRect().bottom), `${w}: the full takeaway follows the plot without clipping`);
  ok(m.chipsBelowPlot, `${w}: the two figures sit below the plot`);
  ok(await pg.locator('.cf-legend').count() === 1 && await pg.locator('.cf-legend li').count() === 2, `${w}: the legend is still there, with both lines`);
  ok(await pg.locator('.cf-lead').innerText().then((t) => /^TCS (rose|fell|was flat)/.test(t) && /percentage points|level with it|Nifty/.test(t)), `${w}: the takeaway text is whole in the page`);
  ok(await pg.locator('.cf-tbl > summary').count() === 1, `${w}: the table alternative is still there`);
  await pg.locator('.chart-plot').focus(); await pg.keyboard.press('Home'); const before = await pg.locator('.chart-plot').boundingBox(); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(80);
  const after = await pg.locator('.chart-plot').boundingBox(); const hd = await pg.locator('.chart-head').boundingBox();
  ok(Number(await pg.locator('.chart-plot').getAttribute('aria-valuenow')) === 2 && Math.abs(after.y - before.y) < 0.5 && Math.abs(after.height - before.height) < 0.5, `${w}: the keyboard still moves along the line, and the plot does not move while it does`);
  ok(hd.height >= 70, `${w}: the figures row holds its height while the hover wording changes (${Math.round(hd.height)}px)`);
  ok((await overflow(pg)) <= 0, `${w}: no horizontal overflow`);
  await ctx.close(); }
{ const ctx = await newCtx(b, 320, series(900, 'TCS', { nifty: true })); await staleBanner(ctx); const pg = await ctx.newPage(); await pg.setViewportSize({ width: 320, height: 640 }); await open(pg, '/#/c/TCS', '.chart-plot svg');
  ok((await overflow(pg)) <= 0, '320: the compact header does not overflow'); const t320 = await pg.evaluate(() => Math.round(document.querySelector('.chart-plot').getBoundingClientRect().top + scrollY)); ok(t320 < 700, `320: the plot starts at ${t320}px, under 700`); await ctx.close(); }

/* 2. chart and table agree; the last price on the chart is the last row of the table */
{ const ctx = await newCtx(b, 1280, series(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  await radio(pg, 'Compare', 'PRICE').click(); await pg.waitForSelector('.c-last');
  const tag = (await pg.locator('.c-last').innerText()).replace(/[₹,\s]/g, '');
  await pg.locator('.cf-tbl > summary').click(); await pg.waitForSelector('.cf-table table');
  const rows = await pg.locator('.cf-table tbody tr').count(); const lastRow = (await pg.locator('.cf-table tbody tr').last().locator('td').first().innerText()).replace(/[,\s]/g, '');
  ok(lastRow === tag, `the last row of the table (${lastRow}) is the price tagged on the chart (${tag})`);
  const closes = await pg.locator('.cf-table tbody tr td:first-of-type').allInnerTexts(); const nums = closes.map((x) => Number(x.replace(/,/g, '')));
  ok(rows <= 26 && rows >= 4 && /of the \d+ day closes drawn on the chart/.test(await pg.locator('.cf-table').innerText()), `the table lists ${rows} rows and says how many of the drawn points they are`);
  ok(await pg.locator('.cf-table caption.sr').count() === 1 && await pg.locator('.cf-table th[scope=col]').count() >= 2 && await pg.locator('.cf-table .scroll-x[tabindex="0"]').count() === 1, 'the table has a caption, column headers and a focusable scroll region');
  /* the highest close of the window is among the rows (the chart's HIGH figure) */
  const high = Number((await pg.locator('.c-hl b').nth(1).innerText()).replace(/[₹,\s]/g, '')); ok(nums.includes(high) || Math.max(...nums) >= high - 0.005, 'the window high shown on the chart is among the table rows');
  await ctx.close(); }

/* 3. keyboard, tooltip and touch */
{ const ctx = await newCtx(b, 390, series(900, 'TCS', { nifty: true }), { hasTouch: true }); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  const plot = pg.locator('.chart-plot[role=slider]'); await plot.focus(); const v0 = await plot.getAttribute('aria-valuetext'); await pg.keyboard.press('End'); await pg.keyboard.press('ArrowLeft');
  ok((await plot.getAttribute('aria-valuetext')) !== v0 && /TCS [+−]?[\d.]+%, Nifty [+−]?[\d.]+%/.test((await plot.getAttribute('aria-valuetext')) ?? ''), 'arrow keys move along the line and speak both values');
  ok(await pg.locator('.c-tip').count() === 1 && /Nifty/.test(await pg.locator('.c-tip').innerText()) && (await pg.locator('.c-tip').getAttribute('aria-hidden')) === 'true', 'a tooltip follows the position (hidden from assistive tech: the slider speaks it)');
  await pg.keyboard.press('Escape'); ok(await pg.locator('.c-tip').count() === 0, 'Escape clears it');
  const bx = await plot.boundingBox(); await pg.touchscreen.tap(bx.x + bx.width * 0.5, bx.y + bx.height / 2); await pg.waitForTimeout(150);
  ok(await pg.locator('.c-tip').count() === 1, 'a tap on the chart shows the tooltip (touch)');
  ok(await plot.evaluate((e) => getComputedStyle(e).touchAction) === 'pan-y', 'vertical scrolling over the chart still works on touch');
  await ctx.close(); }

/* 4. reduced motion: motion is off by default; nothing animates, and the line is drawn in full */
{ const ctx = await newCtx(b, 390, series(900, 'TCS', { nifty: true }), { reducedMotion: 'reduce' }); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  ok(await pg.evaluate(() => !document.documentElement.classList.contains('fx') && document.getAnimations().filter((a) => a.playState === 'running').length === 0), 'with reduced motion nothing on the page is animating');
  ok(await pg.evaluate(() => [...document.querySelectorAll('.chart-plot path.c-line')].every((p) => getComputedStyle(p).strokeDashoffset === '0px' || getComputedStyle(p).strokeDashoffset === '0')), 'the line is fully drawn');
  await ctx.close(); }

/* 5. the saved choice wins: pick 3Y, reload, still 3Y */
{ const ctx = await newCtx(b, 390, series(1400, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  await radio(pg, 'Range', '3Y').click(); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1')).prefs.chart?.range === '3Y'), 'the choice is written to this device\'s saved preferences');
  await pg.evaluate(() => { location.hash = '#/today'; }); await pg.waitForTimeout(600); await pg.evaluate(() => { location.hash = '#/c/TCS'; }); await pg.waitForSelector('.chart-plot svg');
  ok((await radio(pg, 'Range', '3Y').getAttribute('aria-checked')) === 'true', 'the range a person chose is kept on this device');
  await ctx.close(); }

/* 6. advanced controls are grouped; a stock-only indicator switches the benchmark view off and says so; no Nifty means a plain price line */
{ const ctx = await newCtx(b, 390, series(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  ok(await pg.locator('.sheet').count() === 0 && !(await radio(pg, 'Style', 'CANDLES').isVisible().catch(() => false)) && (await pg.locator('.c-ma, .c-sub, .chart-sub, .c-lvl').count()) === 0, 'candles, scale, interval and overlays are in the Chart options sheet, and the default is a clean line with no overlay');
  await openOptions(pg); await radio(pg, 'Style', 'CANDLES').click(); await pg.waitForSelector('.c-candles rect');
  ok(/^Chart options, 1 changed$/.test((await pg.locator('.c-optbtn').getAttribute('aria-label')) ?? '') && (await pg.locator('.c-optbtn .c-badge').innerText()).trim() === '1', 'the options button carries a count badge when something differs from the default (its name says so too)'); await closeOptions(pg);
  ok((await radio(pg, 'Compare', 'PRICE').getAttribute('aria-checked')) === 'true', 'choosing candles switches the benchmark view off (candles are drawn for the stock alone)');
  const hollow = await pg.evaluate(() => { const r = [...document.querySelectorAll('.c-candles rect')]; const f = new Set(r.map((x) => x.getAttribute('fill'))); return f.size; }); ok(hollow >= 2, 'up candles are hollow and down candles solid (a second cue beside colour)');
  await ctx.close();
  const c2 = await newCtx(b, 390, series(900, 'TCS')); const p2 = await c2.newPage(); await open(p2, '/#/c/TCS', '.chart-plot svg');
  ok(await radio(p2, 'Compare', 'PRICE').getAttribute('aria-checked') === 'true' && /rose|fell|was flat/.test((await p2.locator('[data-takeaway]').allInnerTexts()).join(' ')) && !/Nifty/.test(await p2.locator('[data-takeaway] .cf-lead').innerText()), 'with no Nifty series the chart is a plain price line and the takeaway names no benchmark');
  ok(/Nifty 50 could not be read/.test(await p2.locator('.chart').innerText()), 'and the page says the benchmark is missing');
  await c2.close(); }

/* 7. a non-positive close: log scale is refused with the reason, nothing divides by zero */
{ const raw = JSON.parse(series(900, 'TCS', { nifty: true })); raw.c[raw.c.length - 5] = 0; raw.h = raw.h.map((x, i) => (i === raw.c.length - 5 ? 0 : x));
  const ctx = await newCtx(b, 390, JSON.stringify(raw)); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  await radio(pg, 'Compare', 'PRICE').click(); await openOptions(pg);
  ok(await pg.locator('[role=radiogroup][aria-label=Scale] [data-id=log]').isDisabled(), 'LOG is disabled when a close in the window is zero or negative');
  ok(!/NaN|Infinity/.test(await pg.locator('.chart').innerText()), 'no NaN or Infinity is printed'); await ctx.close(); }

/* 8. the comparison: takeaway and indexed chart first, compact add control, coverage notes, drawdown, no overflow */
for (const w of [360, 1280]) {
  const ctx = await newCtx(b, w, series(1100, 'TCS', { nifty: true })); const pg = await ctx.newPage();
  await ctx.route('**/api/chart?s=NEWCO*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: series(120, 'NEWCO', { nifty: true }) }));
  await open(pg, '/#/compare?s=TCS,INFY', '.cchart svg path');
  const order = await pg.evaluate(() => { const c = document.querySelector('[data-takeaway]').getBoundingClientRect().top; const a = document.querySelector('.cmp-add')?.getBoundingClientRect().top ?? 1e9; return c < a; }); ok(order, `${w}: the takeaway and chart come before the add control`);
  const sum = pg.locator('.cmp-add > summary'); ok(await sum.count() === 1 && (await sum.boundingBox()).height >= 43.5 && (await pg.locator('#cmp-add').count()) === 0 || !(await pg.locator('#cmp-add').isVisible()), `${w}: "Add a third company" is a compact 44px control, closed until asked for`);
  await sum.click(); ok(await pg.locator('#cmp-add').isVisible(), `${w}: it opens to the search`); await sum.click();
  const take = (await pg.locator('[data-takeaway]').allInnerTexts()).join('\n'); ok(/^Over the last year, price change: TCS [+−]?[\d.]+%, INFY [+−]?[\d.]+%, Nifty 50 [+−]?[\d.]+%\./.test(take) && /Deepest fall from a peak/.test(take) && !/winner|best|worst/i.test(take), `${w}: the comparison takeaway states each change and each deepest fall, with no winner`);
  ok(/Trade-offs on the measured figures/.test(await pg.locator('[data-tradeoffs]').innerText()) && /no overall ranking/.test(await pg.locator('[data-tradeoffs]').innerText()), `${w}: trade-offs are described and no overall winner is declared`);
  await radio(pg, 'Measure', 'DRAWDOWN').click(); await pg.waitForTimeout(150);
  const legend = await pg.locator('.cf-legend').innerText(); ok(/Fall from the running peak/.test(await pg.locator('.cf-h').first().innerText()) && !/\+\d/.test(legend), `${w}: the drawdown view shows only falls (no positive figure)`);
  await radio(pg, 'Measure', 'RETURN').click();
  await pg.locator('.cf-tbl > summary').click(); const cols = await pg.locator('.cf-table thead th').count(); ok(cols === 4, `${w}: the comparison table has a date and one column per line (${cols})`);
  ok((await overflow(pg)) <= 0, `${w}: no horizontal overflow on Compare`);
  await open(pg, '/#/compare?s=TCS,NEWCO', '.cchart svg path'); await radio(pg, 'Range', '3Y').click(); await pg.waitForTimeout(250);
  const notes = await pg.locator('.cf [role=note]').allInnerTexts(); ok(notes.some((n) => /^The window is \d+ months, not 3Y: NEWCO \(from/.test(n)), `${w}: a new listing shortens the window and the note says which name and from when`);
  await ctx.close();
}

/* 9. company sections and the financial panels */
for (const w of [360, 1280]) {
  const ctx = await newCtx(b, w, series(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  ok((await pg.getByRole('tab').allInnerTexts()).join('|') === 'Overview|Financials|Ownership|Risks|Thesis', `${w}: the sections are Overview, Financials, Ownership, Risks, Thesis`);
  ok((await pg.locator('h1').count()) === 1, `${w}: one h1`);
  ok(await pg.locator('.co-tabs [role=tab]').evaluateAll((els) => els.every((e) => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= innerWidth)), `${w}: no section tab label is clipped or wrapped`);
  await pg.getByRole('tab', { name: 'Financials', exact: true }).click(); await pg.waitForSelector('.fin-panel');
  const panels = await pg.locator('.fin-panel').count(); const labels = await pg.locator('.fin-panel').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('.fin-axis span')].map((s) => s.textContent).join(',')));
  ok(panels === 3 && new Set(labels).size === 1, `${w}: revenue, profit and margin panels share the same fiscal years (${labels[0]})`);
  ok(/Revenue went from/.test((await pg.locator('.fin-frame [data-takeaway]').allInnerTexts()).join(' ')), `${w}: the financials takeaway is built from the statements`);
  await pg.locator('.fin-frame .cf-tbl > summary').click(); const trs = await pg.locator('.fin-frame tbody tr').count(); ok(trs === labels[0].split(',').length, `${w}: the table has one row per drawn year (${trs})`);
  ok((await overflow(pg)) <= 0, `${w}: no horizontal overflow on Financials`);
  await pg.getByRole('tab', { name: 'Ownership', exact: true }).click(); ok(/Who owns it|not enough data/i.test(await pg.locator('[role=tabpanel]').innerText()), `${w}: Ownership shows the holding or says there is not enough data`);
  await pg.getByRole('tab', { name: 'Risks', exact: true }).click(); ok(/countercase/i.test(await pg.locator("[role=tabpanel]").innerText()), `${w}: Risks carries the countercase`);
  await pg.getByRole('tab', { name: 'Thesis', exact: true }).click(); ok(/Your thesis/.test(await pg.locator('[role=tabpanel]').innerText()), `${w}: Thesis carries the person's own thesis`);
  ok((await overflow(pg)) <= 0, `${w}: no horizontal overflow on Thesis`);
  await ctx.close();
}


/* 11. owner feedback 2 Nov 2026: at most two control rows on a phone, nothing overlaps or clips from 320 to 430, the action bar does not hide the controls */
for (const w of [320, 360, 390, 430]) {
  const ctx = await newCtx(b, w, series(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  const m = await pg.evaluate(() => {
    const cells = [...document.querySelectorAll('.c-prim .radios button, .c-prim .c-optbtn')].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, txt: e.textContent.trim(), clip: e.scrollWidth > e.clientWidth + 1 }; });
    const rows = new Set(cells.map((c) => Math.round(c.t / 10))).size; const hits = [];
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) { const a = cells[i], c = cells[j]; if (a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1) hits.push(a.txt + '/' + c.txt); }
    const card = document.querySelector('section.cf').getBoundingClientRect();
    return { rows, hits, clipped: cells.filter((c) => c.clip || c.l < card.left - 0.5 || c.r > card.right + 0.5).map((c) => c.txt), sw: document.documentElement.scrollWidth - innerWidth };
  });
  ok(m.hits.length === 0 && m.clipped.length === 0 && m.sw <= 0, `${w}: no control overlaps, clips or overflows (${m.hits.join(',')} ${m.clipped.join(',')} ${m.sw})`);
  ok(m.rows <= (w >= 360 ? 2 : 3), `${w}: the chart shows ${m.rows} control rows by default (${w >= 360 ? 'at most 2' : 'at most 3 at 320'})`);
  await openOptions(pg);
  const sh = await pg.evaluate(() => { const s = document.querySelector('.sheet'); const r = s.getBoundingClientRect(); const bad = [...s.querySelectorAll('button, label')].filter((e) => { const q = e.getBoundingClientRect(); return q.right > r.right + 0.5 || q.left < r.left - 0.5; }).length; return { bad, sw: s.scrollWidth - s.clientWidth, labels: [...s.querySelectorAll('.c-check')].map((e) => e.textContent.trim()) }; });
  ok(sh.bad === 0 && sh.sw <= 1, `${w}: the options sheet has no clipped control (${sh.bad} ${sh.sw})`);
  ok(['50 and 200-day averages', 'Volume', 'RSI (14)', 'Drawdown from the running peak'].every((l) => sh.labels.some((x) => x.startsWith(l))), `${w}: the overlays carry plain labels`);
  await closeOptions(pg); ok(await pg.locator('.sheet').count() === 0, `${w}: Escape closes the sheet`);
  await ctx.close();
}
{ const ctx = await newCtx(b, 390, series(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  await openOptions(pg); await pg.getByRole('checkbox', { name: 'Volume', exact: true }).check(); await pg.getByRole('checkbox', { name: 'RSI (14)', exact: true }).check(); await closeOptions(pg);
  ok(/^Chart options, 2 changed$/.test((await pg.locator('.c-optbtn').getAttribute('aria-label')) ?? '') && (await radio(pg, 'Compare', 'PRICE').getAttribute('aria-checked')) === 'true', 'two overlays: the badge says 2 and the benchmark view switches off');
  const pad = await pg.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom); ok(parseFloat(pad) >= 90, `the page keeps scroll room above the sticky action bar (${pad})`);
  await pg.locator('.c-optbtn').focus(); const vis = await pg.evaluate(() => { const r = document.querySelector('.c-optbtn').getBoundingClientRect(); const f = document.querySelector('.fab-row').getBoundingClientRect(); return r.bottom <= f.top + 1 || r.top >= f.bottom - 1; }); ok(vis, 'a focused chart control is not under the action bar');
  await ctx.close(); }

/* 10. reserved height: the chart card does not change height when the history arrives */
{ const ctx = await newCtx(b, 390, series(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await ctx.route('**/api/chart*', async (r) => { await new Promise((x) => setTimeout(x, 1200)); r.fulfill({ status: 200, contentType: 'application/json', body: series(900, 'TCS', { nifty: true }) }); });
  await pg.goto(base + '/'); await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('section.cf[aria-busy]', { timeout: 20000 }).catch(() => {});
  const h0 = await pg.evaluate(() => document.querySelector('section.cf')?.getBoundingClientRect().height ?? 0); await pg.waitForSelector('.chart-plot', { timeout: 20000 }); const h1 = await pg.evaluate(() => document.querySelector('section.cf').getBoundingClientRect().height);
  ok(h0 > 0 && Math.abs(h1 - h0) < 200, `the chart card holds its place while loading (${Math.round(h0)}px, then ${Math.round(h1)}px)`); await ctx.close(); }

await b.close(); console.log(fails ? `\ncharts: ${fails} failed` : '\ncharts: all passed'); process.exit(fails ? 1 : 0);
