// Reliability in the browser, against the served build with every endpoint mocked: backup and restore through the real screens, a damaged file refused with its reason and nothing changed,
// restart (a new browser context holding the same storage), a failed save (quota) with the banner, the kept state and the immediate export, unreadable saved data kept and downloadable,
// the on-demand news refresh when the scheduled check is late (one vocabulary: published / checked / on demand), and service honesty on Operations and Settings.
// These are AUTOMATED checks on mocked responses. They say nothing about the live sources, a real iPhone, or Safari's storage rules.
// Usage: node apps/tripwire/tests/reliability.mjs [baseUrl]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STATE, mockApi } from './fixtures.mjs';
import { mockNews, makeEvents, makeSnapshot, statusOf } from './newsmock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch(); const tmp = mkdtempSync(join(tmpdir(), 'tw-rel-'));
const KEY = 'tripwire:v1';
const v = (at, o) => ({ at, thesis: 'Steady compounder', support: 'ROCE 60%', counter: 'Slow growth', decision: 'watch', invalidation: 'Close below 2,400', trigger: 'Results', reviewOn: '2026-11-30', ...o });
const PREFS = { motion: 'auto', haptics: false, horizon: '', experience: '', interests: ['Energy'], equity: 2500000, cash: 900000, riskPct: 1, maxPositionPct: 15, hideAmounts: true };
const RICH = { ...STATE, follows: ['TCS', 'GCSL'], prefs: PREFS,
  entries: [{ id: 'x1', sym: 'TCS', created: '2026-10-01T00:00:00Z', archived: false, versions: [v('2026-10-01T00:00:00Z', {}), v('2026-10-10T00:00:00Z', { thesis: 'Steady compounder, but pricey' }), v('2026-10-20T00:00:00Z', { decision: 'plan', invalidation: 'Close below 2,350', question: 'Will margins hold?' })] }],
  plans: [{ id: 'pl1', sym: 'TCS', at: '2026-10-21T10:00:00.000Z', status: 'saved', entry: 2530, stop: 2400, qty: 38, riskPct: 0.5, expiry: null, rev: 2, note: 'after results' }],
  compares: [['TCS', 'INFY']], screens: [{ name: 'Quality, cheap', f: { q: '', sector: '', tier: '', value: 'cheap', quality: 'high', momentum: '', trend: '', cond: [] } }],
  reviews: [{ week: '2026-W43', note: 'kept to the plan' }], snaps: { TCS: [{ at: '2026-10-23T10:00:00.000Z', day: '2026-10-23', px: 2530, rsi: 55, rs3m: 3, from_high: -20 }] },
  seen: { TCS: [{ at: '2026-10-20T10:00:00.000Z', day: '2026-10-20', px: 2500, rsi: 60 }] }, inbox: [{ id: 'TCS|rsi|up70|2026-10-23', sym: 'TCS', kind: 'rsi', title: 'RSI crossed 70', before: 'RSI 65', after: 'RSI 72', basis: 'Screen data', prevDay: '2026-10-20', curDay: '2026-10-23', prevAt: '2026-10-20T10:00:00.000Z', curAt: '2026-10-27T10:00:00.000Z' }], dismissed: { 'a|b|c': '2026-10-27T10:05:00.000Z' } };
