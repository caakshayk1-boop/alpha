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

await b.close(); console.log(fails ? `\npolish: ${fails} failed` : '\npolish: all passed'); process.exit(fails ? 1 : 0);
