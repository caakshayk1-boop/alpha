// Browser journeys against the served build (default http://localhost:8801). Prints PASS/FAIL per step and exits 1 on any FAIL.
// Usage: node apps/tripwire/tests/journey.mjs [baseUrl] [shotDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:8801';
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, permissions: [] });
const now0 = Math.floor(Date.now() / 1000);
const quote = (prev, px) => ({ t: Array.from({ length: 30 }, (_, i) => now0 - (30 - i) * 300), c: Array.from({ length: 30 }, (_, i) => prev + (px - prev) * (i / 29) + Math.sin(i) * 0.1 * prev * 0.01), px, pt: now0 + 900, prev, live: true });
await ctx.route('**/api/pulse*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', quotes: { NIFTY: quote(24000, 24120), BANKNIFTY: quote(52000, 51800), VIX: quote(14, 14.6) }, missing: [] }) }));
await ctx.route('**/api/factors*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, schema: 'tripwire-factors/1', as_of: '2026-10-23', universe: 700, rows: { TCS: { mom12_1: 80, smooth_fip: 70, eff_ratio60: 20, resid_mom: 55, max5: 90, overnight60: 10 } }, study: { mom12_1: { adopt: false, kind: 'common baseline' }, smooth_fip: { adopt: false, kind: 'candidate' }, eff_ratio60: { adopt: false, kind: 'candidate' }, resid_mom: { adopt: false, kind: 'candidate' }, max5: { adopt: false, kind: 'candidate' }, overnight60: { adopt: false, kind: 'candidate' } } }) }));
const mq = (prev, px) => quote(prev, px);
await ctx.route('**/api/macro*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', quotes: { GOLD: mq(2600, 2650.5), SILVER: mq(30, 31.2), BRENT: mq(80, 79.1), WTI: mq(76, 75.2), USDINR: mq(88.2, 88.5), MYRINR: mq(20.1, 20.2), USDMYR: mq(4.4, 4.38), BTC: mq(67000, 68000) }, missing: [] }) }));
const nowS = Math.floor(Date.now() / 1000);
await ctx.route('**/api/news*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', q: 'q', items: [{ title: 'Sensex ends higher as banks rally; Q2 results in focus', source: 'Mint', url: 'https://example.com/a', t: nowS - 3600, tags: ['Results'], also: 2, sources: ['Mint', 'ET'] }, { title: 'RBI keeps rates unchanged', source: 'Reuters', url: 'https://example.com/b', t: nowS - 7200, tags: ['Regulator'], also: 0, sources: ['Reuters'] }] }) }));
await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"error":"the first nightly run has not happened yet"}' }));
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
const bad = []; pg.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/bars') && !r.url().includes('/api/intraday') && !r.url().includes('/api/chart') && !r.url().includes('/api/ledger')) bad.push(r.status() + ' ' + r.url()); });
const shot = async (n) => { if (shots) await pg.screenshot({ path: `${shots}/${n}.png`, fullPage: false }); };
const text = () => pg.locator('body').innerText();

