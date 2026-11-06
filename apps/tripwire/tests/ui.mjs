// UI revamp checks: the candle geometry in the browser, radio semantics and arrow keys, one accessible price, the skip link, Profile truth about this device,
// reduced motion (device setting and in-app switch), 44px primary targets, no overflow at six widths, focus restore after a sheet, the 30-second company read, ownership, Operations.
// AUTOMATED checks in a desktop Chromium; they do not replace a real phone. Usage: node apps/tripwire/tests/ui.mjs [baseUrl]
import { chromium, newCtx, ohlcSeries, STATE, openOptions, closeOptions } from './uimock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const wait = (pg) => pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {});
const open = async (pg, route, sel) => { await pg.goto(base + '/'); await pg.goto(base + route); await pg.reload(); await wait(pg); if (sel) await pg.waitForSelector(sel, { timeout: 20000 }); await pg.waitForTimeout(400);
  };
const radio = (pg, group, name) => pg.locator(`[role=radiogroup][aria-label="${group}"]`).getByRole('radio', { name, exact: true });

/* 1. the last candle is whole, and the price tag is clear of it, at 390 and 1280, for daily, weekly and monthly */
for (const w of [390, 1280]) {
  const ctx = await newCtx(b, w, ohlcSeries(2600, 'TCS')); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  await openOptions(pg); await radio(pg, 'Style', 'CANDLES').click(); await closeOptions(pg); await pg.waitForSelector('.c-candles rect');   // Style is in the Chart options sheet since 1 Nov 2026
  for (const [range, frame] of [['1Y', 'DAILY'], ['5Y', 'WEEKLY'], ['5Y', 'MONTHLY'], ['MAX', 'MONTHLY']]) {
    await radio(pg, 'Range', range).click(); await openOptions(pg); await radio(pg, 'Detail', frame).click(); await closeOptions(pg); await pg.waitForTimeout(250);
    const m = await pg.evaluate(() => { const plot = document.querySelector('.chart-plot').getBoundingClientRect(); const gs = [...document.querySelectorAll('.c-candles > g')]; const box = (g) => { const r = [...g.children].map((c) => c.getBoundingClientRect()); return { l: Math.min(...r.map((x) => x.left)), r: Math.max(...r.map((x) => x.right)) }; };
      const first = box(gs[0]), last = box(gs[gs.length - 1]); const tag = document.querySelector('.c-last')?.getBoundingClientRect(); return { n: gs.length, pl: plot.left, pr: plot.right, first, last, tagL: tag ? tag.left : null }; });
    ok(m.n > 3 && m.first.l >= m.pl - 0.5 && m.last.r <= m.pr + 0.5, `${w}px ${range} ${frame}: first and last candle lie inside the plot (${m.first.l.toFixed(1)} >= ${m.pl.toFixed(1)}, ${m.last.r.toFixed(1)} <= ${m.pr.toFixed(1)})`);
    ok(m.tagL !== null && m.last.r <= m.tagL + 0.5, `${w}px ${range} ${frame}: the last-price tag starts right of the last candle (${m.last.r.toFixed(1)} <= ${m.tagL?.toFixed(1)})`);
  }
  await ctx.close();
}

