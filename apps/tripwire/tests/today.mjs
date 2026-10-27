// Today and My Desk, in a real browser: priorities and their order, the guest state, since-your-last-visit (before/after, basis, review, dismiss, undo, first visit,
// recording rule), layout at six widths, sticky-bar clearance, keyboard use, and layout shift on a throttled first load. AUTOMATED checks, not user research.
// Usage: node apps/tripwire/tests/today.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
const SCREEN_DAY = (await (await fetch(base + '/data/screen.json')).json()).as_of;   // the served screen's own day, never a literal
const DAYWORD = new Date(SCREEN_DAY + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const prevAt = new Date(Date.now() - 3 * 86400000).toISOString();
const GUEST = { ...STATE, follows: [], entries: [], paper: [], snaps: {} };
const snap = (o) => ({ at: prevAt, day: '2026-10-20', px: 2380, rsi: 66, rs3m: 2, from_high: -20, atr_pct: 3, sma200: 2450, high52: 3350, low52: 1976.8, trend: 'mixed', rules: 2, next_earnings: null, risk: 'LOW', elig: 'full', ...o });
const WITH = { ...STATE, follows: ['TCS'], seen: { TCS: [snap({})] } };
const open = async (state, route = '/#/today', o = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...o });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, state); await mockApi(ctx);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); await pg.goto(base + route);
  await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForSelector('[data-sec="brief"], .dsk', { timeout: 15000 }); await pg.waitForTimeout(800); return { ctx, pg, errs };
};
const saved = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1') ?? 'null'));
const text = (pg) => pg.locator('body').innerText();

/* ---- 1. guest with zero follows ---- */
{
  const { ctx, pg, errs } = await open(GUEST); await pg.waitForSelector('.guest'); const t = await text(pg);
  const secs = await pg.$$eval('[data-sec]', (n) => n.map((x) => x.getAttribute('data-sec')));
  ok(secs.indexOf('brief') === 0 && secs.indexOf('news') === 1 && secs.indexOf('changes') === 2, `section order starts brief, news, changes (got ${secs.join(', ')})`);
  ok(secs.indexOf('picks') > secs.indexOf('changes') && (secs.indexOf('book') === -1 || secs.indexOf('book') < secs.indexOf('picks')), 'the paper book (when there is one) sits before the picks, both after the changes');
  ok(/Your market brief/.test(t) && /Screen data through (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ \w+/.test(await pg.locator('[data-brief]').innerText()) && /IST/.test(t), 'the brief states its data day and times in IST');
  ok(/Follow companies in Discover to see changes here/.test(t) && (await pg.locator('.guest a[href="#/discover"]').count()) === 1, 'the guest state asks to follow companies in Discover, with a link');
  ok(/Following\s*0/i.test(t.replace(/\n/g, ' ')), 'the news tab "Following" is empty for a guest: nothing is followed for them');
  ok(!(await pg.locator('.tchg').innerText()).match(/\b[A-Z]{3,}\b.*\b(RSI|Uptrend|crossed)/), 'no company is presented in the guest changes area');
  ok(!/Needs you|Since you last looked/.test(t), 'retired headings are gone');
  ok(await pg.locator('.tpicks .pickrow').count() <= 5 && await pg.locator('.tpicks .pickrow').count() >= 1 && /Picks from the close of/.test(t), 'picks are compact (at most five), dated');
  ok(!(await pg.locator('.trendmap').count()) && !(await pg.locator('.strip .tile').count()), 'the trend map and the commodity grid are not on Today any more');
  await pg.locator('a[href="#/markets"]').first().click(); await pg.waitForSelector('.trendmap', { timeout: 15000 });
  ok(await pg.locator('.strip .tile').count() >= 6 && /trend map/i.test(await text(pg)), 'the Markets page carries the indices, the commodity grid and the trend map');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : '')); await ctx.close();
}

