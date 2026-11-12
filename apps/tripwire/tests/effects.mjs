// The Effects preset and the price halo, verified AT RUNTIME (12 Nov 2026): identical polls leave no cue; an increase or decrease gives one halo (sign included) that is gone within ~0.65 s; Off / Calm / Lively
// switch the html classes and persist; the device's reduced-motion request and the app's motion-off setting each remove every effect, including when the device setting flips while the page is open.
// Usage: node apps/tripwire/tests/effects.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const mk = async (prefs, o = {}) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', bypassCSP: true, ...o }); const st = { ...STATE, prefs: { ...STATE.prefs, ...prefs } };
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, st); const T = await mockApi(ctx); return { ctx, T }; };
const cls = (pg) => pg.evaluate(() => ({ fx: document.documentElement.classList.contains('fx'), calm: document.documentElement.classList.contains('fx-calm'), lively: document.documentElement.classList.contains('fx-lively'), mode: document.documentElement.dataset.effects }));
const open = async (pg) => { await pg.goto(base + '/#/markets'); await pg.waitForSelector('.market-macro .tick', { timeout: 20000 }); await pg.waitForTimeout(3600); };   // 3.6 s: the feed does not look again inside 3 s of its last answer
const poll = async (pg) => { await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); };
const gold = (T, px) => { T.macro.GOLD = { ...T.macro.GOLD, px }; };
const cues = (pg) => pg.evaluate(() => ({ any: document.querySelectorAll('.tick[data-cue]').length, halos: document.querySelectorAll('.tk-halo').length, up: document.querySelectorAll('.tick[data-cue=up]').length, down: document.querySelectorAll('.tick[data-cue=down]').length }));

/* 1. Calm is the default for a payload with no effects field; identical polls give no cue; a rise gives one halo, a fall gives one, each gone soon after */
{ const { ctx, T } = await mk({}); const pg = await ctx.newPage(); await open(pg);
  const c0 = await cls(pg); ok(c0.fx && c0.calm && !c0.lively && c0.mode === 'calm', `an old payload without the field reads as Calm (${JSON.stringify(c0)})`);
  ok((await cues(pg)).any === 0, 'at rest no figure carries a cue (the load reveal is over)');
  const base0 = T.macro.GOLD.px;
  await poll(pg); await pg.waitForTimeout(900); ok((await cues(pg)).any === 0, 'an identical poll gives no cue: no data-cue, no halo');
  await pg.waitForTimeout(3300); gold(T, base0 + 40); await poll(pg);
  await pg.waitForSelector('.tick[data-cue=up]', { timeout: 4000 }).catch(() => {}); const up = await cues(pg);
  ok(up.up === 1 && up.down === 0 && up.halos === 1, `an increase gives exactly one up halo (${JSON.stringify(up)})`);
  const an = await pg.evaluate(() => { const h = document.querySelector('.tick[data-cue=up] .tk-halo'); return h ? [getComputedStyle(h).animationName, getComputedStyle(h).animationDuration, getComputedStyle(h, '::after').content] : null; });
  ok(an && an[0] === 'fx-halo' && an[1] === '0.6s' && /▲/.test(an[2]), `the halo fades over 600 ms and carries a sign, not only a tint (${an})`);
  const lab = await pg.evaluate(() => document.querySelector('.tick[data-cue=up] .roll')?.getAttribute('aria-label') ?? ''); ok(/, up$/.test(lab), `the figure says "up" in words while the cue is on (${lab})`);
  const lv = await pg.evaluate(() => document.querySelector('[aria-live]') ? document.querySelector('.tick[data-cue=up]')?.closest('[aria-live]') !== null : false); ok(!lv, 'the cue is not inside a live region: no announcement for a routine tick');
  await pg.waitForTimeout(900); ok((await cues(pg)).any === 0, 'the halo is gone within 0.9 s of starting');
  await pg.waitForTimeout(3000); await poll(pg); await pg.waitForTimeout(700); ok((await cues(pg)).any === 0, 'the same price polled again after a rise gives no new cue');
  await pg.waitForTimeout(3000); gold(T, base0 - 40); await poll(pg);
  await pg.waitForSelector('.tick[data-cue=down]', { timeout: 4000 }).catch(() => {}); const dn = await cues(pg); ok(dn.down === 1 && dn.up === 0 && dn.halos === 1, `a decrease gives exactly one down halo (${JSON.stringify(dn)})`);
  const arrow = await pg.evaluate(() => getComputedStyle(document.querySelector('.tick[data-cue=down] .tk-halo'), '::after').content); ok(/▼/.test(arrow), 'the fall carries its own sign');
  await pg.waitForTimeout(900); ok((await cues(pg)).any === 0, 'the down halo is gone too');
  const shift = await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth); ok(shift, 'no horizontal overflow from the halo');
  await ctx.close(); }