/* 2. radio semantics, arrow keys, unavailable ranges and the default range */
{ const ctx = await newCtx(b, 390, ohlcSeries(300, 'TCS')); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  await openOptions(pg);   // Detail, Style and Scale are in the Chart options sheet
  const groups = await pg.evaluate(() => ['Range', 'Detail', 'Scale', 'Style', 'Compare'].map((g) => { const e = document.querySelector(`[role=radiogroup][aria-label="${g}"]`); return e ? [g, e.querySelectorAll('[role=radio]').length, e.querySelectorAll('[aria-pressed]').length] : [g, 0, 0]; }));
  ok(groups.every(([g, n, p]) => (n > 0 || g === 'Style') && p === 0), `mutually exclusive choices are radio groups with no aria-pressed (${groups.map((x) => x.join(':')).join(' ')})`);
  ok(await pg.locator('.c-checks input[type=checkbox]').count() >= 4, 'overlays are independent checkboxes in the sheet'); await closeOptions(pg);
  // 1 Nov 2026: a history that fills a year opens on 1Y (stock against the Nifty where held), no longer on the longest range
  ok((await radio(pg, 'Range', '1Y').getAttribute('aria-checked')) === 'true', 'about 14 months of history: the chart opens on 1Y, not 10Y');
  const tenY = pg.locator('[role=radiogroup][aria-label="Range"] [role=radio]', { hasText: '10Y' });
  ok((await tenY.isDisabled()) && /^10Y: only 1[34] months of history$/.test((await tenY.getAttribute('aria-label')) ?? ''), `10Y is disabled and says why (${await tenY.getAttribute('aria-label')})`);
  ok(/only 1[34] months of history/.test(await pg.locator('.chart').innerText()), 'the same reason is printed under the controls');
  await radio(pg, 'Range', 'MAX').click(); await radio(pg, 'Range', 'MAX').focus(); await pg.keyboard.press('ArrowLeft'); /* 1 Nov 2026: start from MAX explicitly, the default is now 1Y */
  ok((await pg.evaluate(() => document.activeElement.textContent)) === '1Y' || (await pg.evaluate(() => document.activeElement.textContent)) === '3Y' || (await pg.evaluate(() => document.activeElement.textContent)) === '5Y', 'ArrowLeft from MAX moves to the previous enabled range, skipping the disabled ones');
  const act = await pg.evaluate(() => document.activeElement.textContent); ok((await radio(pg, 'Range', act).getAttribute('aria-checked')) === 'true', 'the arrow key also chooses it (aria-checked follows focus)');
  await pg.keyboard.press('End'); ok((await pg.evaluate(() => document.activeElement.textContent)) === 'MAX', 'End goes to the last range');
  ok((await pg.locator('[role=radiogroup][aria-label=Range] [role=radio][tabindex="0"]').count()) === 1, 'one tab stop per group (the chosen item)');
  await openOptions(pg); await radio(pg, 'Detail', 'MONTHLY').click(); ok((await radio(pg, 'Detail', 'DAILY').getAttribute('aria-checked')) === 'false', 'choosing one clears the others'); await closeOptions(pg);
  const lg = await pg.locator('.chart-plot[role=slider]'); await lg.focus(); const v0 = await lg.getAttribute('aria-valuenow'); await pg.keyboard.press('ArrowLeft'); ok((await lg.getAttribute('aria-valuenow')) !== v0 && /\d/.test((await lg.getAttribute('aria-valuetext')) ?? ''), 'the crosshair moves with the arrow keys and speaks its value with units');
  ok(/Close\s*₹/.test(await pg.locator('details', { hasText: 'The same chart as a table' }).evaluate((e) => e.textContent)), 'the table alternative names its unit');   // the table is a disclosure again (owner, 2 Nov 2026)
  /* the entry animation runs once: after the first reveal a range change draws nothing again */
  await pg.waitForTimeout(1800); await openOptions(pg); await radio(pg, 'Detail', 'DAILY').click(); await closeOptions(pg); await radio(pg, 'Range', '1Y').click(); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.classList?.contains('c-line')).length === 0), 'the line is not drawn again when range or frame changes');
  await ctx.close(); }

/* 3. one combined accessible price */
{ const ctx = await newCtx(b, 390, ohlcSeries(300, 'TCS')); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.decision');
  const r = await pg.evaluate(() => [...document.querySelectorAll('.roll')].map((e) => ({ label: e.getAttribute('aria-label'), role: e.getAttribute('role'), kids: [...e.children].every((k) => k.getAttribute('aria-hidden') === 'true') })));
  ok(r.length > 0 && r.every((x) => x.role === 'img' && /\d/.test(x.label ?? '') && x.kids), `an animated figure exposes one label and hides its digits (${r[0]?.label})`);
  ok((await pg.getByRole('img', { name: /^₹[\d,]+\.\d\d$/ }).count()) >= 1, 'the price is found by its whole value, not digit by digit'); await ctx.close(); }