/* ---- 2. first visit with follows: tracking starts, nothing invented, recorded only after 3 s ---- */
{
  const { ctx, pg } = await open({ ...STATE, follows: ['TCS'] }); await pg.waitForSelector('[data-sv="first"]'); await pg.locator('.sv').scrollIntoViewIfNeeded(); const t = await text(pg);
  ok(/Tracking starts today/.test(t) && !(await pg.locator('.svi').count()), 'first visit: "Tracking starts today" and no change is shown');
  ok(!(await saved(pg)).seen?.TCS?.length, 'nothing is recorded before the module has been on screen for 3 s');
  await pg.waitForTimeout(3600); const s1 = await saved(pg);
  ok(s1.seen?.TCS?.length === 1 && s1.seen.TCS[0].day === SCREEN_DAY, 'after 3 s the snapshot of the screen day is recorded');
  await pg.reload(); await pg.waitForSelector('[data-sec="changes"]'); await pg.waitForTimeout(1200);
  ok(!(await pg.locator('[data-sv="first"]').count()) && /Nothing meaningful changed/.test(await text(pg)), 'the next visit compares with it: same data, nothing meaningful changed');
  await ctx.close();
}
{
  const { ctx, pg } = await open({ ...STATE, follows: ['TCS'] }, '/#/today'); await pg.waitForSelector('[data-sv="first"]'); await pg.evaluate(() => { location.hash = '#/profile'; }); await pg.waitForTimeout(3800);
  ok(!(await saved(pg)).seen?.TCS?.length, 'leaving before 3 s records nothing'); await ctx.close();
}

/* ---- 3. with a prior snapshot: changes, before and after, basis, review, dismiss, undo, persistence ---- */
{
  const { ctx, pg } = await open(WITH); await pg.waitForSelector('.svi'); await pg.locator('.sv').scrollIntoViewIfNeeded(); const t = await pg.locator('.sv').innerText();
  const items = await pg.locator('.svi').count();
  ok(items >= 3, `meaningful changes are listed (${items})`);
  ok(/Moved above its 200-day average/.test(t) && /RSI crossed 70/.test(t), 'crossing the 200-day and RSI 70 are reported');
  ok(/RSI 66\s*→\s*RSI 75|RSI 66[\s\S]*RSI 75/.test(t), 'each item shows before and after');
  ok(new RegExp(`Screen data, 2026-10-20 to ${SCREEN_DAY}`).test(await pg.locator('.svi-basis').first().evaluate((n) => (n.open = true, n.textContent))), 'the basis names both screen days');
  ok(new RegExp(`screen data Tue 20 Oct to ${DAYWORD}`, 'i').test(t), 'the module states the period it compares');
  ok(/New information to review/.test(t) && !/stated invalidation/.test(t), 'a change is neutral unless a stated rule links it to the thesis');
  ok(!/\b(will|expected|likely|bullish|bearish|buy|sell)\b/i.test(t), 'no prediction or advice wording');
  const n0 = items; const first = pg.locator('.svi').first(); const title = await first.locator('.svi-t').innerText();
  await first.getByRole('button', { name: /^Dismiss/ }).click(); await pg.waitForTimeout(250);
  ok((await pg.locator('.svi').count()) === n0 - 1 && /Dismissed/.test(await pg.locator('.svmsg').innerText()), 'dismiss removes the item and says so in a status region');
  ok(await pg.locator('.svmsg').getAttribute('role') === 'status', 'the message is a role=status region');
  await pg.locator('.svmsg').getByRole('button', { name: 'Undo' }).click(); await pg.waitForTimeout(250);
  ok((await pg.locator('.svi').count()) === n0 && (await pg.locator('.svi-t', { hasText: title }).count()) === 1, 'undo restores the item');
  await pg.locator('.svi').first().getByRole('button', { name: /^Dismiss/ }).click(); await pg.waitForTimeout(250);
  await pg.getByRole('button', { name: /Show dismissed \(1\)/ }).click(); ok((await pg.locator('.svlist.dis .svi').count()) === 1, '"Show dismissed" lists it');
  await pg.locator('.svlist.dis').getByRole('button', { name: 'Restore' }).click(); await pg.waitForTimeout(250); ok((await pg.locator('.svi').count()) === n0, 'restore from the dismissed list works');
  await pg.locator('.svi').first().getByRole('button', { name: /^Dismiss/ }).click(); await pg.waitForTimeout(3600);
  const sv = await saved(pg); ok(Object.keys(sv.dismissed ?? {}).length === 1 && sv.inbox.length === n0 && sv.seen.TCS.length === 2, `dismissal, the unacknowledged changes and the new snapshot are saved (dismissed ${Object.keys(sv.dismissed ?? {}).length}, inbox ${sv.inbox?.length} of ${n0}, snapshots ${sv.seen?.TCS?.length})`);
  ok(!/https?:\/\/[^ ]*(thesis|Seed thesis)/i.test(pg.url()) && !pg.url().includes('invalidation'), 'no thesis text in the URL');
  await pg.reload(); await pg.waitForSelector('[data-sec="changes"]'); await pg.waitForTimeout(1200);
  const t2 = await pg.locator('.sv').innerText();
  ok(!(await pg.locator('.svi-new').count()) && (await pg.locator('.svi').count()) === n0 - 1 && /Show dismissed \(1\)/.test(t2), `on the next visit the seen changes are kept (not "New"), the dismissed one stays dismissed (new ${await pg.locator('.svi-new').count()}, items ${await pg.locator('.svi').count()} of ${n0}, ${t2.slice(-120).replace(/\n/g, ' ')})`);
  await ctx.close();
}

