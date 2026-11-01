// Task 3.1 in the browser: the target-hit card is the first thing on Today when a position's T1 or T2 filled in the last completed session, and absent otherwise.
// Usage: node --experimental-strip-types apps/tripwire/tests/hits.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
import { lastFinishedSession } from '../src/calendar.ts';
const base = process.argv[2] ?? 'http://localhost:8821'; let bad = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) bad++; };
const last = lastFinishedSession(Date.now());
const pick = { id: '2026-10-23|MOM|LAURUSLABS', engine: 'MOM', sym: 'LAURUSLABS', asOf: '2026-10-23', ref: 1970, stop: 1833.58, horizon: 20, score: 90, rank: 1, sector: null };
const ledger = (o) => JSON.stringify({ ok: true, ledger: { schema: 'tripwire-ledger/1', started: '2026-10-23', updated: '2026-10-31T01:00:00Z', cost: 0.25, days: [{ asOf: '2026-10-23', recorded: '2026-10-23T12:00:00Z', engines: {} }], picks: [pick], outcomes: { [pick.id]: o } } });
const OPEN = { status: 'open', final: false, entry: 1961.96, entryDay: '2026-10-26', sessions: 5, mark: 2200, r: 1.8, markDay: last };
const b = await chromium.launch();
for (const [name, o, expect] of [['T1 filled in the last completed session', { ...OPEN, t1Hit: true, t1Day: last, t1Px: 2154.53 }, /T1 hit — half booked/], ['no target in the last session', { ...OPEN, t1Hit: true, t1Day: '2026-10-27', t1Px: 2154.53 }, null]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, STATE);
  await mockApi(ctx);
  await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ledger(o) }));
  const pg = await ctx.newPage(); await pg.goto(`${base}/#/today`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  const card = pg.locator('[data-sec="hits"]');
  if (expect) {
    ok(await card.count() === 1, `${name}: the card is shown`);
    const txt = await card.innerText(); ok(expect.test(txt) && /LAURUSLABS/.test(txt) && /2,154\.53/.test(txt), `${name}: names the position, the level and the fill (${txt.replace(/\s+/g, ' ').slice(0, 120)})`);
    ok(/nothing is sent to you/i.test(txt) && !/notified|we will tell|email/i.test(txt), `${name}: says plainly that nothing is sent`);
    const firstSec = await pg.locator('.today > section[data-sec]').first().getAttribute('data-sec'); ok(firstSec === 'hits', `${name}: it is the top content card (the hero above it is not a section) (first section is ${firstSec})`);
  } else ok(await card.count() === 0, `${name}: no card`);
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAILED` : 'hits: all passed'); process.exit(bad ? 1 : 0);