const CLEAN = { v: 1, follows: [], entries: [], plans: [], compares: [], screens: [], snaps: {}, onboarded: true, reviews: [], paper: [], prefs: { motion: 'off', motionV: 2, haptics: true, horizon: '', experience: '', interests: [], equity: 1000000, cash: 1000000, riskPct: 0.5, maxPositionPct: 15 } };   // a fresh install: the app's own defaults
const mk = async (state, o = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: 'block', ...(o.storageState ? { storageState: o.storageState } : {}) });
  if (state) await ctx.addInitScript(([s, key]) => { try { if (!sessionStorage.getItem('twseed')) { sessionStorage.setItem('twseed', '1'); localStorage.setItem(key, JSON.stringify(s)); } } catch { /* blocked */ } }, [state, KEY]);
  if (o.init) await ctx.addInitScript(o.init);
  if (o.at) await ctx.clock.install({ time: new Date(o.at) });
  await mockApi(ctx); const ctl = await mockNews(ctx, o.news ?? {}); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  return { ctx, pg, ctl, errs };
};
const text = async (pg) => { await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); return pg.locator('body').innerText(); };
const saved = (pg) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
const raw = (pg) => pg.evaluate((k) => localStorage.getItem(k), KEY);
const settings = async (pg) => { await pg.goto(base + '/#/profile'); await pg.waitForSelector('text=Export all (JSON)', { timeout: 20000 }); };
const importFile = async (pg, name, buf) => { await pg.setInputFiles('input[type=file]', { name, mimeType: 'application/json', buffer: Buffer.isBuffer(buf) ? buf : Buffer.from(buf) }); await pg.waitForSelector('#import-result', { timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(250); };

/* ---- 1. export, then import onto a clean profile: everything comes back ---- */
let exportPath = join(tmp, 'tw-backup.json');
{
  const a = await mk(RICH); await settings(a.pg);
  const [dl] = await Promise.all([a.pg.waitForEvent('download'), a.pg.getByRole('button', { name: 'Export all (JSON)' }).click()]); await dl.saveAs(exportPath);
  ok(/^tripwire-backup-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()), `the export is a dated file: ${dl.suggestedFilename()}`);
  const ex = JSON.parse(readFileSync(exportPath, 'utf8')); ok(ex.app === 'tripwire' && ex.entries[0].versions.length === 3 && ex.plans.length === 1 && ex.paper.length === 1 && ex.follows.length === 2 && ex.prefs.equity === 2500000 && ex.seen.TCS.length === 1 && ex.inbox.length === 1, 'the export holds every journal version, the plan, the paper trade, follows, preferences and the since-you-last-looked state');
  await a.ctx.close();
  const c = await mk(CLEAN); await settings(c.pg); await importFile(c.pg, 'tw-backup.json', readFileSync(exportPath));
  const got = await saved(c.pg);
  ok(/Imported and merged: 1 journal entry, 1 plan, 1 paper trade, 2 followed names/.test(await text(c.pg)), 'the import says what it brought in');
  ok(JSON.stringify(got.entries) === JSON.stringify(RICH.entries) && JSON.stringify(got.plans) === JSON.stringify(RICH.plans) && JSON.stringify(got.paper) === JSON.stringify(RICH.paper) && JSON.stringify([...got.follows].sort()) === JSON.stringify(['GCSL', 'TCS']), 'a clean profile gets back the journal versions, the plan, the paper trade and the follows exactly');
  ok(JSON.stringify(got.compares) === JSON.stringify(RICH.compares) && got.screens.length === 1 && got.reviews[0].note === 'kept to the plan' && got.prefs.equity === 2500000 && got.prefs.hideAmounts === true && JSON.stringify(got.prefs.interests) === '["Energy"]', 'and the comparisons, saved screen, weekly review and preferences');
  ok(JSON.stringify(got.seen) === JSON.stringify(RICH.seen) && JSON.stringify(got.inbox) === JSON.stringify(RICH.inbox) && JSON.stringify(got.dismissed) === JSON.stringify(RICH.dismissed), 'and what was seen, the inbox and the dismissals');
  const before = await raw(c.pg); await importFile(c.pg, 'again.json', readFileSync(exportPath)); ok((await raw(c.pg)) === before, 'importing the same backup a second time changes nothing');
  ok(c.errs.length === 0, `no script error through export and import (${c.errs.join('; ')})`); await c.ctx.close();
}

/* ---- 2. a wrong or corrupt file is refused, says why, and changes nothing ---- */
{
  const { ctx, pg, errs } = await mk(RICH); await settings(pg); const before = await raw(pg); const good = JSON.parse(readFileSync(exportPath, 'utf8'));
  const cases = [['not json', 'this is {not json', /not a JSON file/], ['an array', '[]', /does not hold a saved state/], ['another app', JSON.stringify({ app: 'budget', v: 1 }), /from another app \(budget\)/], ['a newer version', JSON.stringify({ ...good, v: 2 }), /version 2 of Tripwire; this one reads version 1/],
    ['no journal', JSON.stringify({ ...good, entries: 'x' }), /journal section is missing or damaged/], ['a damaged entry', JSON.stringify({ ...good, entries: [1, 2] }), /Journal entry 1 is damaged/], ['a damaged plan', JSON.stringify({ ...good, plans: [{ id: 'p' }] }), /Plan 1 is damaged/],
    ['a damaged paper trade', JSON.stringify({ ...good, paper: [{ id: 'p', sym: 'X' }] }), /Paper trade 1 is damaged/], ['too large', Buffer.alloc(2_100_000, 32), /too large/]];
  for (const [name, body, re] of cases) { await importFile(pg, 'x.json', body); const msg = await pg.locator('#import-result').innerText().catch(() => ''); ok(re.test(msg) && /Nothing was changed/.test(msg) && (await raw(pg)) === before, `${name}: refused with its reason, and the saved state is byte for byte the same (${msg.slice(0, 70)})`); }
  ok((await pg.locator('#import-result[role=alert]').count()) === 1, 'a refusal is announced as an alert');
  await pg.goto(base + '/#/desk'); await text(pg); ok(errs.length === 0, `the app still renders after every refusal (${errs.join('; ')})`); await ctx.close();
}

/* ---- 3. restart: a new browser context holding the same storage keeps everything ---- */
{
  const a = await mk(RICH); await a.pg.goto(base + '/#/desk'); await a.pg.waitForSelector('nav.tabs', { timeout: 15000 }); await a.pg.waitForTimeout(500);
  const state = await a.ctx.storageState(); await a.ctx.close();
  const r = await mk(null, { storageState: state }); await r.pg.goto(base + '/#/desk'); await r.pg.waitForSelector('nav.tabs', { timeout: 15000 }); await r.pg.waitForTimeout(600);
  const got = await saved(r.pg); ok(JSON.stringify(got.entries) === JSON.stringify(RICH.entries) && JSON.stringify(got.plans) === JSON.stringify(RICH.plans) && JSON.stringify(got.paper) === JSON.stringify(RICH.paper) && got.prefs.equity === 2500000, 'after a restart the journal versions, the plan, the paper trade and the preferences are the same');
  ok(/GCSL/.test(await text(r.pg)) && !(await r.pg.locator('.welcome').count()), 'and the app opens on the Desk with the followed names, not on the welcome screen');
  await r.pg.goto(base + '/#/profile'); await r.pg.waitForSelector('#p-equity'); ok((await r.pg.locator('#p-equity').inputValue()) === '2500000', 'the plan defaults read back the saved equity'); await r.ctx.close();
}

/* ---- 4. a failed save (quota): the banner says why, what was written stays, an immediate backup is offered, and a later good save clears it ---- */
{
  const init = () => { window.__fail = false; const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, val) { if (window.__fail && k === 'tripwire:v1') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); return orig.call(this, k, val); }; };
  const { ctx, pg, errs } = await mk(RICH, { init }); await pg.goto(base + '/#/c/INFY'); await pg.waitForSelector('button[aria-pressed]', { timeout: 20000 }); await pg.waitForTimeout(500);
  ok((await pg.locator('.banner[role=alert]').count()) === 0, 'no banner while saving works');
  await pg.evaluate(() => { window.__fail = true; }); const before = await raw(pg);
  await pg.getByRole('button', { name: /^Follow / }).first().click(); await pg.waitForSelector('.banner[role=alert]', { timeout: 5000 });
  const banner = await pg.locator('.banner[role=alert]').innerText(); ok(/could not save: this browser's storage is full/.test(banner) && /still here/.test(banner) && /Download a backup now/.test(banner), `the banner says why, that the writing is still here, and offers a backup: ${banner.slice(0, 90)}`);
  ok((await raw(pg)) === before, 'the earlier saved copy is untouched by the failed write');
  ok((await pg.getByRole('button', { name: /^Unfollow / }).count()) >= 1, 'the follow is kept in memory and shown, although it could not be saved');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: 'Download a backup now' }).click()]); const p = join(tmp, 'fail.json'); await dl.saveAs(p);
  const ex = JSON.parse(readFileSync(p, 'utf8')); ok(ex.follows.includes('INFY') && ex.entries.length === 1 && ex.app === 'tripwire', 'the immediate backup contains what could not be saved (the new follow) and everything before it');
  await pg.evaluate(() => { window.__fail = false; }); await pg.getByRole('button', { name: /^Unfollow / }).first().click(); await pg.waitForTimeout(400);
  ok((await pg.locator('.banner[role=alert]').count()) === 0 && !(await saved(pg)).follows.includes('INFY'), 'when saving works again the next change is written, whole, and the banner clears');
  ok(errs.length === 0, `no script error during a failed save (${errs.join('; ')})`); await ctx.close();
}

