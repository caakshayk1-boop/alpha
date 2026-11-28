// The live view of the sector heat map, in a real browser (18 Nov 2026): while the session is on, the 1-day figure is read from live quotes for the most traded names of each sector, says so
// (time, count, share of traded value) and can be switched back to the close; when the market is shut it is not offered. The expected figure is worked out here independently from the screen file.
// Usage: node apps/tripwire/tests/heatlive.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { STATE, mockApi, quoteOf } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const screen = JSON.parse(readFileSync(new URL('./fixtures/screen-2026-10-26.json', import.meta.url), 'utf8'));
const OPEN = new Date('2026-10-26T09:02:00Z'), SHUT = new Date('2026-10-26T16:30:00Z');   // 14:32 IST and 22:00 IST on a trading Monday
const changeOf = (sym) => ((([...sym].reduce((a, c) => a + c.charCodeAt(0), 0) % 9) - 4) / 2);   // -2.0 to +2.0 percent, a pure function of the symbol
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function open(at, w = 1280, age = 20) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, STATE);
  const T = await mockApi(ctx); await ctx.clock.install({ time: at }); const nowS = Math.floor(at.getTime() / 1000);
  const fresh = (prev, px) => ({ ...quoteOf(prev, px), pt: nowS - age, live: true });
  T.pulse = { NIFTY: fresh(22600, 22700), BANKNIFTY: fresh(54000, 54100), VIX: fresh(16, 16.2) };
  T.stock = (s) => { const q = fresh(100, 100 * (1 + changeOf(s) / 100)); return { ...q, px: +(100 * (1 + changeOf(s) / 100)).toFixed(4), prev: 100 }; };
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await pg.goto(base + '/#/markets'); await pg.waitForSelector('[data-sectorheat]', { timeout: 20000 }); await pg.clock.runFor(30000); await pg.waitForTimeout(500);
  return { ctx, pg, errs, T };
}
// independent expectation: top 6 liquid names per sector by turnover; turnover-weighted mean of the live change
const liquid = screen.rows.filter((r) => r.liquid && !r.stale && r.sector && typeof r.turnover_cr === 'number' && r.turnover_cr > 0);
const bySector = new Map(); for (const r of liquid) (bySector.get(r.sector) ?? bySector.set(r.sector, []).get(r.sector)).push(r);
const expect = new Map(); let covered = 0, count = 0; const total = liquid.reduce((a, r) => a + r.turnover_cr, 0);
for (const [sec, g] of bySector) { const top = g.sort((a, b2) => b2.turnover_cr - a.turnover_cr || a.sym.localeCompare(b2.sym)).slice(0, 6); if (top.length < 3) continue; const w = top.reduce((a, r) => a + r.turnover_cr, 0); expect.set(sec, top.reduce((a, r) => a + changeOf(r.sym) * r.turnover_cr, 0) / w); }
for (const g of bySector.values()) for (const r of g.slice(0, 6)) { covered += r.turnover_cr; count++; }