await pg.goto(base + '/', { waitUntil: 'load' });
ok(await pg.locator('.welcome h1').isVisible(), 'first run shows the welcome screen');
await shot('00-welcome');
await pg.getByRole('button', { name: 'Explore as a guest' }).click();
await pg.waitForSelector('nav.tabs');
ok((await pg.locator('nav.tabs a').allInnerTexts()).map((s) => s.trim()).join('|') === 'Today|Discover|Signals|My Desk|Profile', 'five destinations: Today, Discover, Signals, My Desk, Profile');
await pg.waitForSelector('.rangebar', { timeout: 15000 });
await pg.waitForTimeout(600); await shot('01-today');
ok(/Screen data: close of/.test(await text()), 'Today states the data date');
await pg.waitForSelector('.tile[href*="tradingview.com"]');
ok((await pg.locator('.tile[href*="tradingview.com"]').count()) === 3 && /24,120/.test(await text()) && /Nifty 50/i.test(await text()), 'Today shows the live market strip: Nifty, Bank Nifty and VIX, each opening TradingView');
ok(await pg.locator('.tile[target=_blank][rel*=noopener]').count() >= 3, 'outbound links open in a new tab without handing over the window');
ok(/Open|closed|Pre-open|No live/i.test(await pg.locator('header.bar .sub').innerText()), 'the header states the trading session');
ok(await pg.locator('.rangebar').count() === 1 && /in an uptrend/.test(await text()), 'Today shows the trend map');
ok(!/market gate|conditions pass|What is not met/i.test(await text()), 'Today shows no gate or engine-selection wording');
await pg.waitForFunction(() => /\$2,650\.50/.test(document.body.innerText), null, { timeout: 15000 });
ok(await pg.locator('a.tile[href^="#/m/"]').count() === 8 && /Gold/i.test(await text()) && /\$2,650\.50/.test(await text()) && /88\.50/.test(await text()) && /RM4\.3800/.test(await text()), 'Today shows gold, silver, Brent, WTI, USD/INR, MYR/INR, USD/MYR and Bitcoin with live prices');
await pg.waitForSelector('.news'); ok(/Sensex ends higher/.test(await text()) && /Checked \d\d:\d\d · refreshes every hour/.test(await text()) && /Q2 results|Results/.test(await pg.locator('.news').first().innerText()), 'Today shows market news, its tags, and says it refreshes every hour');
ok(!/delayed/i.test(await text()), 'no price on Today is described as delayed');
ok(/Engine picks/i.test(await text()) && (await pg.locator('.tile', { hasText: 'Paper trade' }).count()) >= 3, 'Today shows swipeable engine pick cards');
await pg.locator('a.contrib').first().click(); await pg.waitForSelector('input.field[type=search]'); await pg.waitForTimeout(300);
ok(/Filters · 2/.test(await text()) && (await pg.locator('.li .tag').count()) > 0, 'a sector on the trend map opens Discover already filtered');
await pg.locator('nav.tabs a[href="#/today"]').click(); await pg.waitForSelector('.rangebar');

// the published risk grade must be a word everywhere: code that compares it with 'HIGH' gets a number backwards (a real bug, 26 Oct 2026)
const scr = await (await fetch(base + '/data/screen.json')).json();
const grades = scr.rows.reduce((a, r) => { a[String(r.risk_lvl)] = (a[String(r.risk_lvl)] ?? 0) + 1; return a; }, {});
ok(Object.keys(grades).every((g) => ['LOW', 'MEDIUM', 'HIGH', 'undefined'].includes(g)) && grades.LOW > 0 && grades.MEDIUM > 0 && grades.HIGH > 0, `every risk grade is LOW, MEDIUM or HIGH (${JSON.stringify(grades)})`);

