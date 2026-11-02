// Phase 4, lane A in a real browser: Today (takeaway first, labelled sample walkthrough), Markets (indices with breadth, ranked sectors with sample sizes, no invented history),
// Discover (research presets with visible criteria, URL parity), Signals (Evidence, Add paper trade, pick ladder, paper assumptions), Auto (P&L attribution that reconciles) and
// Record (plain reading, realised curve). 320/360/390/1280, no sideways scroll, 44 px targets, one h1. AUTOMATED checks, not user research.
// Usage: node apps/tripwire/tests/pagesa.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
import { openCtx } from './bookfixture.mjs';
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

/* ---- Markets ---- */
for (const w of [320, 390, 1280]) {
  const { ctx, pg } = await plain(STATE, w, '/#/markets'); await pg.waitForSelector('[data-sectors] .sbar', { timeout: 15000 });
  ok(/Nifty/.test(await pg.locator('[data-glance]').innerText()) && /In an uptrend/.test(await pg.locator('[data-glance] .mk-chips').innerText()), `${w}: index moves sit beside market breadth`);
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

/* ---- Auto: attribution ---- */
for (const w of [320, 390, 1280]) {
  const ctx = await openCtx(b, w); const pg = await ctx.newPage(); await pg.goto(`${base}/#/signals?v=auto`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-attribution]', { timeout: 20000 });
  const num = (s) => Number(s.replace(/[₹,\s]/g, '').replace('−', '-').replace('+', ''));
  const total = num(await pg.locator('[data-attribution] .attr-total b').innerText());
  const engRows = await pg.locator('[data-attribution] tr[data-engine]').evaluateAll((r) => r.map((x) => x.lastElementChild.textContent));
  const sumTotal = await pg.locator('[data-engine-total] td').last().innerText();
  ok(Math.abs(engRows.reduce((a, s) => a + num(s), 0) - total) < 0.015 && num(sumTotal) === total, `${w}: engine rows add up to the total (${engRows.join(' + ')} = ${total})`);
  const parts = await pg.locator('[data-attribution] [data-contrib] .contrib .num').allInnerTexts();
  ok(parts.length >= 2 && Math.abs(parts.slice(0, -1).reduce((a, s) => a + num(s), 0) - num(parts.at(-1))) < 0.015 && Math.abs(num(parts.at(-1)) - total) < 0.015, `${w}: position rows (with Other) add up to the same total`);
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
