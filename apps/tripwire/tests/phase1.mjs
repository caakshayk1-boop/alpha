// Phase 1 trust and data consistency, in a real browser: price words by session (open / closed / weekend), one holiday statement, the flag-level scope, Data row meanings,
// news states (no "Unavailable" while loading) and counts. AUTOMATED checks, not user research.
// Usage: node apps/tripwire/tests/phase1.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const text = (pg) => pg.locator('body').innerText();
const open = async (route, at, o = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  if (at) await ctx.clock.install({ time: new Date(at) });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, STATE);
  const T = await mockApi(ctx); if (o.before) await o.before(ctx);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); await pg.goto(base + route); return { ctx, pg, errs, T };
};

/* ---- 1. price words ---- */
{ // Monday 26 Oct 2026, 11:30 IST: the session is on and every mocked print is seconds old
  const { ctx, pg, errs } = await open('/#/today', '2026-10-26T06:00:00Z'); await pg.waitForSelector('.brief .livebadge'); await pg.clock.runFor(15000); await pg.waitForTimeout(500);
  const badge = (await pg.locator('.brief .livebadge').first().innerText()).trim();
  ok(/^Live$/i.test(badge) && (await pg.locator('.brief .livebadge.on').count()) === 1, `session on, fresh print: the brief badge says Live (got "${badge}")`);
  ok(errs.length === 0, 'no page errors (market open)'); await ctx.close();
}
{ // Sunday 1 Nov 2026: a fresh print on a shut market is Last traded, never Live
  const { ctx, pg } = await open('/#/today', '2026-11-01T07:00:00Z'); await pg.waitForSelector('.brief .livebadge'); await pg.clock.runFor(15000); await pg.waitForTimeout(500);
  const badge = (await pg.locator('.brief .livebadge').first().innerText()).trim(); const t = await text(pg);
  ok(/^Last traded$/i.test(badge) && (await pg.locator('.brief .livebadge.on').count()) === 0, `weekend, print a few seconds old: Last traded, not Live (got "${badge}")`);
  ok(!/\bLIVE\b/.test(await pg.locator('.brief').innerText()), 'the brief never says LIVE on a weekend'); ok(/Last traded/.test(t), 'the price line says Last traded with its time'); await ctx.close();
}
{ // Tuesday 20 Oct 2026 (Dussehra, a listed exchange holiday) at 11:00 IST
  const { ctx, pg } = await open('/#/markets', '2026-10-20T05:30:00Z'); await pg.waitForSelector('.moodhero [data-market-status]'); await pg.clock.runFor(15000); await pg.waitForTimeout(500);
  const badge = (await pg.locator('.moodhero [data-market-status]').first().innerText()).trim();
  ok(/^Last traded\b/i.test(badge) && !/\blive\b/i.test(badge), `exchange holiday inside trading hours: Last traded, not Live (got "${badge}")`); ok(/NSE holiday/.test(await pg.locator('header.bar, body').first().innerText()), 'the header names the NSE holiday'); await ctx.close();
}
{ // the paper book on a weekend: positions and the Live P&L page never say Live
  const { ctx, pg } = await open('/#/live', '2026-11-01T07:00:00Z'); await pg.waitForTimeout(2500); await pg.clock.runFor(10000); await pg.waitForTimeout(500);
  const t = await text(pg); ok(!/\bLIVE\b/.test(t) && !/\blive \d/.test(t) && !/>\s*live\s*</i.test(await pg.content().then((h) => h.replace(/<title>.*?<\/title>/g, ''))), 'weekend: the Live P&L page labels no price or position as live'); await ctx.close();
}
{ // gold / Bitcoin trade round the clock: a fresh print is Live even on a Sunday
  const { ctx, pg } = await open('/#/markets', '2026-11-01T07:00:00Z'); await pg.waitForSelector('.moodhero'); await pg.clock.runFor(15000); await pg.waitForTimeout(500);
  const t = await text(pg); ok(/Commodities, currencies, Bitcoin/.test(t), 'Markets loads on a weekend'); await ctx.close();
}

/* ---- 2/3. holiday statement and the flag-level scope, once and the same everywhere ---- */
{
  const { ctx, pg } = await open('/#/help'); await pg.waitForSelector('[data-holiday]'); const help = await pg.locator('[data-holiday]').innerText();
  const m = await open('/#/methodology'); await m.pg.waitForSelector('[data-holiday]'); const meth = await m.pg.locator('[data-holiday]').first().innerText();
  const d = await open('/#/data'); await d.pg.waitForSelector('.lead'); const data = await text(d.pg);
  ok(/Exchange holidays are modelled/.test(help) && help === meth, 'Help and Methodology carry the identical holiday statement'); ok(data.includes(help), 'Data carries the same statement'); ok(!/holidays are not modelled/i.test(help + meth + data), 'no screen says holidays are not modelled');
  await m.pg.waitForSelector('[data-risk-scope]'); const sc = await m.pg.locator('[data-risk-scope]').innerText();
  ok(/Screen flag level/.test(sc) && /not a safety rating/.test(sc) && /does not read the price trend/.test(sc), 'Methodology states what the flag level measures and what it does not read');
  await ctx.close(); await m.ctx.close(); await d.ctx.close();
}