/* ---- 5. unreadable saved data: flagged, a copy kept, and that copy can be downloaded from Settings ---- */
{
  const { ctx, pg } = await mk(null, { init: () => { try { if (!sessionStorage.getItem('twbad')) { sessionStorage.setItem('twbad', '1'); localStorage.setItem('tripwire:v1', '{"v":1,"follows":["TCS"],"entries":[{"id":'); } } catch { /* blocked */ } } });
  await pg.goto(base + '/'); await pg.waitForSelector('.welcome', { timeout: 15000 }); await pg.waitForTimeout(500);
  ok((await pg.evaluate(() => localStorage.getItem('tripwire:v1:unreadable'))) === '{"v":1,"follows":["TCS"],"entries":[{"id":', 'the unreadable text is copied aside on first sight');
  await pg.getByRole('button', { name: 'Explore markets' }).click(); await pg.goto(base + '/#/today'); await settings(pg);
  ok(/A copy of unreadable saved data was kept/.test(await text(pg)), 'Settings says a copy was kept');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: 'Download that copy' }).click()]); const p = join(tmp, 'unreadable.txt'); await dl.saveAs(p);
  ok(readFileSync(p, 'utf8') === '{"v":1,"follows":["TCS"],"entries":[{"id":', 'the downloaded copy is exactly what was there');
  await pg.getByRole('button', { name: /Delete all my data/ }).click(); await pg.getByRole('button', { name: 'Erase now' }).click(); await pg.waitForTimeout(300);
  ok((await pg.evaluate(() => localStorage.getItem('tripwire:v1:unreadable'))) === null, 'erasing data also removes the kept copy, and said it would'); await ctx.close();
}