/* ---- 4. the thesis link is an explicit rule: a stated level crossed ---- */
{
  const st = { ...WITH, entries: [{ ...STATE.entries[0], versions: [{ ...STATE.entries[0].versions[0], invalidation: 'Close below 2,550', reviewOn: '2027-01-01' }] }], seen: { TCS: [snap({ px: 2600 })] } };
  const { ctx, pg } = await open(st); await pg.waitForSelector('.svi'); const t = await pg.locator('.sv').innerText();
  ok(/Crossed your stated invalidation level 2,550/.test(t), 'a price below the level written in the thesis says "crossed your stated invalidation level 2,550"');
  ok((await pg.locator('.svi').first().innerText()).includes('invalidation'), 'it is listed first');
  await pg.locator('.svi').first().getByRole('button', { name: 'Review thesis' }).click(); await pg.waitForSelector('textarea#t-thesis'); ok(true, 'Review opens the thesis sheet'); await ctx.close();
}

/* ---- 5. keyboard: dismiss and undo without a pointer ---- */
{
  const { ctx, pg } = await open(WITH); await pg.waitForSelector('.svi'); const n0 = await pg.locator('.svi').count();
  const btn = pg.locator('.svi').first().getByRole('button', { name: /^Dismiss/ }); await btn.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  ok((await pg.locator('.svi').count()) === n0 - 1, 'Enter on Dismiss works');
  const und = pg.locator('.svmsg').getByRole('button', { name: 'Undo' }); await und.focus(); const box = await und.boundingBox(); ok(box.height >= 44 - 1, `Undo is a 44px target (${Math.round(box.height)})`); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  ok((await pg.locator('.svi').count()) === n0, 'Enter on Undo restores');
  const act = await pg.locator('.svi-act .btn').first().boundingBox(); ok(act.height >= 43, `Review and Dismiss are 44px targets (${Math.round(act.height)})`);
  await ctx.close();
}

