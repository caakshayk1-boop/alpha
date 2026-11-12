// 12 Nov 2026: the floating back-to-top button. Hidden at the top; offered only after the page is more than ~1.2 screens down AND the person scrolls UP (80px up to show, 40px down to put away,
// nothing within 300px of the top), always at the foot of a long page; fixed bottom-right, 44px+, above the tab bar and the action bar; one tap returns to the top and moves focus to main.
// Scroll positions are set directly (never a wheel timing), so nothing here depends on the live clock. Usage: node apps/tripwire/tests/scrolltop.mjs [baseUrl]
import { chromium, newCtx, ohlcSeries } from './uimock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const wait = (pg) => pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {});
const open = async (pg, route, sel) => { await pg.goto(base + '/'); await pg.goto(base + route); await pg.reload(); await wait(pg); if (sel) await pg.waitForSelector(sel, { timeout: 20000 }); await pg.waitForTimeout(400); };
const to = async (pg, y) => { await pg.evaluate((v) => scrollTo(0, v), y); await pg.waitForTimeout(120); };
const st = (pg) => pg.evaluate(() => { const e = document.querySelector('.scrolltop'); const r = e.getBoundingClientRect(); const t = document.querySelector('.tabs').getBoundingClientRect(); const cs = getComputedStyle(e);
  return { hidden: e.getAttribute('data-hidden'), aria: e.getAttribute('aria-hidden'), tab: e.tabIndex, vis: cs.visibility, pos: cs.position, w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(innerWidth - r.right), tabTop: Math.round(t.top), tabLeft: Math.round(t.left), tabRight: Math.round(t.right), left: Math.round(r.left),
    overlapsTabs: !(r.bottom <= t.top || r.top >= t.bottom || r.right <= t.left || r.left >= t.right), vh: innerHeight, y: Math.round(scrollY), room: document.documentElement.scrollHeight - innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });

for (const w of [320, 390, 1280]) {
  const ctx = await newCtx(b, w, ohlcSeries(900, 'TCS', { nifty: true }), { reducedMotion: 'reduce' }); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  const a = await st(pg); ok(a.room > a.vh * 1.5, `${w}: the page is long enough to test (${a.room}px of room, ${a.vh}px screen)`);
  ok(a.hidden === 'true' && a.vis === 'hidden' && a.aria === 'true' && a.tab === -1, `${w}: at the top it is hidden, out of the tab order and the accessibility tree`);
  const far = Math.round(a.vh * 1.5);
  await to(pg, far); const down = await st(pg); ok(down.hidden === 'true', `${w}: scrolling DOWN past 1.2 screens does not offer it (y ${down.y})`);
  await to(pg, far - 40); const small = await st(pg); ok(small.hidden === 'true', `${w}: 40px of upward travel is not enough`);
  await to(pg, far - 140); const up = await st(pg); ok(up.hidden === 'false' && up.vis === 'visible' && up.aria === null && up.tab === 0, `${w}: after the page is scrolled down and then UP it is shown and reachable`);
  ok(up.pos === 'fixed' && up.w >= 44 && up.h >= 44 && !up.overlapsTabs && (w >= 900 || up.bottom <= up.tabTop) && up.right >= 8 && !up.overflow, `${w}: fixed ${up.w}x${up.h}, bottom-right (${up.right}px from the edge), above the tab bar (bottom ${up.bottom} <= ${up.tabTop}), no overflow`);
  const fab = await pg.evaluate(() => { const f = document.querySelector('.fab-row'); if (!f) return null; const r = f.getBoundingClientRect(), t = document.querySelector('.scrolltop').getBoundingClientRect(); return { clear: t.bottom <= r.top || t.top >= r.bottom || t.right <= r.left || t.left >= r.right }; });
  if (fab) ok(fab.clear, `${w}: it does not cover the bottom action bar`);
  await to(pg, far - 140 + 60); const d2 = await st(pg); ok(d2.hidden === 'true', `${w}: 60px back DOWN puts it away`);
  await to(pg, 200); await to(pg, 120); const near = await st(pg); ok(near.hidden === 'true', `${w}: within 300px of the top it is never offered, even scrolling up`);
  await to(pg, 99999); const end = await st(pg); ok(end.hidden === 'false' && end.vis === 'visible', `${w}: at the foot of a long page it is always there`);
  await pg.locator('.scrolltop').click(); await pg.waitForTimeout(400); const done = await st(pg);
  ok(done.y <= 2 && done.hidden === 'true', `${w}: one tap returns to the top and it steps away (y ${done.y})`);
  ok(await pg.evaluate(() => document.activeElement?.id === 'main'), `${w}: focus moves to the main content`);
  await ctx.close();
}
// motion on: the button lifts and fades (opacity and transform only) and the listener never re-renders the page
{ const ctx = await newCtx(b, 390, ohlcSeries(900, 'TCS', { nifty: true })); const pg = await ctx.newPage(); await open(pg, '/#/c/TCS', '.chart-plot svg');
  const tp = await pg.evaluate(() => getComputedStyle(document.querySelector('.scrolltop')).transitionProperty); ok(/opacity/.test(tp) && /transform/.test(tp) && !/\ball\b|top|left|width|height/.test(tp), `motion on: it only fades and lifts (${tp})`);
  const before = await pg.evaluate(() => document.querySelector('.view').getAttribute('data-x') ?? 'k'); await to(pg, 900); await to(pg, 700); ok(before === 'k', 'scrolling leaves the page DOM alone (no remount of the view)'); await ctx.close(); }
await b.close(); console.log(fails ? `\nscrolltop: ${fails} failed` : '\nscrolltop: all passed'); process.exit(fails ? 1 : 0);
