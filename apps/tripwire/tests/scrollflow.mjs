// Scrolling, end to end (13 Nov 2026, v6). Each check below failed on the build before the fix; none reads the live clock (scroll positions are set directly, waits are for the page, not for a time of day).
//  1. stacked sheets (Chart options, then Ctrl+K) left body{overflow:hidden} behind once both closed: the page could not scroll until a reload
//  2. a link click reset scroll to 0 while the OLD screen was still on show (route transition): the old page jumped to the top, then the new one slid in
//  3. the Discover table and the company financials table were vertical scrollers inside the page (wheel and swipes captured; no hand-over at the end)
//  4. wheel, PageDown, Space, End and Home move the window on a desktop; a touch drag moves it on a phone
//  5. Back from a company page returns to the scroll position of Today, Discover and the Book
// Usage: node apps/tripwire/tests/scrollflow.mjs [baseUrl]
import { chromium, newCtx, ohlcSeries } from './uimock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const Y = (pg) => pg.evaluate(() => Math.round(scrollY));
const open = async (pg, r, sel) => { await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); if (sel) await pg.waitForSelector(sel, { timeout: 20000 }); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(700); };
const series = ohlcSeries(900, 'TCS', { nifty: true });

// 1. stacked sheets
{ const ctx = await newCtx(b, 1280, series); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  await pg.getByRole('button', { name: /^Chart options/ }).click(); await pg.waitForSelector('.sheet'); await pg.keyboard.press('Control+k'); await pg.waitForTimeout(700);
  ok(await pg.locator('.sheet').count() === 2, 'two sheets are open (Chart options, then Search)');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  ok(await pg.locator('.sheet').count() === 1, 'Escape closes only the top sheet');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  ok(await pg.locator('.sheet').count() === 0 && await pg.evaluate(() => document.body.style.overflow) === '', 'both closed: body overflow is back to normal, not "hidden"');
  await pg.mouse.move(600, 500); await pg.mouse.wheel(0, 500); await pg.waitForTimeout(400); ok(await Y(pg) > 100, `and the page scrolls (y ${await Y(pg)})`);
  await ctx.close(); }

// 2. the scroll resets when the new screen is shown, not before
{ const ctx = await newCtx(b, 1280, series); const pg = await ctx.newPage(); await open(pg, '/#/discover', '.list .li');
  await pg.evaluate(() => scrollTo(0, 700)); await pg.waitForTimeout(250);
  const log = await pg.evaluate(() => new Promise((res) => { const out = []; const t0 = performance.now(); [...document.querySelectorAll('a[href^="#/c/"]')].find((x) => { const r = x.getBoundingClientRect(); return r.top > 0 && r.top < innerHeight; }).click();
    const f = () => { out.push([Math.round(scrollY), document.querySelector('.view h1')?.textContent ?? '']); if (performance.now() - t0 < 900) requestAnimationFrame(f); else res(out); }; f(); }));
  const oldShown = log.filter(([, h]) => h === 'Research'); const early = oldShown.filter(([y]) => y < 5);
  ok(oldShown.length > 0 && early.length === 0, `while the old screen is still shown the page stays put (${oldShown.length} frames, ${early.length} of them already at the top)`);
  ok(log[log.length - 1][0] === 0 && log[log.length - 1][1] !== 'Research', 'and the company page opens at the top');
  await ctx.close(); }

// 3. no vertical scroller inside the page (sheets excepted), desktop and phone
for (const [w, touch] of [[1280, false], [390, true]]) {
  const ctx = await newCtx(b, w, series, touch ? { isMobile: true, hasTouch: true } : {}); const pg = await ctx.newPage(); const bad = [];
  for (const r of ['/#/today', '/#/discover?view=table', '/#/signals', '/#/more', '/#/c/TCS', '/#/compare?s=TCS,INFY', '/#/m/GOLD', '/#/data']) {
    await open(pg, r);
    const d = await pg.evaluate(() => [...document.querySelectorAll('*')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2 && e.clientHeight > 0 && !e.closest('.sheet')).map((e) => e.tagName + '.' + String(e.className).slice(0, 24)));
    const lock = await pg.evaluate(() => [document.documentElement, document.body].map((e) => getComputedStyle(e).overflowY).join());
    if (d.length || lock !== 'visible,visible') bad.push(`${r}: ${d.join(' ')} ${lock}`);
  }
  ok(bad.length === 0, `${w}: the window is the only vertical scroller on 8 routes, and html/body are never locked ${bad.join(' | ')}`);
  await ctx.close(); }