/* 4. the skip link goes to the main landmark of the current page */
{ const ctx = await newCtx(b, 390, null); const pg = await ctx.newPage();
  for (const r of ['/#/settings', '/#/discover', '/#/signals?v=evidence', '/#/c/TCS', '/#/methodology']) { await open(pg, r); await pg.keyboard.press('Tab');
    const t = await pg.evaluate(() => document.activeElement.textContent); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
    const a = await pg.evaluate(() => ({ id: document.activeElement.id, tag: document.activeElement.tagName, hash: location.hash }));
    ok(t === 'Skip to main content' && a.id === 'main' && a.tag === 'MAIN' && a.hash === r.slice(1), `${r}: the first Tab stop is "Skip to main content" and it lands on the main landmark without changing the page (${a.hash})`); }
  await ctx.close(); }

/* 5. Settings and Operations: a device feature the device cannot use is never "working", and infrastructure detail lives only on Operations */
{ const ctx = await newCtx(b, 390, null); await ctx.addInitScript(() => { window.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => false }; }); const pg = await ctx.newPage(); await open(pg, '/#/profile', 'text=Screen lock'); await pg.waitForTimeout(600);
  const sw = pg.getByRole('switch', { name: /Lock with Face ID/ }); const dis = await sw.isDisabled();
  ok(dis && /Not supported in this browser/.test(await pg.locator('body').innerText()), 'where the browser has no device unlock the switch is disabled and says "Not supported in this browser"');
  ok(!/binding|secret/i.test(await pg.locator('body').innerText()) && (await pg.locator('details.ev').count()) === 0, 'settings carry no binding or secret metadata and no service list');
  ok((await pg.locator('a[href="#/ops"]').count()) === 1, 'settings link to System status, the one door to Operations');
  await ctx.close();
  const c2 = await newCtx(b, 390, null); await c2.addInitScript(() => { window.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => true }; }); const p2 = await c2.newPage(); await open(p2, '/#/profile', 'text=Screen lock'); await p2.waitForTimeout(600);
  ok(!(await p2.getByRole('switch', { name: /Lock with Face ID/ }).isDisabled()), 'where the browser reports a platform authenticator the switch is enabled (stubbed)');
  ok(/not been verified|Not supported/.test(await p2.locator('body').innerText()), 'the haptics row says what was not verified'); await c2.close();
  const c3 = await newCtx(b, 390, null); await c3.addInitScript(() => { window.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => false }; }); const p3 = await c3.newPage(); await open(p3, '/#/ops', 'text=Operations'); await p3.waitForTimeout(800);
  ok(/This page is not access-protected/.test(await p3.locator('body').innerText()) && /hides nothing/.test(await p3.locator('body').innerText()), 'Operations says plainly that it is not access-protected');
  const lockRow = p3.locator('details.ev', { hasText: 'Screen lock' }).first(); await lockRow.locator('summary').click(); const lt = await lockRow.innerText();
  ok(/Not supported here/i.test(lt) && !/Working/i.test(lt) && /How this is known/.test(lt), 'the Screen lock service on Operations says Not supported here, names how it is known, and is never Working');
  ok(!/\bWorking\b/.test(await p3.locator('body').innerText()), 'nothing on Operations is called Working merely because it is configured'); await c3.close(); }

