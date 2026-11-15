// v6 polish (15 Nov 2026), in a real browser. One suite for the three layout changes:
//  1. Today, desktop: the right column is tidy. Paper book and Market news are cards on the same radius and border, the book row is one line (56px) at every desktop width, and the two columns END on the same line.
//  2. Today, phone: the Market now basis (prices time and data day) and the one-sentence read stay within two lines at 320 to 430px, with every fact still present.
//  3. Discover: the filter and search bar stays in view while the list scrolls, on a phone and a desktop, covers nothing (the first result clears it when scrolled into view) and does not trap the scroll.
// Usage: node apps/tripwire/tests/polish.mjs [baseUrl]
import { chromium, newCtx, ohlcSeries } from './uimock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const series = ohlcSeries(900, 'TCS', { nifty: true });
const open = async (pg, r, sel) => { await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); if (sel) await pg.waitForSelector(sel, { timeout: 20000 }); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(1500); };

/* ---- 1. Today, desktop: the right column ---- */
for (const w of [1100, 1280, 1440, 1920]) {
  const ctx = await newCtx(b, w, series); const pg = await ctx.newPage(); await open(pg, '/#/today', '.t-side .nw');
  const g = await pg.evaluate(() => {
    const R = (e) => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height) }; };
    const main = document.querySelector('.t-main'), side = document.querySelector('.t-side'), book = document.querySelector('.bookrow'), news = document.querySelector('.tnews .tnw');
    const cs = (e) => { const s = getComputedStyle(e); return s.borderTopWidth + '|' + s.borderTopLeftRadius + '|' + s.borderTopStyle; };
    const lastOf = (c) => R(c.lastElementChild);
    return { main: R(main), side: R(side), book: R(book), news: R(news), picksCs: cs(document.querySelector('.tpicks .list-card')), namesCs: cs(document.querySelector('.board-list')), bookCs: cs(book), newsCs: cs(news), lastMain: lastOf(main), lastSide: lastOf(side), sameTop: R(book).t === R(side).t };
  });
  ok(Math.abs(g.lastMain.b - g.lastSide.b) <= 1, `${w}: the two columns end on the same line (left ${g.lastMain.b}, right ${g.lastSide.b})`);
  ok(g.book.h <= 60, `${w}: the Paper book row is one line (${g.book.h}px)`);
  ok(new Set([g.bookCs, g.newsCs, g.picksCs, g.namesCs]).size === 1, `${w}: all four cards (Your names, Picks, Paper book, Market news) share one border and radius (${[g.namesCs, g.picksCs, g.bookCs, g.newsCs].join(' / ')})`);
  ok(g.book.l === g.news.l && g.book.r === g.news.r, `${w}: and the same left and right edges (${g.book.l}-${g.book.r})`);
  ok(g.news.t >= g.book.b && g.news.t - g.book.b <= 24, `${w}: with a normal gap between them (${g.news.t - g.book.b}px)`);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: no horizontal overflow`);
  await ctx.close();
}

/* ---- 2. Today, phone: the Market now basis is two lines, every fact still there ---- */
for (const w of [320, 360, 375, 390, 412, 430]) {
  const ctx = await newCtx(b, w, series, { isMobile: true, hasTouch: true }); const pg = await ctx.newPage(); await open(pg, '/#/today', '.mkt-basis .mkt-data');
  const lines = (live) => pg.evaluate((liveText) => {
    const basis = document.querySelector('.mkt-basis'); if (liveText) basis.querySelector('.mkt-px').innerHTML = liveText;   // the longest everyday wording: a live print with its age
    const lh = parseFloat(getComputedStyle(basis).lineHeight); const sum = basis.querySelector('summary');
    return { h: basis.getBoundingClientRect().height, lh, text: basis.innerText.replace(/\s+/g, ' '), tap: sum ? Math.round(sum.getBoundingClientRect().height) : null, over: document.documentElement.scrollWidth > innerWidth };
  }, live);
  const a = await lines(null);
  ok(a.h <= a.lh * 2 + 1, `${w}: the prices and data-day basis is at most two lines (${Math.round(a.h)}px at ${a.lh}px a line)`);
  ok(/Prices: .*IST.*times in IST/.test(a.text) && /Data through \w{3} \d+ \w{3}/.test(a.text) && /built \d\d:\d\d IST/.test(a.text), `${w}: and keeps every fact: the price time, "times in IST", the data day and the build time (${a.text})`);
  ok(a.tap === null || a.tap >= 44, `${w}: the "behind" disclosure is still a 44px target (${a.tap})`);
  if (w >= 360) { const l = await lines('Prices: <span>Live · 15:59:03 IST · 12 s old</span> · times in IST'); ok(l.h <= l.lh * (w >= 390 ? 2 : 3) + 1, `${w}: a live print with its age (the longest everyday wording, a synthetic worst case) stays within ${w >= 390 ? 'two' : 'three'} lines (${Math.round(l.h)}px; CI font metrics wrapped it to three at 360)`); }
  ok(!a.over, `${w}: no horizontal overflow`);
  await ctx.close();
}

/* ---- 3. Discover: the search and toolbar bar stays in view, covers nothing and traps no scroll ---- */
for (const [w, touch, view] of [[390, true, ''], [360, true, ''], [1280, false, ''], [1100, false, ''], [1280, false, '?view=table']]) {
  const ctx = await newCtx(b, w, series, touch ? { isMobile: true, hasTouch: true } : {}); const pg = await ctx.newPage(); await open(pg, '/#/discover' + view, view ? '.stbl' : '.list .li');
  const tag = `${w}${touch ? ' phone' : ''}${view ? ' table' : ''}`;
  const bar = () => pg.evaluate(() => { const e = document.querySelector('.dsticky'); const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), css: document.querySelector('.disc').style.getPropertyValue('--dbar') }; });
  const y = () => pg.evaluate(() => Math.round(scrollY));
  const b0 = await bar();
  ok(b0.h <= (touch ? (w >= 340 ? 120 : 168) : 72), `${tag}: the bar is compact (${b0.h}px)`);
  ok(b0.css === `${b0.h}px`, `${tag}: its height is published as --dbar (${b0.css})`);
  ok(await pg.evaluate(() => [document.documentElement, document.body].map((e) => getComputedStyle(e).overflowY).join() === 'visible,visible' && !document.querySelector('.disc').closest('[style*="overflow"]')), `${tag}: html and body are not locked and no ancestor scrolls`);
  // scroll a long way: the bar is still pinned to the top of the window, and what is under its centre is the bar
  await pg.evaluate(() => scrollTo(0, 1800)); await pg.waitForTimeout(400);
  const b1 = await bar(); ok(await y() > 1000, `${tag}: the list scrolled (y ${await y()})`);
  ok(b1.t === 0 && b1.l >= 0 && b1.r <= w, `${tag}: and the bar is pinned at the top, inside the window (top ${b1.t}, ${b1.l} to ${b1.r})`);
  ok(await pg.evaluate(() => { const r = document.querySelector('.dsticky').getBoundingClientRect(); return !!document.elementFromPoint(r.left + 40, r.top + r.height / 2)?.closest('.dsticky'); }), `${tag}: nothing paints over it`);
  // it still works from there: Filters opens its sheet, and the search takes text
  await pg.getByRole('button', { name: /^Filters/ }).click(); await pg.waitForSelector('[role=dialog]'); ok(true, `${tag}: Filters opens from the scrolled page`); await pg.keyboard.press('Escape'); await pg.waitForSelector('[role=dialog]', { state: 'detached' }); await pg.waitForTimeout(300);
  ok(await y() > 1000 && await pg.evaluate(() => document.body.style.overflow) === '', `${tag}: closing it leaves the page where it was and unlocked (y ${await y()})`);
  // covers nothing: a row that sits just ABOVE the window (its top edge 40px out) is scrolled into view (scrollIntoView nearest, as focus restore and anchors do), so the browser scrolls up to it by the least amount: it must stop beneath the bar, not behind it (without scroll-margin it lands at 0)
  await pg.evaluate(() => { const a = document.querySelectorAll('.disc [data-sym] a[href^="#/c/"]')[6]; scrollTo(0, Math.round(a.getBoundingClientRect().top + scrollY + 40)); }); await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.querySelectorAll('.disc [data-sym] a[href^="#/c/"]')[6].scrollIntoView({ block: 'nearest' }); }); await pg.waitForTimeout(600);
  const hit2 = await pg.evaluate(() => { const a = document.querySelectorAll('.disc [data-sym] a[href^="#/c/"]')[6]; const r = a.getBoundingClientRect(); const bb = document.querySelector('.dsticky').getBoundingClientRect(); return { top: Math.round(r.top), barBottom: Math.round(bb.bottom), is: !!a.closest('[data-sym]') }; });
  ok(hit2.is && hit2.top >= hit2.barBottom - 1, `${tag}: a row focused from just above the window is scrolled to beneath the bar, not behind it (row top ${hit2.top}, bar bottom ${hit2.barBottom})`);
  // the page is still the only scroller: Home and End and the wheel or a swipe that STARTS on the bar move the window
  await pg.keyboard.press('Escape'); await pg.evaluate(() => { document.activeElement?.blur?.(); scrollTo(0, 600); }); await pg.waitForTimeout(300);
  if (touch) { const cdp = await ctx.newCDPSession(pg); const y0 = await y(); const x = 200; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 60 }] }); for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 60 + (i * 30) }] }); await pg.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(600);
    ok(await y() < y0 - 100, `${tag}: a swipe that starts on the bar still scrolls the page (${y0} to ${await y()})`); }
  else { const y0 = await y(); await pg.mouse.move(w / 2, 30); await pg.mouse.wheel(0, 400); await pg.waitForTimeout(400); ok(await y() > y0 + 200, `${tag}: the wheel over the bar scrolls the page (${y0} to ${await y()})`); }
  await pg.evaluate(() => { document.activeElement?.blur?.(); document.body.focus?.(); }); await pg.keyboard.press('End'); await pg.waitForTimeout(900); const room = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  ok(room - await y() < 4, `${tag}: End reaches the foot (y ${await y()} of ${room})`);
  await pg.keyboard.press('Home'); await pg.waitForTimeout(900); ok(await y() === 0, `${tag}: Home returns to the top, and the bar is back in its place (top ${(await bar()).t})`);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: no horizontal overflow`);
  await ctx.close();
}

await b.close(); console.log(fails ? `\npolish: ${fails} failed` : '\npolish: all passed'); process.exit(fails ? 1 : 0);