// 4a. desktop wheel and keys, and the wheel over a table hands over to the page
{ const ctx = await newCtx(b, 1280, series); const pg = await ctx.newPage(); await open(pg, '/#/today');
  const room = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight); ok(room > 200, `Today has room to scroll (${room}px)`);   // relative to the real page: a short Today must still move, and must reach its end
  await pg.mouse.move(700, 500); await pg.mouse.wheel(0, 300); await pg.waitForTimeout(500); const w = await Y(pg); ok(w >= Math.min(280, room - 2), `wheel scrolls Today (y ${w} of ${room})`);
  await pg.keyboard.press('PageDown'); await pg.waitForTimeout(500); const a = await Y(pg); ok(a > w || w >= room - 2, `PageDown moves on (y ${a})`);
  await pg.keyboard.press('End'); await pg.waitForTimeout(900); ok(await pg.evaluate(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) < 3), 'End reaches the foot');
  await pg.keyboard.press('Home'); await pg.waitForTimeout(900); ok(await Y(pg) === 0, 'Home returns to the top');
  await pg.keyboard.press('Space'); await pg.waitForTimeout(500); ok(await Y(pg) >= Math.min(300, room) * 0.8, 'Space pages down');
  await open(pg, '/#/discover?view=table', '.stbl'); await pg.evaluate(() => scrollTo(0, document.querySelector('.stbl-wrap').getBoundingClientRect().top + scrollY - 100)); await pg.waitForTimeout(200);
  const p = await pg.evaluate(() => { const r = document.querySelector('.stbl-wrap').getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(innerHeight - 100, r.y + 200) }; });
  await pg.mouse.move(p.x, p.y); const y0 = await Y(pg); for (let i = 0; i < 8; i++) { await pg.mouse.wheel(0, 300); await pg.waitForTimeout(100); }
  ok(await Y(pg) > y0 + 1000, `the wheel over the results table scrolls the page (${y0} to ${await Y(pg)})`);
  await ctx.close(); }

// 4b. phone touch drag
{ const ctx = await newCtx(b, 390, series, { isMobile: true, hasTouch: true }); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg'); const cdp = await ctx.newCDPSession(pg);
  const drag = async (x, y0, dy) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] }); for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - (dy * i) / 12 }] }); await pg.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(700); };
  await drag(200, 600, 400); const a = await Y(pg); ok(a > 200, `a swipe moves a company page (y ${a})`);
  const t = await pg.evaluate(() => { const e = document.querySelector('.cf-table'); if (!e) return null; e.scrollIntoView({ block: 'start' }); const r = e.getBoundingClientRect(); return { y: Math.round(scrollY), mid: Math.min(innerHeight - 120, r.top + 200) }; });
  if (t) { await pg.waitForTimeout(200); const y1 = await Y(pg); await drag(200, Math.max(200, t.mid), 300); ok(await Y(pg) > y1 + 150, `a swipe that starts on the financials table moves the page (${y1} to ${await Y(pg)})`); }
  await ctx.close(); }

// 5. Back restores the scroll
{ const ctx = await newCtx(b, 1280, series); const pg = await ctx.newPage();
  for (const r of ['/#/today', '/#/discover', '/#/signals']) {
    await open(pg, r); await pg.evaluate(() => scrollTo(0, 600)); await pg.waitForTimeout(300); const y0 = await Y(pg);
    await pg.evaluate(() => { location.hash = '#/c/TCS'; }); await pg.waitForSelector('.c-head', { timeout: 20000 }); await pg.waitForTimeout(600); const y1 = await Y(pg);
    await pg.goBack(); await pg.waitForTimeout(1800); const y2 = await Y(pg);
    ok(y1 === 0 && Math.abs(y2 - y0) <= 4, `${r}: the company page opens at the top (${y1}) and Back returns to ${y0} (${y2})`);
  }
  await ctx.close(); }
await b.close(); console.log(fails ? `\nscrollflow: ${fails} failed` : '\nscrollflow: all passed'); process.exit(fails ? 1 : 0);