// Discover → follow → compare → research
await pg.locator('nav.tabs a[href="#/discover"]').click();
await pg.waitForSelector('input.field[type=search]'); await pg.waitForSelector('.li');
const fs = await pg.evaluate(() => ({ field: parseFloat(getComputedStyle(document.querySelector('input.field')).fontSize), body: parseFloat(getComputedStyle(document.body).fontSize), touch: getComputedStyle(document.querySelector('button')).touchAction, vp: document.querySelector('meta[name=viewport]').content }));
ok(fs.field >= 16, `text fields are 16px or more, so iPhone Safari does not zoom the page in on focus (${fs.field}px)`);
ok(fs.body <= 14.5 && fs.touch === 'manipulation', `compact type (${fs.body}px) and no double-tap zoom on controls`);
ok(!/maximum-scale|user-scalable=no/.test(fs.vp), 'pinch zoom stays available (accessibility)');
await pg.getByRole('button', { name: 'Uptrend', exact: true }).click(); await pg.waitForTimeout(250);
const rowsUp = await pg.locator('.li').count(), tagsUp = await pg.locator('.li .tag', { hasText: 'Uptrend' }).count();
ok(rowsUp > 5 && rowsUp === tagsUp, `the Uptrend filter keeps only uptrends and every row is tagged (${rowsUp} rows)`);
await pg.getByRole('button', { name: 'Downtrend', exact: true }).click(); await pg.waitForTimeout(250);
ok(await pg.locator('.li .tag', { hasText: 'Uptrend' }).count() === 0 && await pg.locator('.li .tag', { hasText: 'Downtrend' }).count() > 0, 'the Downtrend filter shows downtrends only');
await pg.getByRole('button', { name: 'Downtrend', exact: true }).click();
await pg.getByLabel('Search companies').fill('tata consultancy');
await pg.waitForTimeout(200);
ok((await pg.locator('.li .sym').first().innerText()).startsWith('TCS'), 'Discover search finds TCS by name');
await shot('02-discover');
await pg.getByRole('button', { name: /^Follow Tata Consultancy/ }).first().click();
ok(/Following TCS/.test(await text()), 'follow gives a clear confirmation');
ok(await pg.getByRole('button', { name: /^Unfollow Tata/ }).first().isVisible(), 'follow state is reflected on the control');
await pg.getByLabel('Search companies').fill('');
await pg.getByRole('button', { name: /^Add to comparison: INFY/ }).first().click().catch(() => {});
await pg.getByLabel('Search companies').fill('infosys'); await pg.waitForTimeout(150);
await pg.getByRole('button', { name: /^Add to comparison: INFY/ }).first().click();
await pg.getByLabel('Search companies').fill('tata consultancy'); await pg.waitForTimeout(150);
await pg.getByRole('button', { name: /^Add to comparison: TCS/ }).first().click();
await pg.getByRole('button', { name: /Compare 2/ }).click();
await pg.waitForSelector('table.tbl'); await pg.waitForTimeout(500);
ok((await pg.locator('th.s').allInnerTexts()).join('|').replace(/\s+/g, '') .includes('INFY') , 'compare shows both companies as column headings');
await shot('03-compare');
await pg.getByRole('button', { name: 'Save comparison' }).click();
ok(/Comparison saved/.test(await text()), 'comparison can be saved');
await pg.getByRole('button', { name: 'Valuation' }).click();
ok(/PE \(trailing\)/.test(await text()), 'compare switches to the valuation view');

await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('.meter', { timeout: 15000 }); await pg.waitForTimeout(500); await shot('04-company');
const t = await text();
ok(/Case and countercase/i.test(t) && /Countercase/.test(t), 'company page has case and countercase');
ok(/(Uptrend|Downtrend|Sideways)/.test(t) && /50-day/.test(t), 'the company page tags its trend and shows the averages behind it');
ok(/Who owns it/i.test(t) && /Seasonality/i.test(t) && /Risk map/i.test(t), 'the company page carries ownership, seasonality and a risk map');
await pg.waitForSelector('text=Indicator fingerprint', { timeout: 10000 });
await pg.locator('summary', { hasText: 'Indicator fingerprint' }).click();
ok(/did not pass the study/.test(await text()) && /description, not as a signal/.test(await text()), 'the indicator fingerprint says which indicators failed the study');
ok((await pg.locator('a[href*="tradingview.com/chart"]').count()) >= 2, 'the company page links to TradingView');
ok(!/Not a live quote|delayed/i.test(t) && /Live price not available|Live|Last price/.test(t), 'the company price does not call itself delayed or not live: it is live, or says a live price is not available');
await pg.waitForSelector('.news'); ok(/Checked \d\d:\d\d/.test(await text()), 'the company page carries its own news');
ok(/Close of /.test(t), 'company price carries its date');