/* ---- 6. my desk workspace ---- */
{
  const st = { ...WITH, entries: [{ ...STATE.entries[0], versions: [{ ...STATE.entries[0].versions[0], reviewOn: '2026-10-30' }] }] };
  const { ctx, pg } = await open(st, '/#/desk'); await pg.waitForSelector('[data-desk="workspace"]'); const t = await text(pg);
  for (const h of ['Upcoming reviews', 'Open questions', 'Recent decisions', 'Followed companies', 'Saved theses']) ok(t.includes(h), `My Desk shows "${h}"`);
  await pg.locator('#dsk-qsel').selectOption({ label: 'TCS' }); await pg.getByRole('textbox', { name: 'Question' }).fill('Will deal wins hold margins?'); await pg.getByRole('button', { name: 'Save' }).click(); await pg.waitForTimeout(300);
  const sv = await saved(pg); ok(sv.entries[0].versions.length === 2 && sv.entries[0].versions[1].question === 'Will deal wins hold margins?' && sv.entries[0].versions[0].question === undefined, 'a question is saved as a new thesis version; the earlier one is untouched');
  ok(/Will deal wins hold margins\?/.test(await pg.locator('[data-desk]').innerText()), 'the question is listed');
  for (const v of ['follow', 'journal', 'plans', 'saved']) { await pg.goto(base + `/#/desk?v=${v}`); await pg.waitForTimeout(500); ok(await pg.locator(`.seg [aria-selected=true]`).count() === 1 && (await pg.locator('.seg [aria-selected=true]').innerText()).length > 0, `#/desk?v=${v} still opens its tab`); }
  await ctx.close();
}

/* ---- 7. no horizontal overflow, nothing under the sticky bars ---- */
for (const w of [360, 390, 430, 768, 1024, 1440]) {
  const { ctx, pg } = await open(WITH, '/#/today', { viewport: { width: w, height: w >= 1000 ? 900 : 844 } });
  for (const r of ['/#/today', '/#/markets', '/#/desk']) { await pg.goto(base + '/'); await pg.goto(base + r); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(900);
    const o = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); ok(o.sw <= o.cw + 1, `${w}px ${r}: no horizontal overflow (${o.sw} vs ${o.cw})`); }
  if (w <= 768) {
    await pg.goto(base + '/#/today'); await pg.waitForSelector('.tfoot', { timeout: 15000 }); await pg.waitForTimeout(500); await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => { const f = document.querySelector('.tfoot').getBoundingClientRect(); const t = document.querySelector('nav.tabs').getBoundingClientRect(); return { fb: f.bottom, tt: t.top }; });
    ok(r.fb <= r.tt + 1, `${w}px: the last line of Today clears the tab bar (${Math.round(r.fb)} <= ${Math.round(r.tt)})`);
  }
  await ctx.close();
}

/* ---- 8. reduced motion keeps everything working ---- */
{
  const { ctx, pg } = await open(WITH, '/#/today', { reducedMotion: 'reduce' }); await pg.waitForSelector('.svi'); const tr = await pg.locator('.svi').first().evaluate((n) => getComputedStyle(n).transitionDuration);
  ok(/^0s/.test(tr), `reduced motion: no transition on change items (${tr})`); await ctx.close();
}

/* ---- 9. layout shift on a throttled first load ---- */
{
  const runs = [];
  for (let rep = 0; rep < 3; rep++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' }); await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), WITH); await mockApi(ctx);
    const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await pg.addInitScript(() => { window.__v = { cls: 0, src: [] }; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__v.cls += e.value; window.__v.src.push(`${e.value.toFixed(3)}@${Math.round(e.startTime)}ms ${(e.sources || []).map((x) => (x.node?.nodeName ?? '') + '.' + (x.node?.className ?? '')).join(' | ')}`); } }).observe({ type: 'layout-shift', buffered: true }); });
    await pg.goto(base + '/#/today', { waitUntil: 'load' }); await pg.waitForSelector('[data-sec="brief"]', { timeout: 30000 }); await pg.waitForTimeout(6000);
    const v = await pg.evaluate(() => window.__v); runs.push(v.cls); if (v.cls > 0.05) console.log('  shifts: ' + v.src.join(' ; ')); await ctx.close();
  }
  runs.sort(); ok(runs[1] <= 0.1, `CLS ${runs[1].toFixed(3)} (median of 3, 4x CPU, 1.6 Mbit/s) is at most 0.1`);
}
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