/* 2. Settings: Off / Calm / Lively switch the html classes, and the choice persists across a reload */
{ const { ctx } = await mk({}); const pg = await ctx.newPage(); await pg.goto(base + '/#/settings'); await pg.waitForSelector('[data-effects-group]', { timeout: 20000 });
  for (const m of ['lively', 'off', 'calm', 'lively']) {
    await pg.locator(`button[data-effects="${m}"]`).first().click(); await pg.waitForTimeout(150); const c = await cls(pg);
    ok(c.mode === m && c.fx === (m !== 'off') && c.calm === (m === 'calm') && c.lively === (m === 'lively'), `choosing ${m}: html classes ${JSON.stringify(c)}`);
    ok(await pg.locator(`button[data-effects="${m}"]`).first().getAttribute('aria-checked') === 'true', `${m} is the checked radio`);
  }
  const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1')).prefs.effects); ok(saved === 'lively', `the choice is saved in the prefs (${saved})`);
  await pg.reload(); await pg.waitForSelector('[data-effects-group]'); await pg.waitForTimeout(300); const c = await cls(pg); ok(c.lively && c.mode === 'lively', 'after a reload Lively is still on');
  ok(await pg.locator('button[data-effects="lively"]').first().getAttribute('aria-checked') === 'true', 'and the radio shows it');
  await pg.locator('button[data-effects="off"]').first().click(); await pg.waitForTimeout(150);
  const anim = await pg.evaluate(() => { const v = document.querySelector('.view'); return v ? getComputedStyle(v).animationName : 'none'; }); ok(anim === 'none', `Off: the view animates nothing (${anim})`);
  await ctx.close(); }

/* 3. Off: a changed price shows no cue at all */
{ const { ctx, T } = await mk({ effects: 'off' }); const pg = await ctx.newPage(); await open(pg); gold(T, T.macro.GOLD.px + 40); await poll(pg); await pg.waitForTimeout(700);
  ok((await cues(pg)).any === 0, 'Off: no cue after a price change'); ok((await pg.evaluate(() => document.querySelector('.market-macro .tick .roll')?.textContent ?? '')).length > 0, 'Off: the figure is still there'); await ctx.close(); }

/* 4. Lively draws on and shimmers; Calm does neither */
for (const m of ['calm', 'lively']) { const { ctx } = await mk({ effects: m }); const pg = await ctx.newPage(); await pg.goto(base + '/#/today'); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => { const d = document.createElement('div'); d.className = 'ds-skel'; d.style.height = '20px'; document.body.appendChild(d); return getComputedStyle(d, '::after').animationName; });
  ok(m === 'lively' ? r === 'ds-shimmer' : r === 'none', `${m}: a loading skeleton ${m === 'lively' ? 'shimmers' : 'does not shimmer'} (${r})`); await ctx.close(); }

/* 5. Reduced motion: the device request AND the app's motion-off each remove every effect; labels and the figure stay */
for (const [label, prefs, o] of [['the device asks for reduced motion', { effects: 'lively' }, { reducedMotion: 'reduce' }], ['the app has Motion off', { effects: 'lively', motion: 'off' }, {}]]) {
  const { ctx, T } = await mk(prefs, o); const pg = await ctx.newPage(); await open(pg); const c = await cls(pg); ok(!c.fx && !c.calm && !c.lively, `${label}: no fx classes (${JSON.stringify(c)})`);
  gold(T, T.macro.GOLD.px + 40); await poll(pg); await pg.waitForTimeout(500);
  const k = await cues(pg); ok(k.any === 0 && k.halos === 0, `${label}: a price change shows no halo and no pulse`);
  const run = await pg.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.tick')).length); ok(run === 0, `${label}: nothing is animating in a figure (${run})`);
  ok(/\d/.test(await pg.evaluate(() => document.querySelector('.market-macro .tick .roll')?.getAttribute('aria-label') ?? '')), `${label}: the figure and its label remain`);
  await ctx.close(); }
/* the device setting flipping while the page is open is read live, not once */
{ const { ctx, T } = await mk({ effects: 'calm' }); const pg = await ctx.newPage(); await open(pg); ok((await cls(pg)).fx, 'Calm is on'); await pg.emulateMedia({ reducedMotion: 'reduce' }); await pg.waitForTimeout(200);
  ok(!(await cls(pg)).fx, 'the device switching to reduced motion turns the layer off without a reload'); gold(T, T.macro.GOLD.px + 40); await poll(pg); await pg.waitForTimeout(500); ok((await cues(pg)).any === 0, 'and a price change then shows no cue');
  await pg.emulateMedia({ reducedMotion: 'no-preference' }); await pg.waitForTimeout(200); ok((await cls(pg)).calm, 'and back on when the device allows it'); await ctx.close(); }

await b.close(); console.log(fails ? `\neffects: ${fails} failed` : '\neffects: all passed'); process.exit(fails ? 1 : 0);