// price chart: ten years of mocked daily closes
const series = () => { const t = [], c = []; let d = Date.UTC(2014, 0, 1, 4) / 1000, px = 100; for (let i = 0; i < 4300; i++) { d += 86400; const wd = new Date(d * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue; px *= 1 + 0.0004 + Math.sin(i / 17) * 0.004; t.push(d); c.push(Math.round(px * 100) / 100); } const n = c.map((_, i) => (i % 40 === 5 ? null : Math.round(10000 * (1 + i * 0.0003) * 100) / 100)); return { ok: true, sym: 'TCS', t, c, n }; };
const feedBody = JSON.stringify(series());
await pg.route('**/api/chart*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: feedBody }));
await pg.goto(base + '/#/c/TCS'); await pg.reload(); await pg.waitForSelector('.chart-plot svg path.c-line', { timeout: 15000 });
ok(/Last 10 years/i.test(await text()) && /a year/.test(await text()), 'chart opens on ten years and states the period return and the yearly rate');
const d0 = await pg.locator('.chart-plot path.c-line').getAttribute('d');
await pg.getByRole('button', { name: 'Max', exact: true }).click();
ok(/Since listing in this data/i.test(await text()), 'Max shows everything held and says it starts at listing');
await pg.getByRole('button', { name: '1Y', exact: true }).click();
ok(/Last year/i.test(await text()) && (await pg.locator('.chart-plot path.c-line').getAttribute('d')) !== d0, 'switching range redraws the line');
await pg.getByRole('button', { name: '10Y', exact: true }).click();
const daily = await pg.locator('.chart-plot path.c-line').getAttribute('d');
await pg.getByRole('button', { name: 'Monthly' }).click();
ok((await pg.locator('.chart-plot path.c-line').getAttribute('d')) !== daily && /[A-Z][a-z]{2} 20\d\d/.test(await pg.locator('.chart').innerText()), 'monthly view uses month-end closes and month labels');
await pg.getByRole('button', { name: 'Log' }).click();
ok(await pg.getByRole('button', { name: 'Log' }).getAttribute('aria-pressed') === 'true', 'log scale can be switched on');
await pg.getByRole('button', { name: 'vs Nifty' }).click();
ok(/against the Nifty/i.test(await pg.locator('.chart-head').innerText()) && /pts/.test(await pg.locator('.chart-head').innerText()) && await pg.locator('.chart-plot path.c-line').count() === 2, 'vs Nifty draws two lines and states the gap in points');
ok(/both indexed to 100/.test(await pg.locator('.chart').innerText()) && /Nifty 50/.test(await pg.locator('.chart').innerText()), 'the comparison is labelled and indexed');
const bx = await pg.locator('.chart-plot').boundingBox(); await pg.mouse.move(bx.x + bx.width * 0.4, bx.y + bx.height / 2);
ok(/Nifty/.test(await pg.locator('.chart-head').innerText()) && await pg.locator('.c-dot').count() === 2, 'scrubbing in compare mode reads both lines');
await pg.getByRole('button', { name: 'Price', exact: true }).click();
const box = await pg.locator('.chart-plot').boundingBox();
await pg.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
const mid = await pg.locator('.chart-head').innerText();
ok(/since the start of this window/.test(mid) && await pg.locator('.c-dot').count() === 1, 'hovering reads out the date, price and move since the start');
await pg.locator('.chart-plot').focus(); await pg.keyboard.press('Home');
const homeTxt = await pg.locator('.chart-head').innerText(); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight');
ok(homeTxt !== (await pg.locator('.chart-head').innerText()) && Number(await pg.locator('.chart-plot').getAttribute('aria-valuenow')) === 2, 'the arrow keys move along the line');
await shot('04b-chart');
// an instrument's own page: its chart, no Nifty line, and the scale explained
await pg.goto(base + '/#/m/GOLD'); await pg.waitForSelector('.chart-plot svg path.c-line', { timeout: 15000 });
ok(/Gold/.test(await pg.locator('h1').innerText()) && await pg.getByRole('button', { name: 'vs Nifty' }).count() === 0 && /Linear scale/.test(await text()) && /\$2,650\.50/.test(await text()), 'the gold page shows its live price and chart without a Nifty line, and explains the scale');
await pg.getByRole('button', { name: 'Log' }).click(); ok(/Log scale: equal steps are equal percentage moves/.test(await text()), 'switching to Log explains what Log does');
ok((await pg.locator('a[href*="tradingview.com"][href*="GOLD"]').count()) >= 1, 'the instrument links to its TradingView chart');
// compare starting from a single company: it asks for the second one instead of dead-ending
await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('.fab-row'); await pg.locator('.fab-row').getByRole('button', { name: /Compare/ }).click();
await pg.waitForSelector('#cmp-add'); ok(/Compare TCS with/.test(await text()), 'Compare from a company page asks which company to put beside it');
await pg.locator('#cmp-add').fill('infosys'); await pg.locator('.pick-row', { hasText: 'INFY' }).first().click();
await pg.waitForSelector('table.tbl'); await pg.waitForSelector('.cchart svg path');
ok(await pg.locator('.cchip').count() === 2 && await pg.locator('.cchart svg path').count() >= 2 && /indexed to 100/.test(await text()), 'the comparison draws both stocks on one indexed chart with a table beneath');
await pg.getByRole('button', { name: 'Remove INFY from the comparison' }).click(); await pg.waitForSelector('text=Add one more to compare with TCS'); ok(true, 'a name can be removed from the comparison');
await pg.unroute('**/api/chart*'); await pg.route('**/api/chart*', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }));
await pg.goto(base + '/#/c/TCS'); await pg.reload(); await pg.waitForSelector('text=Nothing is drawn in its place', { timeout: 15000 });
ok(await pg.locator('.chart-plot').count() === 0, 'a failed price service draws nothing rather than a guess');
await pg.unroute('**/api/chart*');