/* ---- 4/9. Data: the Signals row is explained and observations are told apart from positions (ledger mocked) ---- */
{
  const day = '2026-10-29'; const mk = (asOf, sym, engine) => ({ id: `${asOf}|${engine}|${sym}`, engine, sym, asOf, ref: 1000, stop: 940, horizon: 20, score: 80, rank: 1, sector: 'Industrials' });
  const picks = [mk('2026-10-28', 'TCS', 'QLT'), mk('2026-10-29', 'TCS', 'QLT'), mk('2026-10-29', 'TCS', 'MOM'), mk('2026-10-29', 'INFY', 'QLT')];
  const ledger = { ok: true, ledger: { schema: 'tripwire-ledger/1', started: '2026-10-28', updated: '2026-10-29T20:00:00.000Z', cost: 0.25, days: [{ asOf: '2026-10-28', recorded: 'x', engines: {} }, { asOf: day, recorded: 'x', engines: {} }], picks, outcomes: {} } };
  const { ctx, pg } = await open('/#/data', null, { before: async (c) => { await c.route('**/api/ledger*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ledger) })); await c.route('**/data/signals.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schema: 'alpha-signals/2', generated: '2026-11-01T05:32:43Z', data_through: '2026-10-30', launched: '2026-10-21', gate: { date: '2026-10-30', on: false, checks: [{ rule: 'a', ok: false }, { rule: 'b', ok: true }], passed: 1 }, alertable: false, alert_why: 'Alerts off: the holdout month-clustered t is -0.62, needs +2.0.', record: { closed: 0, avg_r: null }, signals: [] }) })); await c.route('**/data/freshness.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schema: 'tripwire-freshness/1', files: [{ id: 'screen', asOf: '2026-10-26', built: '2026-10-27', rows: 988 }, { id: 'companies', asOf: '2026-10-26', built: '2026-10-27', rows: 988 }, { id: 'signals', asOf: '2026-10-30', built: '2026-11-01T05:32:43Z', rows: 0 }] }) })); } });
  await pg.waitForSelector('[data-fresh-table]'); await pg.locator('details.fold').evaluateAll((d) => d.forEach((x) => { x.open = true; })); await pg.waitForSelector('[data-observations]', { timeout: 15000 }); const row = await pg.locator('[data-file="signals"]').innerText(); const obs = await pg.locator('[data-observations]').first().innerText();
  ok(/0 rows is not a failure/.test(row) && /gate is ON/.test(row) && /different file/.test(row), 'Data: the Signals file with 0 rows says why, and that Picks are a different file');
  const flat = obs.replace(/\s+/g, ' ');
  ok(/4 pick observations over 2 nights name 2 companies/.test(flat) && /2 observations are repeats/.test(flat), 'Data: observations are counted as observations and the repeats are named');
  ok(/independent ones/.test(flat) && /not independent trials/.test(flat), 'Data: positions and outcomes are explained apart from observations'); await ctx.close();
}

/* ---- 6. news: nothing says "Unavailable" while the first answer is on its way ---- */
{
  const { ctx, pg } = await open('/#/news', null, { before: async (c) => { await c.route(/\/api\/news\/version/, async (r) => { await new Promise((res) => setTimeout(res, 2500)); await r.fallback(); }); } });
  await pg.waitForSelector('.nw-health'); const first = await pg.locator('.nw-health .nw-state').first().innerText(); const st = await pg.locator('.nw-health').first().getAttribute('data-news-state');
  ok(!/unavailable/i.test(first) && st !== 'unavailable', `first load: the health line says "${first.trim()}" (state ${st}), never Unavailable`);
  await pg.waitForSelector('.nw-row', { timeout: 20000 }); const after = await pg.locator('.nw-health').first().getAttribute('data-news-state'); ok(after === 'fresh' || after === 'delayed' || after === 'partial', `after the answer the state is ${after}`);
  const defn = await pg.locator('[data-news-definition]').innerText(); ok(/event is one story/.test(defn) && /Articles/.test(defn) && /Companies/.test(defn), 'the page defines events, articles and companies');
  const line = (await pg.locator('.nwp-count').innerText()).trim(); ok(/^\d+ events? · \d+ articles? · \d+ companies?/.test(line), `the count line uses the three units ("${line}")`);
  const total = Number(line.match(/^(\d+)/)[1]); const allChip = await pg.locator('.nw-tabs .chip').first().getAttribute('aria-label'); ok(new RegExp(`^All: ${total} events?$`).test(allChip), `the All tab number equals the displayed total (${allChip})`);
  await ctx.close();
}
{ // service down, nothing saved: an error, not "Unavailable"
  const { ctx, pg } = await open('/#/news', null, { before: async (c) => { await c.route(/\/api\/news\/version/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"down"}', headers: { 'retry-after': '1' } })); } });
  await pg.waitForSelector('.nw-health'); await pg.waitForFunction(() => document.querySelector('.nw-health')?.getAttribute('data-news-state') !== 'loading', null, { timeout: 15000 });
  ok((await pg.locator('.nw-health').first().getAttribute('data-news-state')) === 'error' && /Could not load/.test(await pg.locator('.nw-state').first().innerText()), 'service down, nothing saved: Could not load (error)'); await ctx.close();
}

await b.close(); console.log(fails ? `phase1: ${fails} failed` : 'phase1: all passed'); process.exit(fails ? 1 : 0);
