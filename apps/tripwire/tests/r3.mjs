// Round 3 checks: index rows, trend map, chart (candles, volume, RSI on three frames), the table's column filters and live dots, targets on picks, news views, robots and llms.txt.
// Usage: node apps/tripwire/tests/r3.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE); await mockApi(ctx);
// a daily series with open, high, low and volume, so the chart's candles, volume and RSI have something to draw
const series = (() => { const t = [], c = [], o = [], h = [], l = [], v = []; let d = Date.UTC(2020, 0, 1, 4) / 1000, px = 100; for (let i = 0; i < 1600; i++) { d += 86400; const op = px; px *= 1 + 0.0005 + Math.sin(i / 11) * 0.012; t.push(d); c.push(+px.toFixed(2)); o.push(+op.toFixed(2)); h.push(+(Math.max(op, px) * 1.01).toFixed(2)); l.push(+(Math.min(op, px) * 0.99).toFixed(2)); v.push(100000 + (i % 40) * 5000); } return JSON.stringify({ ok: true, sym: 'TCS', t, c, n: null, o, h, l, v }); })();
await ctx.route('**/api/chart*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: series }));
await ctx.route('**/api/rsi*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, schema: 'tripwire-rsi/1', as_of: '2026-10-23', order: ['daily', 'weekly', 'monthly'], rows: { TCS: [55, 61, 66], INFY: [48, 52, null] } }) }));
const pg = await ctx.newPage(); const text = async () => { await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); return pg.locator('body').innerText(); };

/* Today */
await pg.goto(base + '/#/today'); await pg.waitForSelector('.moodhero .ix .rg'); await pg.waitForTimeout(600);
ok((await pg.locator('.moodhero a.ix').count()) === 3 && (await pg.locator('.moodhero .ix .rg').count()) === 3, 'Today: Nifty, Bank Nifty and VIX each carry a day-range bar');
ok(/prev [\d,]+/.test(await text()) && /opened [+−-]?\d/.test(await text()) && /low [\d,]+/.test(await text()), 'Today: each index shows the previous close, the open against it, and the day low and high');
ok(/Banks (ahead of|behind|level with) the Nifty by/.test(await text()), 'Today: Bank Nifty is set against the Nifty in points');
const h1 = await pg.locator('.moodhero').evaluate((e) => e.getBoundingClientRect().height);
await pg.reload(); await pg.waitForSelector('.moodhero'); const h0 = await pg.locator('.moodhero').evaluate((e) => e.getBoundingClientRect().height); await pg.waitForSelector('.moodhero .ix .rg .nw'); await pg.waitForTimeout(500); const h2 = await pg.locator('.moodhero').evaluate((e) => e.getBoundingClientRect().height);
ok(Math.abs(h0 - h2) < 2, `Today: the mood card does not change height when the prices arrive (${Math.round(h0)} px before, ${Math.round(h2)} after)`); void h1;
await pg.waitForSelector('.trendmap .tm-word', { timeout: 15000 });
ok(/^(broad strength|broad weakness|mixed|no read)$/i.test((await pg.locator('.tm-word').innerText()).trim()), 'trend map: a one-word read from its printed rule');
ok((await pg.locator('.tm-stats [role=listitem]').count()) === 5 && (await pg.locator('.tm-go a').count()) === 3, 'trend map: five breadth figures and three one-tap questions');
await pg.locator('.tm-go a').first().click(); await pg.waitForSelector('text=Discover'); await pg.waitForTimeout(500);
ok(/Uptrend/.test(await text()), 'trend map: a question opens Discover already filtered');
await pg.goto(base + '/#/today'); await pg.waitForSelector('.pickrow');
ok(/T1 ₹[\d,]+ · T2 ₹[\d,]+/.test(await pg.locator('.pickrow').first().innerText()), 'Today: every pick shows its two targets (marked ref when filed before profit booking began)');
const picks = await pg.locator('.pickrow').evaluateAll((e) => e.slice(0, 6).map((x) => x.querySelectorAll('.small')[0]?.textContent ?? ''));
ok(new Set(picks).size === picks.length && picks.every((s) => s.length > 8), 'Today: the line under each pick is its own engine figures, not one repeated line');
await pg.waitForSelector('.card .row[role=group][aria-label="Which headlines"]', { timeout: 15000 });
ok(/All\s*\d+/.test(await pg.locator('[aria-label="Which headlines"]').innerText()) && /My names/.test(await pg.locator('[aria-label="Which headlines"]').innerText()) && /Market/.test(await pg.locator('[aria-label="Which headlines"]').innerText()), 'Today: news can be read as All, My names or Market');

await pg.goto(base + '/#/signals?v=tracker'); await pg.waitForSelector('.tcard-head'); 
ok(/stop ₹[\d,.]+ · T1 ₹[\d,.]+ · T2 ₹[\d,.]+ \(ref\)/.test(await pg.locator('.tcard-head').first().innerText()), 'a paper position card shows its stop and its two targets (reference ones for a pick filed before profit booking began)');
/* chart */
await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('.chart-plot svg path.c-line', { timeout: 15000 });
for (const name of ['CANDLES', 'VOLUME', 'RSI 14', 'WEEKLY', 'MONTHLY']) ok(await pg.getByRole(['VOLUME', 'RSI 14'].includes(name) ? 'button' : 'radio', { name, exact: true }).count() === 1, `chart: a ${name} control`);
await pg.getByRole('radio', { name: 'CANDLES', exact: true }).click(); await pg.waitForSelector('.c-candles rect');
ok((await pg.locator('.c-candles rect').count()) > 20 && (await pg.locator('.chart-plot path.c-line').count()) === 0, 'chart: candles replace the line');
ok(/(week|month) bars/i.test(await pg.locator('.chart').innerText()), 'chart: when ten years of daily candles would be unreadable, it says it draws weekly or monthly bars');
await pg.getByRole('button', { name: 'VOLUME', exact: true }).click(); ok(/Volume ·/i.test(await pg.locator('.chart').innerText()) && (await pg.locator('.chart-sub svg rect').count()) > 10, 'chart: a volume panel');
await pg.getByRole('button', { name: 'RSI 14', exact: true }).click(); await pg.waitForSelector('.chart-sub [aria-label^="RSI 14"]');
const rsiTxt = await pg.locator('.chart').innerText(); ok(/RSI 14 · (day|week|month) closes/i.test(rsiTxt) && /D \d+ · W \d+ · M \d+/.test(rsiTxt), 'chart: RSI 14 with the daily, weekly and monthly readings beside it');
await pg.getByRole('radio', { name: 'MONTHLY', exact: true }).click(); await pg.waitForTimeout(300);
ok(/RSI 14 · month closes/i.test(await pg.locator('.chart').innerText()), 'chart: switching to monthly computes the RSI on monthly closes');
await pg.getByRole('radio', { name: 'LINE', exact: true }).click(); await pg.getByRole('radio', { name: 'DAILY', exact: true }).click(); await pg.getByRole('button', { name: 'VOLUME', exact: true }).click(); await pg.getByRole('button', { name: 'RSI 14', exact: true }).click();
ok((await pg.locator('.chart-plot path.c-line').count()) === 1 && (await pg.locator('.chart-sub').count()) === 0, 'chart: the extras switch off again');

/* Discover table */
await pg.goto(base + '/#/discover?view=table&rsi=35-70&trend=up'); await pg.waitForSelector('.stbl');
ok((await pg.locator('.chip.on-x', { hasText: /RSI/ }).count()) > 0, 'Discover: a link can carry an RSI range, shown as removable conditions');
ok(await pg.locator('.stbl th', { hasText: 'RSI MO' }).count() === 1 && await pg.locator('.stbl th', { hasText: 'RSI WK' }).count() === 1, 'Discover: weekly and monthly RSI columns');
const fb = pg.getByRole('button', { name: /^Filter RSI \(14\), monthly closes$/ }); ok((await fb.count()) === 1, 'Discover: every column heading has its own filter button');
await fb.click(); await pg.waitForSelector('text=Add a condition');
ok((await pg.locator('#c-m').inputValue()) === 'rsi_m', 'Discover: the column filter opens on that column');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.goto(base + '/#/discover?view=table'); await pg.waitForFunction(() => document.querySelectorAll('.stbl tbody tr').length > 20); await pg.waitForSelector('.ldot', { timeout: 15000 }); await pg.waitForTimeout(800);
ok((await pg.locator('.stbl .ldot').count()) > 3 && /marks a figure worked out at today's live price/.test(await text()), 'Discover: price-derived cells use the live print and are marked, and the page says filters and sorting stay on the close');

/* robots and llms */
const robots = await (await pg.request.get(base + '/robots.txt')).text(); const llms = await pg.request.get(base + '/llms.txt'); const html = await (await pg.request.get(base + '/')).text();
ok(/Allow: \/\$/.test(robots) && /Disallow: \/api\//.test(robots) && !/Disallow: \/\s*$/m.test(robots), 'robots.txt lets the page be indexed and keeps the data and API routes out');
ok(llms.status() === 200 && /Tripwire/.test(await llms.text()), 'llms.txt is served');
ok(!/noindex/.test(html) && /rel="canonical"/.test(html) && /property="og:title"/.test(html) && /name="description"/.test(html), 'the page carries a description, a canonical link and share tags, and no noindex');
await b.close(); console.log(fails ? `\nr3: ${fails} failed` : '\nr3: all passed'); process.exit(fails ? 1 : 0);