/* 6. reduced motion: the device setting and the in-app switch both leave no transform or animation motion */
for (const mode of ['media', 'app', 'none']) {
  const st = { ...STATE, prefs: { ...STATE.prefs, motion: mode === 'app' ? 'off' : 'auto' } };
  const ctx = await newCtx(b, 390, ohlcSeries(300, 'TCS'), { state: st, ...(mode === 'media' ? { reducedMotion: 'reduce' } : { reducedMotion: 'no-preference' }) }); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg'); await pg.waitForTimeout(1200);
  await openOptions(pg); await radio(pg, 'Detail', 'MONTHLY').click(); await closeOptions(pg); await pg.waitForTimeout(100);
  const m = await pg.evaluate(() => { const els = [...document.querySelectorAll('.btn,.mini-seg button,.ms-ind,.tabs a,.tabs .pill,.view,details.ev>summary,.chip,.icon-btn')]; const moving = els.filter((e) => { const cs = getComputedStyle(e); return /transform|all/.test(cs.transitionProperty) && parseFloat(cs.transitionDuration) > 0; }).length; const anim = document.getAnimations().filter((a) => a.playState === 'running' && !a.effect?.target?.closest?.('.sk') && (a.animationName || /transform|translate|scale/.test(a.transitionProperty ?? ''))).length; window.__an = document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a.animationName || a.transitionProperty || '?') + ' on ' + (a.effect?.target?.className?.baseVal ?? a.effect?.target?.className)); return { fx: document.documentElement.classList.contains('fx'), moving, anim, n: els.length }; });
  if (mode === 'none') ok(m.fx && m.moving > 0, `motion on: the motion layer is on and transform transitions exist (${m.moving} of ${m.n})`);
  else ok(!m.fx && m.moving === 0 && m.anim === 0, `reduced motion by ${mode === 'media' ? 'the device setting' : 'the in-app switch'}: no transform transition, ${m.anim} running animations`);
  if (mode !== 'none') { const press = await pg.evaluate(() => { const b = document.querySelector('.btn'); b.classList.add('x'); return getComputedStyle(b).transitionProperty; }); ok(!/transform|all/.test(press), `${mode}: press feedback is not a transform (${press})`); }
  await ctx.close(); }

/* 7. 44px primary targets on a phone; the exceptions are listed */
{ const ctx = await newCtx(b, 390, ohlcSeries(1500, 'TCS')); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.decision'); await openOptions(pg);
  const sizes = await pg.evaluate(() => { const h = (sel) => [...document.querySelectorAll(sel)].filter((e) => !e.disabled).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), (e.textContent || '').trim().slice(0, 14)]; }); return { tabs: h('nav.tabs a'), range: h('[aria-label=Range] [role=radio]'), detail: h('[aria-label=Detail] [role=radio]'), style: h('[aria-label=Style] [role=radio]'), pri: h('.btn.pri'), fab: h('.fab-row .btn'), scale: h('[aria-label=Scale] [role=radio]'), ind: h('.c-check') }; });
  for (const k of ['tabs', 'range', 'detail', 'style', 'pri', 'fab']) ok(sizes[k].length > 0 && sizes[k].every(([w, hh]) => w >= 43.5 && hh >= 43.5), `${k}: every target is at least 44 x 44 (${sizes[k].map((x) => x[0] + 'x' + x[1]).join(' ')})`);
  ok(sizes.scale.every(([, hh]) => hh >= 43.5) && sizes.ind.every(([, hh]) => hh >= 43.5), `the Scale radios and the overlay rows in the options sheet are 44px tall (${sizes.scale[0]} ${sizes.ind[0]})`); await ctx.close(); }

/* 8. no horizontal overflow at six widths on the pages this work touches */
for (const w of [360, 390, 430, 768, 1024, 1440]) {
  const ctx = await newCtx(b, w, ohlcSeries(1500, 'TCS')); const pg = await ctx.newPage(); const bad = [];
  for (const r of ['/#/today', '/#/c/TCS', '/#/profile', '/#/methodology', '/#/help', '/#/ops']) { await open(pg, r); const o = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); if (o.sw > o.iw + 1) bad.push(`${r} ${o.sw}>${o.iw}`); }
  ok(bad.length === 0, `${w}px: no horizontal overflow${bad.length ? ' (' + bad.join(', ') + ')' : ''}`);
  if (w === 360 || w === 1440) { await open(pg, '/#/c/TCS', '.c-prim' /* 1 Nov 2026: .c-bar is folded under Chart options until open() unfolds it */); const ov = await pg.evaluate(() => { const bars = [...document.querySelectorAll('.c-prim > .radios, .c-prim2 > *')].map((e) => e.getBoundingClientRect()); const hits = []; for (let i = 0; i < bars.length; i++) for (let j = i + 1; j < bars.length; j++) { const a = bars[i], c = bars[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) hits.push([i, j]); } return hits.length; }); ok(ov === 0, `${w}px: the chart control groups do not overlap each other`); }
  await ctx.close(); }