{
  const { ctx, pg, errs } = await open(OPEN);
  const live = pg.locator('[data-heat-live]'); ok(await live.count() === 1, 'session on: the heat map is in its live view');
  const t = await live.innerText(); ok(/Live · \d\d:\d\d IST/.test(t) && /previous close/.test(t) && /left out, not counted as zero/.test(t), `it states its time, its basis and that missing names are left out (${t.slice(0, 90)}…)`);
  const m = /the (\d+) most traded names, (\d+)% of liquid traded value/.exec(t); ok(!!m && +m[1] === count && Math.abs(+m[2] - Math.round((covered / total) * 100)) <= 1, `the count (${m?.[1]} vs ${count}) and the share (${m?.[2]}% vs ${Math.round((covered / total) * 100)}%) match the screen file`);
  const tiles = await pg.locator('[data-sectorheat] .sh-cell').evaluateAll((e) => e.map((x) => [x.querySelector('b').textContent, parseFloat(x.querySelector('.sh-change').textContent.replace('−', '-'))]));
  const bad = tiles.filter(([s, v]) => !expect.has(s) || Math.abs(v - expect.get(s)) > 0.011);
  ok(tiles.length === expect.size && bad.length === 0, `every sector tile equals the independently computed live figure (${tiles.length} tiles${bad.length ? '; off: ' + JSON.stringify(bad.slice(0, 2)) : ''})`);
  // drill into a sector in the live view: at most 6 measured names, so leaders and laggards are split without overlap
  await pg.locator('[data-sectorheat] .sh-cell').first().click(); await pg.waitForSelector('.sh-list.up li');
  const up = await pg.locator('.sh-list.up li a').evaluateAll((e) => e.map((x) => x.getAttribute('href'))), dn = await pg.locator('.sh-list.down li a').evaluateAll((e) => e.map((x) => x.getAttribute('href')));
  ok(up.length === 3 && dn.length === 3 && !up.some((h) => dn.includes(h)), `live drill-down: ${up.length} leaders and ${dn.length} laggards, none in both`);
  const all = /Explore all (\d+) companies/.exec(await pg.locator('.sh-all summary').innerText()); ok(!!all && +all[1] <= 6, `and it lists only the measured names (${all?.[1]})`);
  await pg.getByRole('button', { name: /All sectors/ }).click();
  await pg.getByRole('button', { name: 'Close', exact: true }).click();
  ok(await pg.locator('[data-heat-live]').count() === 0 && /Close of/.test(await pg.locator('[data-sectorheat] .sh-sub').innerText()), 'the Close switch returns the published close figures and their date');
  await pg.getByRole('button', { name: 'Live', exact: true }).click(); ok(await pg.locator('[data-heat-live]').count() === 1, 'and Live returns the live view');
  await pg.getByRole('button', { name: '1W', exact: true }).click(); ok(await pg.locator('[data-heat-mode]').count() === 0 && await pg.locator('[data-heat-live]').count() === 0, 'a longer window has no live view (no live 1-week figure exists)');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll'); ok(errs.length === 0, 'no page errors' + (errs[0] ? ': ' + errs[0] : '')); await ctx.close();
}
{
  // after the close (22:00 IST, prints dated today): the day's last prints are used and said to be so; the same figures, a different label
  const { ctx, pg } = await open(SHUT);
  const live = pg.locator('[data-heat-live]'); ok(await live.count() === 1 && (await live.getAttribute('data-heat-basis')) === 'today', 'market shut, prints dated today: the map shows the day\'s last prints');
  const t = await live.innerText(); ok(/Today's session, market closed/.test(t) && /last prints \d\d:\d\d IST/.test(t) && /published close for today arrives tonight/.test(t) && !/^Live/.test(t), `and says it is not live (${t.slice(0, 100)}…)`);
  ok(await pg.getByRole('button', { name: 'Today', exact: true }).count() === 1 && await pg.getByRole('button', { name: 'Live', exact: true }).count() === 0, 'the switch reads Today / Close, not Live');
  const tiles = await pg.locator('[data-sectorheat] .sh-cell').evaluateAll((e) => e.map((x) => [x.querySelector('b').textContent, parseFloat(x.querySelector('.sh-change').textContent.replace('−', '-'))]));
  ok(tiles.length === expect.size && tiles.every(([s2, v]) => expect.has(s2) && Math.abs(v - expect.get(s2)) <= 0.011), 'its figures equal the independently computed ones');
  await ctx.close();
}
{
  // a weekend (Sat 15:00 IST): prints are from Friday, not today, so the published close stays and no live or today view is offered
  const { ctx, pg } = await open(new Date('2026-10-31T09:30:00Z'), 1280, 86400);
  ok(await pg.locator('[data-heat-live]').count() === 0 && await pg.locator('[data-heat-mode]').count() === 0 && /Close of/.test(await pg.locator('[data-sectorheat] .sh-sub').innerText()), 'a weekend: no live or today view, the close is shown with its date'); await ctx.close();
}
{
  // no quotes answer at all: the map stays on the close, nothing is invented
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, STATE);
  const T = await mockApi(ctx); await ctx.clock.install({ time: OPEN }); const nowS = Math.floor(OPEN.getTime() / 1000);
  T.pulse = { NIFTY: { ...quoteOf(22600, 22700), pt: nowS - 20, live: true }, BANKNIFTY: { ...quoteOf(54000, 54100), pt: nowS - 20, live: true }, VIX: { ...quoteOf(16, 16.2), pt: nowS - 20, live: true } }; T.stock = () => null;
  const pg = await ctx.newPage(); await pg.goto(base + '/#/markets'); await pg.waitForSelector('[data-sectorheat]', { timeout: 20000 }); await pg.clock.runFor(30000); await pg.waitForTimeout(500);
  ok(await pg.locator('[data-heat-live]').count() === 0 && /Close of/.test(await pg.locator('[data-sectorheat] .sh-sub').innerText()), 'no live quote answers: the map stays on the close and says so'); await ctx.close();
}
await b.close(); console.log(fails ? `\nheatlive: ${fails} failed` : '\nheatlive: all passed'); process.exit(fails ? 1 : 0);