// paper plan
await pg.getByRole('button', { name: /Paper plan/ }).click();
await pg.waitForSelector('[role=dialog]');
await pg.getByLabel(/^Stop/).fill('999999');
ok(/stop below the entry/i.test(await text()), 'planner refuses a stop above a long entry');
const entry = Number(await pg.getByLabel(/^Entry/).inputValue());
await pg.getByLabel(/^Stop/).fill(String(Math.round(entry * 0.95)));
await pg.waitForSelector('text=Planned risk'); await shot('05-planner');
ok(/Sized by/.test(await text()), 'planner reports which limit bound the quantity');
await pg.getByRole('button', { name: 'Save plan' }).click();
await pg.waitForURL(/desk\?v=plans/); 
ok(/Saved plan/.test(await text()) && !/Paper fill/.test(await text()), 'a saved plan is not shown as a fill');
await shot('06-plans');
await pg.getByRole('button', { name: 'Record paper fill' }).click();
ok(/Paper fill \(you recorded it\)/.test(await text()), 'a paper fill exists only after the user records it');

// thesis → journal → export
await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('.fab-row');
await pg.getByRole('button', { name: /^Thesis$/ }).click();
await pg.getByLabel(/^Thesis: why/).fill('Cash-rich compounder, results in focus');
await pg.getByLabel(/^Wrong if/).fill('Closes below 2,300');
await pg.getByRole('button', { name: 'Save thesis' }).click();
ok(/Thesis saved on this device/.test(await text()), 'thesis save is confirmed and says where it lives');
await pg.goto(base + '/#/desk?v=journal'); await pg.waitForSelector('.card');
ok(/Cash-rich compounder/.test(await text()), 'journal lists the thesis');
await pg.getByText('Cash-rich compounder').click();
await pg.getByLabel(/^Thesis: why/).fill('Cash-rich compounder, results in focus. Reduce if guidance slips.');
await pg.getByRole('button', { name: 'Save as new version' }).click();
await pg.getByText('Cash-rich compounder').first().click();
await pg.getByRole('button', { name: 'History' }).click();
ok((await pg.locator('.sheet .k').allInnerTexts()).some((x) => /Earlier/i.test(x)), 'editing keeps the earlier version in history');
await pg.keyboard.press('Escape');
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: /Export journal/ }).click()]);
ok(dl.suggestedFilename() === 'tripwire-journal.csv', 'journal exports as CSV');
await shot('07-journal');