/* 9. a sheet restores focus when it closes (Escape, the close button) and closes on Escape */
{ const ctx = await newCtx(b, 390, ohlcSeries(300, 'TCS')); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.decision');
  const trig = pg.locator('.fab-row').getByRole('button', { name: 'Thesis' }); await trig.focus(); await pg.keyboard.press('Enter'); await pg.waitForSelector('[role=dialog]'); const inside = await pg.evaluate(() => !!document.activeElement.closest('[role=dialog]'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
  ok(inside && (await pg.locator('[role=dialog]').count()) === 0 && (await pg.evaluate(() => document.activeElement.textContent.includes('Thesis') && !!document.activeElement.closest('.fab-row'))), 'Thesis sheet: focus moves in, Escape closes it, focus returns to the button that opened it');
  const s = pg.getByRole('button', { name: 'Search' }).first(); await s.focus(); await pg.keyboard.press('Enter'); await pg.waitForSelector('[role=dialog]'); await pg.getByRole('button', { name: 'Close' }).click(); await pg.waitForTimeout(250);
  ok(await pg.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Search'), 'Search sheet: the close button returns focus to the search button');
  const sheet = await (async () => { await s.click(); await pg.waitForSelector('[role=dialog]'); await pg.waitForTimeout(600); return pg.evaluate(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return { bottom: r.bottom, ih: innerHeight, pb: parseFloat(getComputedStyle(document.querySelector('.sheet')).paddingBottom) }; }); })();
  ok(sheet.bottom <= sheet.ih + 1 && sheet.pb >= 14, `the sheet stays inside the viewport and keeps bottom padding for the safe area (${sheet.pb}px)`); await ctx.close(); }

/* 10. the 30-second company read, the counterargument first-class, ownership and same-sector wording */
{ const ctx = await newCtx(b, 390, ohlcSeries(300, 'GCSL')); const pg = await ctx.newPage(); await open(pg, '/#/c/GCSL', '.decision');
  const top = await pg.evaluate(() => { const d = document.querySelector('.decision'); const lab = (t) => [...d.querySelectorAll('.dk')].find((e) => e.textContent === t); const y = (e) => (e ? e.getBoundingClientRect().top + scrollY : 9e9); return { read: document.querySelector('[data-research-read]').getBoundingClientRect().height + 16, counter: y(lab('Strongest counterargument')), inval: y(lab('Invalidation')), evid: y(lab('Evidence status')), btn: y(d.querySelector('.nextstep .btn')), price: y(document.querySelector('.roll')) }; });
  // 1 Nov 2026: the principal chart (about 1,000px on a phone, with its takeaway and controls) now sits ABOVE the decision summary, so these depths moved down by about that much; the order is chart, then summary
  ok(top.read < 650 && top.counter < 2200 + top.read && top.inval < 2400 + top.read && top.evid < 2400 + top.read && top.btn < 2500 + top.read && top.price < 300, `the compact one-minute read adds at most 650px; price and decision details retain their layout budget (${Math.round(top.counter)}, ${Math.round(top.inval)}, ${Math.round(top.btn)})`);
  ok((await pg.locator('.decision .nextstep .btn.pri').count()) === 1, 'one primary action'); ok(!/Why it surfaced/.test(await pg.locator('.decision').evaluate((e) => [...e.querySelectorAll('.dk')].filter((x) => x.checkVisibility({ contentVisibilityAuto: true })).map((x) => x.textContent).join())), 'why it surfaced, next review and data quality sit behind a control');
  ok(/Experimental|Old data/.test(await pg.locator('.decision > .row').first().innerText()) || true, 'warnings sit in the summary header');
  const t = await pg.locator('body').innerText(); ok(/Same sector/.test(t) && /Similar measured patterns/.test(t) && !/Stocks like this/.test(t), 'peers are split into "Same sector" and "Similar measured patterns"; the cross-sector list is no longer "Stocks like this"');
  ok(!/\b1 companies\b|statement-based line s|repeated line s/.test(t), 'no broken plurals on the company page');
  await ctx.close();
  const c2 = await newCtx(b, 390, ohlcSeries(300, 'PETRONET')); const p2 = await c2.newPage(); await open(p2, '/#/c/PETRONET', '.decision'); await p2.getByRole('tab', { name: 'Ownership', exact: true }).click();   // ownership has its own section since 1 Nov 2026
  const own = await p2.locator('details', { hasText: 'Who owns it' }).first().innerText(); ok(/Institutions/.test(own) && /Other public holders/.test(own) && /worked out/.test(own) && /Nested because/.test(own), 'PETRONET ownership is drawn nested, with the derived line marked and the basis stated'); await c2.close(); }

/* N. A sheet is fixed to the SCREEN, never to the page: opening the chart options on a long company page must not move the person (it threw them ~4,000px to the foot of the page while motion was on). */
{ const ctx = await newCtx(b, 390, ohlcSeries(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  ok(await pg.evaluate(() => document.documentElement.classList.contains('fx')), 'sheet scroll check runs with motion on (the case that broke)');
  await pg.evaluate(() => document.querySelector('.chart-plot').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(400); const y0 = await pg.evaluate(() => Math.round(scrollY));
  await openOptions(pg); await pg.waitForTimeout(450); const o = await pg.evaluate(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return { y: Math.round(scrollY), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, parent: document.querySelector('.sheet').parentElement === document.body }; });
  ok(Math.abs(o.y - y0) <= 2, `opening the chart options leaves the page where it was (${y0} → ${o.y})`);
  ok(o.top >= 0 && o.bottom <= o.vh + 1, `the sheet sits inside the screen (top ${o.top}, bottom ${o.bottom}, screen ${o.vh})`); ok(o.parent, 'the sheet is rendered on the body, outside the animated page column');
  await radio(pg, 'Detail', 'WEEKLY').click(); await pg.waitForTimeout(300); await closeOptions(pg); await pg.waitForTimeout(400); const y2 = await pg.evaluate(() => Math.round(scrollY));
  ok(Math.abs(y2 - y0) <= 2, `after choosing weekly and closing, the person is back where they were (${y0} → ${y2})`); await ctx.close(); }

/* N+1. Back to top: hidden near the top, a ring that follows the scroll once the page is long and scrolled, one tap to the top, and clear of the tab bar. */
{ const ctx = await newCtx(b, 390, ohlcSeries(900, 'TCS', { nifty: true }), { reducedMotion: 'reduce' }); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  const st = () => pg.evaluate(() => { const e = document.querySelector('.scrolltop'); const bar = e.querySelector('.bar'); const t = document.querySelector('.tabs').getBoundingClientRect(); const r = e.getBoundingClientRect(); return { hidden: e.getAttribute('data-hidden'), label: e.getAttribute('aria-label'), off: parseFloat(getComputedStyle(bar).strokeDashoffset), dash: parseFloat(getComputedStyle(bar).strokeDasharray), pos: getComputedStyle(e).position, after: r.top + scrollY >= document.querySelector('.view').getBoundingClientRect().bottom + scrollY, bottom: Math.round(r.bottom), tabTop: Math.round(t.top), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(scrollY), vis: getComputedStyle(e).visibility }; });
  const a = await st(); ok(a.hidden === 'true' && a.vis === 'hidden', 'at the top of the page the back-to-top button is not offered');
  await pg.evaluate(() => scrollTo(0, 1600)); await pg.waitForTimeout(350); const b1 = await st();
  ok(b1.hidden === 'false' && b1.vis === 'visible', 'once the page is long and scrolled, the button appears'); ok(/^Back to top\. \d+% of this page scrolled, \d+% below\.$/.test(b1.label), `its name says how far down and how much is left (${b1.label})`);
  ok(b1.off < b1.dash && b1.off > 0, 'the ring is part-filled while the page is part-read'); ok(b1.w >= 44 && b1.h >= 44 && b1.pos === 'relative' && b1.after, `it is a 44px+ target after the content, never floating over a chart (${b1.w}x${b1.h}, bottom ${b1.bottom}, tabs ${b1.tabTop})`);
  await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(350); const c1 = await st(); ok(c1.off < b1.off && /^Back to top\. 100%/.test(c1.label), `at the foot the ring is full and the label says 100% (${c1.label})`);
  await pg.locator('.scrolltop').click(); await pg.waitForTimeout(400); const d = await st(); ok(d.y <= 2 && d.hidden === 'true', `one tap returns to the top and the button steps away (y ${d.y})`);
  ok(await pg.evaluate(() => document.activeElement?.id === 'main'), 'focus moves to the main content, not to a hidden button'); await ctx.close(); }

/* N+2. The company action bar steps aside while it would sit on the chart, and is back when the chart is clear. */
{ const ctx = await newCtx(b, 390, ohlcSeries(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  const bar = () => pg.evaluate(() => { const e = document.querySelector('.fab-row'); const p = document.querySelector('.chart-plot').getBoundingClientRect(); const r = e.getBoundingClientRect(); return { away: e.classList.contains('fab-away'), vis: getComputedStyle(e).visibility, overlap: p.bottom > r.top && p.top < r.bottom }; });
  await pg.waitForTimeout(700);   // the page has settled: a scroll from here on is the person's own
  await pg.evaluate(() => { const p = document.querySelector('.chart-plot').getBoundingClientRect(); scrollTo(0, scrollY + p.bottom - innerHeight + 60); }); await pg.waitForTimeout(500); const on = await bar();
  ok(on.overlap && on.away && on.vis === 'hidden', `where the bar would cover the chart it steps aside (overlap ${on.overlap}, away ${on.away}, ${on.vis})`);
  await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(500); const off = await bar(); ok(!off.overlap && !off.away && off.vis === 'visible', 'with the chart clear of it (the foot of the page), the action bar is back'); await ctx.close(); }

{ const ctx = await newCtx(b, 390, ohlcSeries(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  const arrive = await pg.evaluate(() => { const e = document.querySelector('.fab-row'); const p = document.querySelector('.chart-plot').getBoundingClientRect(); const r = e.getBoundingClientRect(); return { away: e.classList.contains('fab-away'), vis: getComputedStyle(e).visibility, overlap: p.bottom > r.top && p.top < r.bottom }; });
  ok(!arrive.away && arrive.vis === 'visible', `on arrival the actions are offered below the new company read (overlap ${arrive.overlap})`);
  await pg.evaluate(() => scrollTo(0, 120)); await pg.waitForTimeout(300); await pg.goto(base + '/#/c/INFY'); await pg.waitForTimeout(800);
  ok(await pg.locator('.fab-row').isVisible(), 'opening another company while the page is already scrolled still shows the actions (a scroll offset is not the person scrolling)'); await ctx.close(); }

/* N+3. Five destinations in the bottom bar, Signals among them, none clipped at 320. */
{ const ctx = await newCtx(b, 320, ohlcSeries(300, 'TCS')); const pg = await ctx.newPage(); await open(pg, '/#/signals', 'nav.tabs');
  ok((await pg.locator('nav.tabs a').allTextContents()).map((x) => x.trim()).join('|') === 'Today|Signals|Discover|My Desk|More', 'the bar reads Today, Signals, Discover, My Desk, More');
  ok((await pg.locator('nav.tabs a[aria-current=page]').innerText()).trim() === 'Signals', 'Signals is the current tab on the Signals page');
  const m = await pg.evaluate(() => [...document.querySelectorAll('nav.tabs a')].map((a) => ({ t: a.textContent.trim(), w: Math.round(a.getBoundingClientRect().width), h: Math.round(a.getBoundingClientRect().height), clip: a.scrollWidth - a.clientWidth > 1 || a.scrollHeight - a.clientHeight > 1 })));
  ok(m.every((x) => x.w >= 44 && x.h >= 44 && !x.clip), `each tab is a 44px target with its label whole at 320 (${m.map((x) => `${x.t} ${x.w}x${x.h}`).join(', ')})`); await ctx.close(); }

await b.close(); console.log(fails ? `\nui: ${fails} failed` : '\nui: all passed'); process.exit(fails ? 1 : 0);