/* ---- 6. a late scheduled check, in session: the page says delayed, adds the Worker's on-demand market stories under their own label, and keeps the three times apart ---- */
{
  const T0 = Date.parse('2026-10-27T06:00:00Z'); const iso = (ms) => new Date(ms).toISOString();   // 11:30 IST, a Tuesday in session
  const mkLate = async (goodMin) => {
    const x = await mk(STATE, { at: T0, news: {} }); const ev = makeEvents(T0); const rbi = ev.find((e) => e.eventClusterId === 'ev_rbi');
    const od = { ...rbi, eventClusterId: 'ev_od', headline: 'Sensex rises 300 points as banks lead gains', eventType: 'Macro', significance: 0.6, canonicalUrl: 'https://example.com/od/1', sources: [{ ...rbi.sources[0], canonicalUrl: 'https://example.com/od/1' }], publishedAt: iso(T0 - 20 * 60e3), updatedAt: iso(T0 - 20 * 60e3), firstSeenAt: iso(T0 - 2 * 60e3), fetchedAt: iso(T0 - 2 * 60e3) };
    x.ctl.snapshot = makeSnapshot(T0, { version: 7, goodMs: T0 - goodMin * 60e3, checkedMs: T0 - goodMin * 60e3, events: ev }); x.ctl.status = statusOf(x.ctl.snapshot); x.calls = 0;
    await x.ctx.route('**/api/news/catchup*', (r) => { x.calls++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(goodMin > 30 ? { ok: true, schema: 'tripwire-news-ondemand/1', onDemand: true, refreshedAt: iso(T0 - 2 * 60e3), scope: 'market', status: 'ok', reason: 'late', events: [od] } : { ok: true, onDemand: false, reason: 'the published check is on schedule' }) }); });
    return x;
  };
  const late = await mkLate(55); await late.pg.goto(base + '/#/today'); await late.pg.waitForSelector('section.nw .nw-row', { timeout: 20000 }); await late.pg.waitForTimeout(1500);
  const line = (await late.pg.locator('.nw-hline').first().innerText()).trim(); const state = await late.pg.locator('.nw-state').first().innerText();
  ok(/Delayed/.test(state) && /^News delayed - last successful check 10:35 IST, 55 minutes ago; scheduled checks run every 15 minutes/.test(line) && /Market stories were refreshed on demand 11:28 IST\./.test(line), `delayed, with the on-demand time named apart from the last successful check: "${line}"`);
  ok(late.calls >= 1, 'the page asked the Worker for the on-demand refresh because the scheduled check was late');
  const offer = late.pg.locator('.nw-offer'); if (await offer.count()) await offer.click(); await late.pg.waitForTimeout(400);
  const t = await text(late.pg); ok(/Sensex rises 300 points as banks lead gains/.test(t), 'the on-demand market story is offered and shown');
  const row = late.pg.locator('.nw-row', { hasText: 'Sensex rises 300 points' }).first(); const rt = (await row.innerText()).replace(/\s+/g, ' ');
  ok(/11:10 IST|20 min ago/.test(rt) && !/Checked|Refreshed on demand/.test(rt), `the story carries its own publication time, not the check or the refresh time: "${rt.slice(0, 120)}"`);
  ok(!/\bFresh\b|\bLIVE\b/.test(await late.pg.locator('section.nw').first().innerText()), 'a delayed state is never called fresh or live, even with on-demand stories');
  await late.pg.goto(base + '/#/news'); await late.pg.waitForSelector('dl.nw-times', { timeout: 15000 }); const dl = (await late.pg.locator('dl.nw-times').innerText()).replace(/\s+/g, ' ');
  ok(/Last successful check 10:35 IST/.test(dl) && /Refreshed on demand 11:28 IST/.test(dl), `the News page lists the three apart: ${dl.slice(0, 160)}`); await late.ctx.close();
  const ontime = await mkLate(5); await ontime.pg.goto(base + '/#/today'); await ontime.pg.waitForSelector('section.nw .nw-row', { timeout: 20000 }); await ontime.pg.waitForTimeout(1200);
  ok(ontime.calls === 0 && /Fresh/.test(await ontime.pg.locator('.nw-state').first().innerText()), 'when the scheduled check is on time the page makes no on-demand request and says Fresh'); await ontime.ctx.close();
}

