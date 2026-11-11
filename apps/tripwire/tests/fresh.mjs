// 3.2 in a real browser: the freshness pill on Today and the per-file table on the Data screen, judged by the one module with the clock pinned to the evening of the screen's data day.
// Usage: node apps/tripwire/tests/fresh.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi, SCREEN_DAY } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
const scr = await (await fetch(base + '/data/screen.json')).json(); const DAY = SCREEN_DAY;   // the screen the app is served is the FROZEN fixture (mockApi), not whatever the server holds today
const prevSession = (d) => { const t = new Date(d + 'T00:00:00Z'); do t.setUTCDate(t.getUTCDate() - 1); while ([0, 6].includes(t.getUTCDay())); return t.toISOString().slice(0, 10); };
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const open = async (route, { ledgerDay, rsiDay, factorsDay, breadthDay }) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, STATE);
  await mockApi(ctx); await ctx.clock.setFixedTime(new Date(`${DAY}T17:30:00Z`));       // 23:00 IST on the data day: the close of DAY is the last finished session
  await ctx.route('**/data/freshness.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'screen', asOf: DAY, built: scr.built_at ?? null, rows: scr.count }, { id: 'companies', asOf: DAY, built: scr.built_at ?? null, rows: scr.count }, { id: 'signals', asOf: DAY, built: null, rows: 3 }] }) }));   // the static half, pinned: this test is about the pill, not today's signals file
  const L = (d) => ({ ok: true, ledger: { schema: 'tripwire-ledger/1', started: '2026-10-20', updated: `${d}T18:30:00Z`, cost: 0.25, days: [{ asOf: d, rules: 'elig-2', at: `${d}T18:30:00Z`, picks: 0 }], picks: [], outcomes: {} } });
  await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(L(ledgerDay)) }));
  await ctx.route('**/api/rsi*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, schema: 'tripwire-rsi/1', as_of: rsiDay, order: ['daily', 'weekly', 'monthly'], rows: { TCS: [55, 61, 66] } }) }));
  await ctx.route('**/api/factors*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, schema: 'tripwire-factors/1', as_of: factorsDay, universe: 500, rows: {}, study: {} }) }));
  await ctx.route('**/api/breadth*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, t: Date.now(), as_of: breadthDay ?? DAY, n: 500, up: 200, mixed: 150, down: 150, sectors: [], repriced: 0, near: 0 }) }));   // pinned like the rest: the pill test must not depend on what the live worker serves
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); await pg.goto(base + route); return { ctx, pg, errs };
};
const same = { ledgerDay: DAY, rsiDay: DAY, factorsDay: DAY };
{
  const { ctx, pg, errs } = await open('/#/today', same); await pg.waitForSelector('[data-fresh="ok"], [data-fresh="stale"], [data-fresh="pending"]', { timeout: 15000 });
  const p = pg.locator('.fresh-pill').first(); const t = await p.innerText(); const tone = await p.getAttribute('data-fresh');
  ok(/^Data through (Mon|Tue|Wed|Thu|Fri) \d+ \w{3}( · built \d\d:\d\d IST)?/.test(t), `the pill names the data day (and the build time when the feed has it): "${t}"`);
  ok(!/\blive\b/i.test(t), 'a close is never called live');
  ok(tone !== 'stale', `with every file on ${DAY} the pill is not amber (got ${tone})`);
  ok(errs.length === 0, 'no page errors' + (errs[0] ? ': ' + errs[0] : '')); await ctx.close();
}
{
  const { ctx, pg } = await open('/#/today', { ledgerDay: prevSession(prevSession(DAY)), rsiDay: prevSession(prevSession(DAY)), factorsDay: DAY }); await pg.waitForSelector('[data-fresh="stale"]', { timeout: 15000 });
  // 11 Nov 2026 (revamp v2): on Today the file-by-file detail is folded into one collapsed "Data status" line at the foot; open it to read which files are behind
  await pg.locator('.t-status > summary').click(); const t = await pg.locator('.t-status').innerText();
  ok(/Forward record 2 sessions behind/.test(t) && /RSI sheet 2 sessions behind/.test(t), `amber, and in words which files: "${t.slice(0, 160)}"`);
  const colour = await pg.locator('.fresh-pill').first().evaluate((e) => getComputedStyle(e).color); ok(colour !== 'rgb(184, 239, 67)', 'the stale pill is not the lime of a healthy one'); await ctx.close();
}
{
  const { ctx, pg } = await open('/#/data', { ledgerDay: prevSession(prevSession(DAY)), rsiDay: DAY, factorsDay: DAY }); await pg.waitForSelector('[data-fresh-table] tbody tr[data-file]', { timeout: 15000 });
  await pg.waitForFunction(() => document.querySelectorAll('[data-fresh-table] tr[data-file]').length >= 7, null, { timeout: 15000 });
  const rows = await pg.$$eval('[data-fresh-table] tr[data-file]', (n) => n.map((r) => ({ id: r.getAttribute('data-file'), cells: [...r.children].map((c) => c.textContent.trim()) })));
  ok(rows.map((r) => r.id).join() === 'screen,companies,signals,breadth,ledger,rsi,factors', `one row per file in order (${rows.map((r) => r.id).join()})`);
  const by = Object.fromEntries(rows.map((r) => [r.id, r.cells])); ok(/Current/.test(by.screen[4]) && /Behind/.test(by.ledger[4]) && /2 sessions behind/.test(by.ledger[4]), `the table marks the ledger behind and the screen current (${by.ledger[4]})`);
  ok(/\d/.test(by.screen[3]) && by.screen[1].includes('close'), 'rows and as-of are printed'); await ctx.close();
}
await b.close(); process.exit(fails ? 1 : 0);