// signals: three engines, picks, paper tracker with mocked bars
await pg.goto(base + '/#/signals'); await pg.waitForSelector('section[aria-label]'); await shot('08-signals');
ok((await pg.locator('section[aria-label]').count()) === 2, 'signals shows the two active engines (Steady uptrend is retired)');
ok(!/E[1-6]\b|Blocked: data|Alerts are off|lifecycle/i.test(await text()), 'no engine-selection or lifecycle chooser remains');
ok(/Momentum/i.test(await text()) && /Quality at a fair price/i.test(await text()) && !/Steady uptrend/i.test(await pg.locator('section[aria-label]').first().innerText()) && !(await pg.locator('section[aria-label]').allInnerTexts()).some((x) => /Steady uptrend/i.test(x)), 'the two active engines are named and the retired one makes no picks');
const firstPick = await pg.locator('section[aria-label] a .sym').first().innerText().then((s) => s.replace(/^\d+\.\s*/, ''));
await pg.locator('section[aria-label]').first().getByText('How it picks').click();
ok(/Funnel tonight/.test(await text()), 'each engine explains its funnel');
await pg.locator('section[aria-label]').first().getByText('Why it qualified').first().click();
ok(/Close above the 200-day/.test(await text()), 'each pick lists the criteria it passed');
const sym = firstPick;
const day = 86400;
const refTxt = await pg.locator('section[aria-label]').first().locator('.card').nth(1).innerText();
const ref = Number((refTxt.match(/Signal close\s*₹([\d,]+\.?\d*)/) || [])[1]?.replace(/,/g, ''));
ok(ref > 0, `a pick states its signal close (${ref})`);
// bars that begin AFTER the paper trade was taken, near the signal close, never touching the stop: the trade must open and be marked live
const mock = (route) => {
  const u = new URL(route.request().url()); const syms = (u.searchParams.get('s') || '').split(',').filter(Boolean);
  const now = Math.floor(Date.now() / 1000); const bars = {};
  for (const s of syms) { const t = [], o = [], h = [], l = [], c = []; for (let i = 0; i < 4; i++) { t.push(now + (i + 1) * 60); o.push(ref * (1.002 + i * 0.002)); h.push(ref * (1.02 + i * 0.002)); l.push(ref * 0.995); c.push(ref * (1.01 + i * 0.002)); } bars[s] = { t, o, h, l, c, forming: true, live: { px: ref * 1.03, t: now + 5 * 60 } }; }
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: new Date().toISOString(), bars, missing: [] }) });
};
await pg.route('**/api/bars*', mock);
await pg.route('**/api/intraday*', (route) => { const syms = (new URL(route.request().url()).searchParams.get('s') || '').split(',').filter(Boolean); const quotes = {}; for (const s of syms) quotes[s] = quote(ref * 1.0, ref * 1.03); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', quotes, missing: [] }) }); });
await pg.locator('section[aria-label]').first().getByRole('button', { name: 'Paper trade this' }).first().click();
ok(/paper trade taken/i.test(await text()), 'taking a pick confirms it and says it enters at the next open');
await pg.getByRole('tab', { name: /^Mine/ }).click(); await pg.waitForSelector('.card .tag');
await pg.waitForFunction(() => /updated \d+[sm] ago/.test(document.body.innerText), null, { timeout: 15000 });
ok(/Open P&L \(paper\)/i.test(await text()), 'tracker shows paper P&L');
ok(/LIVE/.test(await text()) && /today/i.test(await pg.locator('.card.glass').innerText()), 'the tracker shows a live badge and today\'s P&L');
await pg.locator('.tcard-head').first().click(); await pg.waitForSelector('.ladder');
ok(await pg.locator('.ladder .lv').count() === 5 && await pg.locator('svg[aria-label*="today"]').count() >= 1, 'an expanded trade shows its risk ladder and the day\'s five-minute line');
const wiBefore = await pg.locator('input.slider').evaluate((el) => el.value); await pg.locator('input.slider').evaluate((el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, String(Number(wiBefore) * 0.97));
ok(/Back to live/.test(await text()) && await pg.locator('.ladder .wi').count() === 1, 'the what-if slider moves a marker and states the P&L at that price');
const tvl = pg.locator('a[href*="tradingview.com/chart"]').first(); ok((await tvl.getAttribute('href')).includes('NSE%3A') && (await tvl.getAttribute('target')) === '_blank' && /noopener/.test(await tvl.getAttribute('rel')), 'the trade links to its TradingView chart in a new tab');
ok(!/delayed/i.test(await text()), 'the tracker does not call its prices delayed');
await shot('09-tracker');
ok(/\bOpen\b/.test(await pg.locator('.card .tag').allInnerTexts().then((x) => x.join(' '))), 'the trade opens at the first open after it was taken');
ok(/\blive\b/i.test(await text()) && /session 4 of/i.test(await text()), 'an open trade is marked to the delayed live price and counts its sessions');
ok(/\+₹\d/.test(await pg.locator('.card .num.up').first().innerText().catch(() => '')), 'open P&L is computed and shown with its sign');
ok(/How a trade is followed/.test(await text()) && /next open|first session after/i.test(await text()), 'tracker states its entry and exit rules');
// a failed price service shows an honest error, not a guess
await pg.unroute('**/api/bars*'); await pg.unroute('**/api/intraday*'); await pg.route('**/api/bars*', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' })); await pg.route('**/api/intraday*', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }));
await pg.reload(); await pg.waitForSelector('text=Live prices are unavailable', { timeout: 15000 });
ok(/Nothing is estimated in their place/.test(await text()), 'price outage is stated and nothing is estimated');
await pg.unroute('**/api/bars*'); await pg.unroute('**/api/intraday*');
await pg.goto(base + '/#/signals'); await pg.getByRole('button', { name: /Paper-trade all/ }).click().catch(() => {});

// the forward record: empty, then populated
await pg.route('**/api/ledger*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"error":"the first nightly run has not happened yet"}' }));
await pg.goto(base + '/#/signals?v=record'); await pg.reload(); await pg.waitForSelector('text=The record has not started', { timeout: 15000 });
ok(/Nothing before that night counts/.test(await text()), 'before the first night the record says it has not started');
await pg.unroute('**/api/ledger*');
const led = (() => { const picks = [], outcomes = {}; for (let i = 0; i < 12; i++) { const id = `2026-10-2${i % 8}|MOM|S${i}`; picks.push({ id, engine: 'MOM', sym: 'S' + i, asOf: '2026-10-23', ref: 100, stop: 95, horizon: 20, score: 90, rank: 1 }); outcomes[id] = i < 9 ? { status: 'closed', final: true, r: i % 3 ? 1.2 : -1, pct: 3, niftyPct: 1, reason: 'Time exit after 20 sessions', sessions: 20, exitDay: '2026-11-20' } : { status: 'open', final: false }; }
  return { schema: 'tripwire-ledger/1', started: '2026-10-23', updated: 'x', cost: 0.25, days: [{ asOf: '2026-10-23', recorded: 'x', engines: { MOM: { eligible: 750, passed: 90, picked: 5, skippedWideStop: 1 }, QLT: { eligible: 750, passed: 0, picked: 0, skippedWideStop: 0 }, LVT: { eligible: 750, passed: 3, picked: 3, skippedWideStop: 0 } } }], picks, outcomes }; })();
await pg.route('**/api/ledger*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ledger: led }) }));
await pg.reload(); await pg.waitForSelector('text=of 30 trades closed', { timeout: 15000 }); await shot('09b-record');
ok(/9 of 30 trades closed/.test(await text()), 'the record counts closed trades against the 30 needed');
ok(/stay hidden until 30 trades have closed/.test(await text()) && !/Average R \+|won \d+%/.test(await text()), 'average R and win rate are withheld below thirty trades');
ok(/1 of 1 night with no pick/.test(await text()), 'a night with no pick for an engine is counted');
ok(/forward record/i.test(await text()) && /nothing before the first night counts/i.test(await text()), 'the record says it is forward-only');
// the automatic book follows the same record: every pick taken that night, 30 at a time and ₹1,00,000 each at most
await pg.goto(base + '/#/signals?v=auto'); await pg.reload(); await pg.waitForSelector('.slots', { timeout: 15000 });
ok(/of 30/.test(await text()) && /Taken: S0 \(MOM\), 1000 shares, about ₹1,00,000/.test(await text()), 'the automatic book takes every pick of the record at once, sized to the ₹1,00,000 ticket');
ok(/at most 30 positions at a time and at most ₹1,00,000/.test(await text()) && await pg.locator('.slots i').count() === 30, 'the automatic book states and draws its 30-position limit');
await shot('09c-autobook');
await pg.unroute('**/api/ledger*');

// search
await pg.getByRole('button', { name: 'Search' }).click();
await pg.getByRole('textbox', { name: 'Search' }).fill('roce');
ok(/ROCE/.test(await text()) && /Terms/i.test(await text()), 'global search finds a defined term');
await pg.getByRole('textbox', { name: 'Search' }).fill('infosys');
ok((await pg.locator('.sheet .li b').first().innerText()) === 'INFY', 'global search finds companies');
await shot('10-search'); await pg.keyboard.press('Escape');

// profile
await pg.goto(base + '/#/profile'); await shot('11-profile');
ok(/Sign-in is not available yet/.test(await text()), 'profile is honest that no account exists');
ok(/Not available yet/.test(await text()) && /Free/.test(await text()), 'notifications and billing are shown as unavailable, not faked');
await pg.getByRole('button', { name: /Delete all my data/ }).click();
await pg.getByRole('button', { name: 'Erase now' }).click();
await pg.goto(base + '/#/desk?v=journal');
ok(/No theses yet/.test(await text()), 'deleting data erases the notes');

// offline
await pg.goto(base + '/#/today'); await pg.waitForSelector('.rangebar');
await ctx.setOffline(true); await pg.reload().catch(() => {}); await pg.waitForTimeout(1500);
const offTxt = await text().catch(() => '');
ok(/Offline|Data through|Today/.test(offTxt), 'offline reload still renders from the saved shell and data' + (offTxt ? '' : ' (nothing rendered)'));
await ctx.setOffline(false);

const man = await (await fetch(base + '/manifest.webmanifest')).json();
ok(man.display === 'standalone' && man.icons.some((i) => i.purpose === 'maskable') && (await fetch(base + '/icon-192.png')).ok, 'manifest is standalone with real PNG and maskable icons');
ok((await fetch(base + '/robots.txt').then((r) => r.text())).includes('Disallow: /'), 'robots keeps the app out of search until the owner decides');
ok(await pg.evaluate(() => navigator.serviceWorker?.getRegistrations().then((r) => r.length > 0)), 'service worker is registered');
ok(errs.length === 0, `no script or console errors${errs.length ? ': ' + errs[0] : ''}`);
ok(bad.length === 0, `no failed requests${bad.length ? ': ' + bad[0] : ''}`);
await b.close();
console.log(fails ? `\njourney: ${fails} failed` : '\njourney: all passed');
process.exit(fails ? 1 : 0);
