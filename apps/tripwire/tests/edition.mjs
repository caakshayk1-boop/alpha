// Vision phase 1 (18 Nov 2026): the welcome screen's live ledger sentence, the gate as the centrepiece of its page, and the daily edition. Ledger and signals are mocked with known figures.
// AUTOMATED checks. Usage: node apps/tripwire/tests/edition.mjs [baseUrl]
import { chromium } from 'playwright';
import { mockApi, STATE } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const mkp = (asOf, engine, sym) => ({ id: `${asOf}|${engine}|${sym}`, engine, sym, asOf, ref: 100, stop: 90, horizon: 10, score: 1, rank: 1 });
const ledger = { ok: true, ledger: { schema: 'tripwire-ledger/1', started: '2026-11-13', updated: '2026-11-16T21:40:00.000Z', cost: 0.25,
  days: [{ asOf: '2026-11-13', recorded: '2026-11-13T18:49:00Z', rules: 'elig-2', engines: { MOM: { eligible: 400, passed: 27, picked: 5, skippedWideStop: 1 } } }, { asOf: '2026-11-16', recorded: '2026-11-16T21:38:00Z', rules: 'elig-2', engines: { MOM: { eligible: 438, passed: 30, picked: 5, skippedWideStop: 1 } } }],
  picks: [mkp('2026-11-13', 'MOM', 'AAA'), mkp('2026-11-16', 'MOM', 'AAA'), mkp('2026-11-16', 'MOM', 'BBB')], outcomes: {}, voided: { '2026-11-16|MOM|BBB': 'Test reason for a void.' } } };
const signals = { schema: 'alpha-signals/2', version: 'x', generated: '2026-11-17T00:00:00Z', data_through: '2026-11-16', alertable: false, alert_why: 'Alerts off.', signals: [],
  gate: { date: '2026-11-16', on: false, passed: 2, checks: [{ rule: 'Nifty above its 50-day average', ok: true, value: 'Nifty 25,291 · 50-day 23,356' }, { rule: 'At least 50% of stocks above their own 50-day average', ok: false, value: '47% above' }, { rule: 'India VIX at or below 20', ok: true, value: 'VIX 15.7' }, { rule: 'Nifty above its 200-day average, and that average rising over 20 sessions', ok: false, value: 'Nifty 25,291 · 200-day 23,992' }] },
  gate_history: [{ d: '2026-11-12', on: false }, { d: '2026-11-14', on: false }, { d: '2026-11-16', on: false }] };
const b = await chromium.launch();
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const open = async (path, seeded) => {
    const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block' }); await mockApi(ctx);
    await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ledger) }));
    await ctx.route('**/data/signals.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(signals) }));
    if (seeded) await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, STATE);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); await pg.goto(base + path); return { ctx, pg, errs };
  };
  { const { ctx, pg, errs } = await open('/', false); await pg.waitForSelector('[data-ledger-line]');
    await pg.waitForFunction(() => /2 nights recorded/.test(document.querySelector('[data-ledger-line]')?.textContent ?? ''), null, { timeout: 15000 });
    const t = await pg.locator('[data-ledger-line]').innerText();
    ok(/2 nights recorded, 3 paper picks, swing gate off for 3 published days/.test(t), `${name}: the welcome sentence is the ledger's own counts (${t.replace(/\s+/g, ' ').slice(0, 110)})`);
    ok(await pg.locator('[data-ledger-line] a[href="#/edition"]').count() === 1, `${name}: it links to the edition`);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no sideways scroll on the welcome screen`);
    ok(errs.length === 0, `${name}: no page errors (${errs.join('; ')})`); await ctx.close(); }
  { const { ctx, pg, errs } = await open('/#/gate', true); await pg.waitForSelector('[data-gate-hero]'); const t = await pg.locator('[data-gate-hero]').innerText();
    ok(/The gate is off/.test(t) && /2 of 4 market checks pass/.test(t), `${name}: the gate hero states off and 2 of 4`);
    ok(/Nearest to passing:.*50%.*3 points short of 50%/s.test(await pg.locator('[data-gate-near]').innerText()), `${name}: the nearest failing check is breadth, 3 points short`);
    ok(/Also failing: Nifty above its 200-day/.test(t) && !/200-day average, and that average rising over 20 sessions \(/.test(t), `${name}: the check with no published distance is listed without an invented one`);
    ok(/3 of 3 published days the gate was off/.test(await pg.locator('[data-gate-run]').innerText()), `${name}: the run count is from the published days`);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no sideways scroll on the gate page`);
    ok(errs.length === 0, `${name}: no page errors`); await ctx.close(); }
  { const { ctx, pg, errs } = await open('/#/edition', true); await pg.waitForSelector('[data-edition]'); const t = await pg.locator('[data-edition]').innerText();
    ok(await pg.locator('[data-edition]').getAttribute('data-edition') === '2026-11-16', `${name}: the latest night opens by default`);
    ok(/2 paper picks recorded, 25 rule passes not picked/.test(t), `${name}: headline counts match the ledger (2 picks; 30 passed minus 5 picked)`);
    ok(/Test reason for a void/.test(t) && /Corrected, not deleted/.test(t), `${name}: a void is shown with its reason`);
    ok(await pg.locator('.ed-picks li', { hasText: 'BBB' }).locator('.chip').count() === 1 && await pg.locator('.ed-picks li', { hasText: 'AAA' }).locator('.chip').count() === 0, `${name}: only the name new to its engine is marked new`);
    ok(/The swing gate was off on this night/.test(t), `${name}: the gate for that night comes from the published history`);
    await pg.getByRole('link', { name: /13 Nov/ }).first().click(); await pg.waitForFunction(() => document.querySelector('[data-edition]')?.getAttribute('data-edition') === '2026-11-13');
    ok(/The published gate history has no entry for this night/.test(await pg.locator('[data-edition]').innerText()), `${name}: a night with no gate entry says missing, not off`);
    await pg.goto(base + '/#/edition?d=2026-01-01'); await pg.waitForSelector('text=no night recorded for 2026-01-01');
    ok(true, `${name}: an unknown night says so`);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no sideways scroll on the edition`);
    ok(errs.length === 0, `${name}: no page errors (${errs.join('; ')})`); await ctx.close(); }
}
await b.close(); console.log(fails ? `${fails} FAILED` : 'edition: all passed'); process.exit(fails ? 1 : 0);