/* ---- 6b. nothing was ever published (no status file): the page still asks the Worker for on-demand market stories while the session is open ---- */
{
  const T0 = Date.parse('2026-10-27T06:00:00Z');
  const x = await mk(STATE, { at: T0, news: {} }); x.ctl.status = { ok: false, reason: 'absent', error: 'the first news check has not been published yet' }; x.calls = 0;
  await x.ctx.route('**/api/news/catchup*', (r) => { x.calls++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, schema: 'tripwire-news-ondemand/1', onDemand: false, reason: 'not needed' }) }); });
  await x.pg.goto(base + '/#/today'); await x.pg.waitForTimeout(4000);
  ok(x.calls >= 1, 'with no status ever published the page asks the Worker for the on-demand refresh (the Worker decides)'); await x.ctx.close();
}

/* ---- 7. service honesty: Operations shows evidence or "Not verified"; Settings carries no infrastructure ---- */
{
  const bad = await mk(STATE); await bad.ctx.route('**/api/health*', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' }));
  await bad.pg.goto(base + '/#/ops'); await bad.pg.waitForSelector('details.ev summary', { timeout: 20000 }); await bad.pg.waitForTimeout(1500);
  const sum = async (pg, name) => (await pg.locator('details.ev summary', { hasText: name }).first().innerText()).replace(/\s+/g, ' ');
  ok(/Live prices.*Not verified/i.test(await sum(bad.pg, 'Live prices')), 'when the status check does not answer, prices are "Not verified", not "Working"');
  ok(/Forward ledger.*Not verified/i.test(await sum(bad.pg, 'Forward ledger')), 'a ledger that was not read is "Not verified"');
  ok(!/\bWorking\b/.test(await bad.pg.locator('body').innerText()), 'nothing on Operations is called Working'); await bad.ctx.close();
  const good = await mk(STATE); await good.pg.goto(base + '/#/ops'); await good.pg.waitForSelector('details.ev summary', { timeout: 20000 }); await good.pg.waitForTimeout(1500);
  ok(/Live prices.*Answering/i.test(await sum(good.pg, 'Live prices')), 'when the probe answers, prices say Answering');
  await good.pg.locator('details.ev', { hasText: 'Live prices' }).first().locator('summary').click(); const body = await good.pg.locator('details.ev', { hasText: 'Live prices' }).first().innerText();
  ok(/How this is known/.test(body) && /Right now: Answered at \d\d:\d\d IST/.test(body), 'and the row prints its evidence and the time it was checked');
  ok(/Notifications and alerts.*Not built/i.test(await sum(good.pg, "Notifications")) && /Accounts and sign-in.*Not set up/i.test(await sum(good.pg, 'Accounts')), 'unbuilt and unconfigured services say so');
  await good.pg.locator('[data-ops-dev] > summary').click(); const ot = await good.pg.locator('body').innerText(); ok(/Schedules and caches/.test(ot) && /Best effort/i.test(ot) && /binding/i.test(ot), 'schedules, cache lifetimes and bindings are on Operations');
  await good.pg.goto(base + '/#/profile'); await good.pg.waitForSelector('text=Export all (JSON)'); const st = await text(good.pg);
  ok(!/binding|secret|probe|cron|TTL|Worker|GitHub|\bms\b|Services and integrations/i.test(st), 'Settings carries no bindings, secrets, probe timings, job schedules or cache lifetimes');
  ok(/There is no sign-in/.test(st) && /Notifications are not built/.test(st) && !/Sync between devices|Broker connection|E-mail/.test(st), 'the account note is one short paragraph, with no list of unbuilt features');
  ok(['Motion', 'Haptics', 'Text size', 'Hide my amounts', 'Lock with Face ID', 'Export all (JSON)', 'Import backup', 'Delete all my data', 'Hypothetical equity'].every((k) => st.includes(k)), 'Settings keeps what a person acts on: motion, haptics, text size, amounts, lock, backup and restore, erase, plan defaults');
  ok(/device’s text-size setting|device's text-size setting/.test(st) && /depends on your device/.test(st), 'text size and the screen lock say they depend on the device');
  ok((await good.pg.locator('a[href="#/ops"]').count()) === 1, 'System status is one link away'); await good.ctx.close();
}

await b.close(); console.log(fails ? `\nreliability: ${fails} failed` : '\nreliability: all passed'); process.exit(fails ? 1 : 0);
