// The app shell and the installable experience, on the served build: four destinations, the More list, every legacy deep link highlighting the right tab, Back and Forward,
// each tab remembering where it was left (Discover's filters and scroll, My Desk's segment, a long page's scroll), safe-area spacing, no sideways overflow at four widths,
// install guidance (hidden when installed, iOS hint, the Android prompt), the manifest and its icons, the service worker, the offline shell, and the update prompt.
// AUTOMATED checks in Chromium. Real iOS Safari and a real installed PWA are NOT tested here: see docs/tripwire/launch/INSTALL_AUDIT.md.
// Usage: node apps/tripwire/tests/shell.mjs [baseUrl]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
async function mk(w = 390, h = 844, o = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: o.sw ? 'allow' : 'block', ...(o.ua ? { userAgent: o.ua } : {}) });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, STATE);
  if (o.standalone) await ctx.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm(q); });
  await mockApi(ctx);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  return { ctx, pg, errs };
}
const go = async (pg, hash) => { await pg.goto(base + '/'); await pg.goto(base + '/' + hash); await pg.reload(); await pg.waitForSelector('nav.tabs'); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(500); };
const tabs = (pg) => pg.locator('nav.tabs a').evaluateAll((a) => a.map((x) => ({ t: x.textContent.trim(), cur: x.getAttribute('aria-current'), href: x.getAttribute('href') })));
const current = async (pg) => (await tabs(pg)).filter((x) => x.cur === 'page').map((x) => x.t).join(',');
const tab = (pg, name) => pg.locator(`nav.tabs a:has-text("${name}")`).click();
const settle = (pg) => pg.waitForTimeout(700);
const ready = async (pg) => { await pg.waitForFunction(() => !document.querySelector('.routewait') && /of [\d,]+ compan/.test(document.querySelector('[data-testid=count]')?.textContent ?? ''), null, { timeout: 20000 }); await pg.waitForTimeout(400); };

/* ---- 1. four destinations, on a phone and on a desktop (11 Nov 2026: Today, Research, Book, Menu; My Desk moved into Menu) ---- */
for (const [w, h, label] of [[390, 844, 'phone'], [1280, 800, 'desktop']]) {
  const { ctx, pg } = await mk(w, h); await go(pg, '#/today');
  const t = await tabs(pg);
  ok(t.map((x) => x.t).join('|') === 'Today|Research|Book|Menu', `${label}: four destinations, Today | Research | Book | Menu`);
  ok(await pg.locator('nav.tabs').getAttribute('aria-label') === 'Primary' && t.filter((x) => x.cur === 'page').length === 1, `${label}: one named navigation landmark and exactly one aria-current`);
  const r = await pg.locator('nav.tabs a').evaluateAll((a) => a.map((x) => { const q = x.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; }));
  ok(r.every(([ww, hh]) => ww >= 44 && hh >= 44), `${label}: every destination is at least 44 by 44 px (${r.map((x) => x.join('x')).join(' ')})`);
  const nav = await pg.locator('nav.tabs').boundingBox();
  ok(label === 'phone' ? nav.y + nav.height > h - 30 && nav.y > h / 2 : nav.x === 0 && nav.width >= 160 && nav.width <= 220, `${label}: ${label === 'phone' ? 'a bottom bar' : 'a labelled navigation rail at the left'} (${Math.round(nav.x)},${Math.round(nav.y)} ${Math.round(nav.width)}x${Math.round(nav.height)})`);
  await ctx.close();
}

/* ---- 2. More lists every destination, and each row opens its page ---- */
{ const { ctx, pg } = await mk(); await go(pg, '#/more');
  const rows = await pg.locator('[data-more-row]').evaluateAll((r) => r.map((x) => [x.getAttribute('data-more-row'), x.getAttribute('href'), x.getBoundingClientRect().height]));
  const want = { markets: '#/markets', news: '#/news', data: '#/data', methodology: '#/methodology', help: '#/help', settings: '#/settings' };   // Operations is builder plumbing: its page stays at #/ops, the visitor menu no longer lists it
  // 11 Nov 2026 (revamp v2): Signals left the Menu (it is the Book tab), so 9 rows in five groups: Yours, Research, About the data, Settings, Legal.
  ok(Object.entries(want).every(([k, v]) => rows.some((r) => r[0] === k && r[1] === v)) && rows.length === 10 && rows.some((r) => r[0] === "info" && r[1] === "#/info") && rows.some((r) => r[0] === 'desk') && !rows.some((r) => r[0] === 'ops') && !rows.some((r) => r[0] === 'signals') && rows.some((r) => r[0] === "privacy") && rows.some((r) => r[0] === "terms"), `Menu lists My Desk, Markets, News, About and data, Data and coverage, Methodology, Help, Settings, Privacy, Terms (10; Signals is the Book tab) (${rows.map((r) => r[0]).join(', ')})`);
  ok(JSON.stringify(await pg.locator('.mn-h').allInnerTexts()).toLowerCase() === JSON.stringify(['Yours', 'Research', 'About the data', 'Settings', 'Legal']).toLowerCase(), 'the rows are grouped: Yours, Research, About the data, Settings, Legal');
  ok(await pg.locator('[data-more-row] .mn-ic svg').count() === rows.length && (await pg.locator('[data-more-row] .mn-n').allInnerTexts()).every((t) => t.trim().length > 0), 'every row has an icon, a title and a one-line note');
  { const st = (await pg.locator('[data-menu-state]').innerText()).replace(/\s+/g, ' '); ok(/Data through \w{3} \d{1,2} \w{3}/.test(st) && /Prices (live|delayed|last traded|not traded yet|unavailable|checking)/.test(st), `the app's state is one line at the top: ${st}`); }
  ok(rows.every((r) => r[2] >= 56), 'every Menu row is a big target (56 px or more)');
  ok(/Experimental/.test(await pg.locator('[data-about]').innerText()) && /paper trade/i.test(await pg.locator('[data-about]').innerText()), 'More states the experimental, paper-only status');
  ok(await pg.locator('h1').first().innerText() === 'Menu' && (await current(pg)) === 'Menu', 'Menu is its own tab, titled Menu');
  for (const [k, hash] of Object.entries(want)) {
    await go(pg, '#/more'); await pg.locator(`[data-more-row=${k}]`).click(); await pg.waitForFunction((h) => location.hash === h, hash); await settle(pg);
    ok((await current(pg)) === (k === 'markets' || k === 'news' ? 'Today' : k === 'signals' ? 'Book' : 'Menu') && (await pg.locator('main h1, main h2').count()) > 0, `More > ${k} opens ${hash} under ${k === 'markets' || k === 'news' ? 'Today' : k === 'signals' ? 'Book' : 'Menu'}`);
  }
  await ctx.close(); }

/* ---- 3. every legacy deep link opens, and highlights its tab ---- */
{ const { ctx, pg, errs } = await mk();
  const R = [['#/today', 'Today'], ['#/news', 'Today'], ['#/markets', 'Today'], ['#/m/GOLD', 'Today'], ['#/live', 'Today'], ['#/discover', 'Research'], ['#/discover?q=tata', 'Research'], ['#/c/TCS', 'Research'], ['#/compare?s=TCS', 'Research'], ['#/lab', 'Research'],
    ['#/desk', 'Menu'], ['#/desk?v=journal', 'Menu'], ['#/desk?v=plans', 'Menu'], ['#/report/TCS', 'Menu'],
    ['#/signals', 'Book'], ['#/signals?v=tracker', 'Book'], ['#/signals?v=auto', 'Book'], ['#/signals?v=record', 'Book'], ['#/signals?v=evidence', 'Book'], ['#/profile', 'Menu'], ['#/data', 'Menu'], ['#/methodology', 'Menu'], ['#/help', 'Menu'], ['#/ops', 'Menu'], ['#/more', 'Menu']];
  const bad = [];
  for (const [h, want] of R) { await go(pg, h); const got = await current(pg); if (got !== want) bad.push(`${h}: ${got} not ${want}`); if (await pg.locator('.boundary, .welcome').count()) bad.push(`${h}: error or welcome screen`); }
  ok(bad.length === 0, `${R.length} deep links each open under the right tab${bad.length ? ': ' + bad.join('; ') : ''}`);
  await go(pg, '#/signals?v=record'); ok((await pg.title()).startsWith('Book'), `the tab title names the page, not its sub-view (${await pg.title()})`);   // 11 Nov 2026: the page is called Book, like its tab; the sub-view (Record) is not in the title
  await go(pg, '#/profile'); ok((await pg.title()).startsWith('Settings'), `Profile reads as Settings in the title (${await pg.title()})`);
  ok(errs.length === 0, `no page errors across the links${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close(); }

/* ---- 3b. Signals is a tab of its own and remembers the view it was left on (it used to ride on More's memory) ---- */
{ const { ctx, pg } = await mk(); await go(pg, '#/signals?v=record');
  await tab(pg, 'Today'); await pg.waitForFunction(() => /#\/today/.test(location.hash)); await tab(pg, 'Book'); await pg.waitForFunction(() => /#\/signals/.test(location.hash)); await settle(pg);
  ok(/v=record/.test(await pg.evaluate(() => location.hash)) && (await current(pg)) === 'Book', 'leaving Signals on its Record view and coming back returns to Record, not to Picks');
  await go(pg, '#/signals?v=auto'); await tab(pg, 'Research'); await pg.waitForFunction(() => /#\/discover/.test(location.hash)); await tab(pg, 'Book'); await settle(pg);
  ok(/v=auto/.test(await pg.evaluate(() => location.hash)), 'the same for the Auto view');
  await ctx.close(); }

/* ---- 4. Back and Forward ---- */
{ const { ctx, pg } = await mk(); await go(pg, '#/today');
  // 11 Nov 2026: Signals is no longer a Menu row; the same history (Today, Menu, Signals, Record) is built with an in-page link to #/signals from the Menu.
  await tab(pg, 'Menu'); await pg.waitForSelector('[data-more]'); await pg.evaluate(() => { location.hash = '#/signals'; }); await pg.waitForSelector('section[aria-label]'); await pg.getByRole('tab', { name: 'Record' }).click(); await pg.waitForFunction(() => /v=record/.test(location.hash)); await settle(pg);
  await pg.goBack(); await pg.waitForFunction(() => location.hash === '#/signals'); ok((await current(pg)) === 'Book', 'Back from Record: Signals, under its own tab');
  await pg.goBack(); await pg.waitForSelector('[data-more]'); ok(await pg.evaluate(() => location.hash) === '#/more' && (await current(pg)) === 'Menu', 'Back again: the More list');
  await pg.goBack(); await pg.waitForFunction(() => location.hash === '#/today'); ok((await current(pg)) === 'Today', 'Back again: Today');
  await pg.goForward(); await pg.waitForSelector('[data-more]'); await pg.goForward(); await pg.waitForFunction(() => location.hash === '#/signals'); await pg.goForward(); await pg.waitForFunction(() => /v=record/.test(location.hash));
  ok((await current(pg)) === 'Book' && /v=record/.test(await pg.evaluate(() => location.hash)), 'Forward three times: back at Signals > Record');
  await ctx.close(); }

/* ---- 5. a tab remembers where it was left: Discover's filters and scroll, My Desk's segment, the scroll of a long page ---- */
{ const { ctx, pg } = await mk(); await go(pg, '#/discover'); await ready(pg);
  if (!(await pg.locator('details.adv').evaluate((d) => d.open))) await pg.locator('.adv summary').click();
  await pg.getByRole('button', { name: 'Uptrend', exact: true }).click(); await pg.waitForTimeout(400);
  const cnt = async () => ((await pg.locator('[data-testid=count]').innerText()).match(/^[\d,]+ of [\d,]+/) ?? [''])[0]; const n0 = await cnt();
  await pg.getByRole('button', { name: /^Show \d+ more$/ }).click(); await pg.waitForTimeout(300); await pg.evaluate(() => window.scrollTo(0, 900)); await pg.waitForTimeout(700); const h0 = await pg.evaluate(() => location.hash); const y0 = await pg.evaluate(() => Math.round(scrollY));
  ok(/trend=up/.test(h0) && y0 > 500, `set up: Uptrend in the address (${n0}), scrolled to ${y0}`);
  /* 11 Nov 2026: My Desk lives inside the Menu tab, so the Menu tab remembers ONE place: the last one left (My Desk's Journal, then Methodology) */
  await tab(pg, 'Menu'); await pg.waitForSelector('[data-more]'); await pg.locator('[data-more-row=desk]').click(); await pg.waitForSelector('[data-desk], .dsk'); await pg.getByRole('tab', { name: 'Journal' }).click(); await pg.waitForFunction(() => /v=journal/.test(location.hash)); await settle(pg);
  await tab(pg, 'Research'); await ready(pg); await pg.waitForTimeout(700);
  const h1 = await pg.evaluate(() => location.hash); const y1 = await pg.evaluate(() => Math.round(scrollY));
  ok(h1 === h0 && (await cnt()) === n0, `Discover: the same address and the same ${n0} after visiting another tab (${h1 === h0 ? 'address kept' : h0 + ' became ' + h1})`);
  ok(Math.abs(y1 - y0) < 60, `Discover: scroll put back (${y0} then ${y1})`);
  await tab(pg, 'Menu'); await pg.getByRole('tab', { name: 'Journal' }).waitFor(); await settle(pg);
  ok(/v=journal/.test(await pg.evaluate(() => location.hash)) && (await pg.getByRole('tab', { name: 'Journal' }).getAttribute('aria-selected')) === 'true' && (await current(pg)) === 'Menu', 'Menu: back in My Desk on the Journal segment');
  await tab(pg, 'Menu'); await pg.waitForTimeout(300); await tab(pg, 'Menu'); await pg.waitForSelector('[data-more]');
  ok(await pg.evaluate(() => location.hash) === '#/more', 'a second tap on the tab you are in, already at the top, returns to its first screen (the Menu)');
  await pg.locator('[data-more-row=methodology]').click(); await pg.waitForFunction(() => location.hash === '#/methodology'); await settle(pg);
  const docH = await pg.evaluate(() => document.documentElement.scrollHeight); await pg.evaluate(() => window.scrollTo(0, 700)); await pg.waitForTimeout(400); const ym = await pg.evaluate(() => Math.round(scrollY));
  ok(docH > 1600 && ym > 400, `set up: Methodology scrolled to ${ym} of ${docH}`);
  await tab(pg, 'Research'); await ready(pg); await pg.waitForTimeout(500);
  await tab(pg, 'Menu'); await pg.waitForFunction(() => location.hash === '#/methodology'); await settle(pg); await pg.waitForTimeout(300);
  const y2 = await pg.evaluate(() => Math.round(scrollY));
  ok((await current(pg)) === 'Menu' && Math.abs(y2 - ym) < 40, `Menu: back inside Methodology at the same place (${ym} then ${y2})`);
  await tab(pg, 'Menu'); await pg.waitForTimeout(300); ok((await pg.evaluate(() => scrollY)) < 4 && (await pg.evaluate(() => location.hash)) === '#/methodology', 'a tap on the tab you are in scrolls to the top and stays on the page');
  await tab(pg, 'Today'); await pg.waitForSelector('[data-brief]'); await pg.locator('a[href="#/markets"]').first().click(); await pg.waitForSelector('[data-sectorheat] .sh-cell'); await tab(pg, 'Today'); await pg.waitForSelector('[data-brief]');
  ok(await pg.evaluate(() => location.hash) === '#/today', 'the Today tab opens Today, not the Markets page that was opened from it');
  await ctx.close(); }

/* ---- 6. safe areas, clearance above the bar, no sideways overflow ---- */
{ const { ctx, pg } = await mk(); await go(pg, '#/more');
  const css = await pg.evaluate(() => { const out = {}; for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch { continue; } const walk = (rs) => { for (const r of rs) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText) { if (/(^|,)\s*\.tabs\s*$|^\.tabs$/.test(r.selectorText) && /bottom/.test(r.cssText)) out.tabs = (out.tabs ?? '') + r.cssText; if (/^\.main$/.test(r.selectorText) && /padding/.test(r.cssText)) out.main = (out.main ?? '') + r.cssText; } } }; walk(rules); } return out; });
  ok(/safe-area-inset-bottom/.test(css.tabs ?? '') && /safe-area-inset-left/.test(css.tabs ?? ''), 'the tab bar sits above the home indicator and inside the side insets (env(safe-area-inset-*))');
  ok(/safe-area-inset-bottom/.test(css.main ?? ''), 'the page reserves the bar and the bottom inset (env(safe-area-inset-bottom))');
  ok(await pg.evaluate(() => /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content)), 'viewport-fit=cover, so the insets are real');
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(300);
  const gap = await pg.evaluate(() => { const last = [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.getBoundingClientRect().bottom).reduce((a, c) => Math.max(a, c), 0); return document.querySelector('nav.tabs').getBoundingClientRect().top - last; });
  ok(gap >= 8, `the last line of More clears the bar by ${Math.round(gap)} px`);
  await ctx.close();
  for (const w of [360, 390, 768, 1440]) {
    const c = await mk(w, 900); const bad = [];
    for (const h of ['#/more', '#/today', '#/desk', '#/signals', '#/profile']) { await go(c.pg, h); const o = await c.pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 1) bad.push(`${h} ${o}px`); }
    ok(bad.length === 0, `no sideways overflow at ${w} px on More, Today, Desk, Signals, Settings${bad.length ? ': ' + bad.join(', ') : ''}`); await c.ctx.close();
  } }

/* ---- 7. install guidance ---- */
{ const a = await mk(); await go(a.pg, '#/more'); ok((await a.pg.locator('[data-install]').count()) === 0, 'a desktop browser with no install prompt shows no install card (nothing it cannot do)');
  await a.pg.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => { window.__prompted = (window.__prompted ?? 0) + 1; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
  await a.pg.waitForSelector('[data-install=prompt]'); await a.pg.getByRole('button', { name: 'Install', exact: true }).click(); await a.pg.waitForTimeout(300);
  ok((await a.pg.evaluate(() => window.__prompted)) === 1 && (await a.pg.locator('[data-install]').count()) === 0, 'where the browser offers an install prompt, More shows Install and uses it once');
  await a.ctx.close();
  const i = await mk(390, 844, { ua: IOS_UA }); await go(i.pg, '#/more'); await i.pg.waitForSelector('[data-install=ios]');
  const t = await i.pg.locator('[data-install=ios]').innerText(); ok(/Share/.test(t) && /Add to Home Screen/.test(t), `on iOS More says: ${t.replace(/\s+/g, ' ')}`); await i.ctx.close();
  const s = await mk(390, 844, { ua: IOS_UA, standalone: true }); await go(s.pg, '#/more'); ok((await s.pg.locator('[data-install]').count()) === 0 && await s.pg.evaluate(() => matchMedia('(display-mode: standalone)').matches), 'installed (display-mode: standalone): no install guidance at all'); await s.ctx.close();
  const s2 = await mk(390, 844, { standalone: true }); await go(s2.pg, '#/more'); await s2.pg.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); }); await s2.pg.waitForTimeout(300);
  ok((await s2.pg.locator('[data-install]').count()) === 0, 'installed: even a late install event shows nothing'); await s2.ctx.close(); }

/* ---- 8. the manifest, the icons, the head tags ---- */
{ const res = await fetch(base + '/manifest.webmanifest'); const m = await res.json(); const hex = /^#[0-9a-f]{6}$/i;
  ok(m.name === 'Tripwire' && m.short_name === 'Tripwire' && m.short_name.length <= 12, 'manifest: name and short_name');
  ok(m.id === '/' && m.start_url === '/' && m.scope === '/' && m.display === 'standalone', `manifest: id, start_url and scope are "/", display standalone`);
  ok(hex.test(m.theme_color) && hex.test(m.background_color) && !m.orientation, 'manifest: theme and background colours, and no forced orientation (tablets and desktop windows rotate and resize)');
  const icons = m.icons ?? []; const png = (sz, purpose) => icons.find((x) => x.type === 'image/png' && x.sizes === sz && (x.purpose ?? 'any') === purpose);
  ok(png('192x192', 'any') && png('512x512', 'any') && png('512x512', 'maskable'), 'manifest: 192 and 512 PNG icons, plus a maskable 512');
  const dims = []; for (const ic of icons) { const r = await fetch(base + ic.src); const buf = Buffer.from(await r.arrayBuffer()); const ct = r.headers.get('content-type') ?? ''; if (ic.type === 'image/png') { const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); if (!r.ok || !/png/.test(ct) || `${w}x${h}` !== ic.sizes) dims.push(`${ic.src} ${w}x${h} ${ct}`); } else if (!r.ok) dims.push(ic.src); }
  ok(dims.length === 0, `manifest: every icon loads and is the size it declares${dims.length ? ': ' + dims.join('; ') : ''}`);
  ok((m.shortcuts ?? []).length >= 3 && (m.shortcuts ?? []).every((x) => x.url.startsWith('/')), 'manifest: shortcuts stay inside the scope');
  const html = await (await fetch(base + '/')).text();
  ok(/rel="manifest" href="\/manifest.webmanifest"/.test(html) && /rel="apple-touch-icon"/.test(html) && /apple-mobile-web-app-capable" content="yes"/.test(html) && /apple-mobile-web-app-title" content="Tripwire"/.test(html) && /apple-mobile-web-app-status-bar-style/.test(html) && /name="theme-color"/.test(html), 'head: manifest, apple-touch-icon, iOS standalone tags, theme-color');
  const ai = await fetch(base + (html.match(/rel="apple-touch-icon" href="([^"]+)"/)?.[1] ?? '/none')); const ab = Buffer.from(await ai.arrayBuffer());
  ok(ai.ok && ab.readUInt32BE(16) === 180 && ab.readUInt32BE(20) === 180, 'head: the apple-touch-icon is a 180 x 180 PNG'); const ai2 = await fetch(base + '/apple-touch-icon.png'); ok(ai2.ok, '/apple-touch-icon.png (the path iOS probes by default) answers'); }

/* ---- 9. the service worker, the offline shell, and what it must not keep ---- */
{ const { ctx, pg } = await mk(390, 844, { sw: true });
  await pg.goto(base + '/#/more'); await pg.waitForSelector('[data-more]');
  await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForSelector('[data-more]');
  const ctl = await pg.evaluate(async () => { for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100)); return !!navigator.serviceWorker.controller; });
  ok(ctl, 'the service worker registers, activates and controls the page');
  const st = await pg.evaluate(async () => { const names = await caches.keys(); const out = {}; for (const n of names) out[n] = (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname); return out; });
  const shellName = Object.keys(st).find((k) => k.startsWith('tw-') && k !== 'tw-data'); const shell = st[shellName] ?? [];
  ok(shell.includes('/') && shell.some((p) => /^\/app\..*\.js$/.test(p)) && shell.some((p) => /^\/app\..*\.css$/.test(p)) && shell.some((p) => /woff2$/.test(p)) && shell.includes('/manifest.webmanifest'), `the shell is precached: page, scripts, styles, fonts, manifest (${shell.length} files)`);
  ok(shell.some((p) => /More-/.test(p)) && shell.some((p) => /company|chunk/.test(p)), 'the lazy screens are in it too, so a tab never waits on a network that is not there');
  ok(!Object.values(st).flat().some((p) => p.startsWith('/api/')), 'no /api response (quotes, news, bars, health) is in any cache');
  await pg.evaluate(() => fetch('/api/news/version').catch(() => null)); await pg.waitForTimeout(300);
  ok(!(await pg.evaluate(async () => { for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) if (new URL(r.url).pathname.startsWith('/api/')) return true; return false; })), 'and still none after calling the API');
  await ctx.setOffline(true); await pg.reload(); await pg.waitForSelector('nav.tabs', { timeout: 15000 }); await pg.waitForSelector('[data-more]');
  ok(true, 'offline: the app shell opens from the saved copy');
  ok(/Offline: showing the last saved copy/.test(await pg.locator('.banner').first().innerText()), `offline: the page says so (${(await pg.locator('.banner').first().innerText()).slice(0, 90)})`);
  const apiOffline = await pg.evaluate(() => fetch('/api/quote?s=TCS').then((r) => 'status ' + r.status, () => 'failed'));
  ok(apiOffline === 'failed', `offline: a price request fails; it is never answered from a saved copy (${apiOffline})`);
  await pg.goto(base + '/#/discover'); await pg.waitForFunction(() => /of [\d,]+ compan/.test(document.querySelector('[data-testid=count]')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => {});
  ok(await pg.locator('[data-testid=count]').count() === 1 && /Offline/.test(await pg.locator('.banner').first().innerText()), 'offline: Discover lists the last saved screen, under the offline notice');
  await ctx.setOffline(false); await ctx.close(); }

/* ---- 10. a new version waits, says so, and never reloads under someone typing ---- */
{ const swPath = 'apps/tripwire/dist/sw.js'; const orig = existsSync(swPath) ? readFileSync(swPath, 'utf8') : null;
  if (!orig) ok(false, `the update flow needs ${swPath} (run the build first)`);
  else {
    const { ctx, pg } = await mk(390, 844, { sw: true });
    try {
      await pg.goto(base + '/#/more'); await pg.waitForSelector('[data-more]'); await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForSelector('[data-more]');
      await pg.evaluate(async () => { for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100)); window.__marker = 1; });
      ok((await pg.locator('.banner.upd').count()) === 0, 'no update prompt while the page runs the newest version');
      writeFileSync(swPath, orig + `\n// release ${Date.now()}\n`);
      await new Promise((r) => setTimeout(r, 800));
      await pg.evaluate(() => window.__twSw.update()); await pg.waitForSelector('.banner.upd', { timeout: 20000 });
      ok(/Update ready/.test(await pg.locator('.banner.upd').innerText()), 'a waiting version shows “Update ready” with a Reload button, and has not taken over');
      ok(await pg.evaluate(() => !!window.__twSw.waiting && window.__marker === 1), 'the new worker is waiting; the page was not reloaded');
      await pg.goto(base + '/#/desk?v=journal'); await pg.getByRole('tab', { name: 'Journal' }).waitFor(); await pg.evaluate(() => { window.__marker = 1; }); await pg.waitForSelector('.banner.upd');
      const fld = pg.locator('input.field, textarea.field').first(); await fld.click(); await pg.keyboard.type('draft');
      await pg.locator('.banner.upd .btn').click(); await pg.waitForTimeout(800);
      ok(await pg.evaluate(() => window.__marker === 1) && /Finish what you are editing/.test(await pg.locator('.banner.upd').innerText()), 'a few seconds after typing in a field, Reload refuses: “Finish what you are editing first”, and nothing reloads');
      await pg.waitForTimeout(10500); await Promise.all([pg.waitForEvent('load', { timeout: 20000 }), pg.locator('.banner.upd .btn').click()]);
      await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(500);
      ok((await pg.evaluate(() => window.__marker)) === undefined && (await pg.locator('.banner.upd').count()) === 0, 'after the person taps Reload, the new version runs and the prompt is gone');
    } finally { writeFileSync(swPath, orig); await ctx.close(); }
  } }

/* ---- the stale-data banner holds its slot: it arrives with the screen feed and moves nothing, and it is never hidden ---- */
for (const hint of [null, 'stale']) for (const font of [null, 'monospace']) {
  const { ctx, pg } = await mk(390, 844);
  // Widen only the market read to exercise the six lines seen with Linux system fonts.
  if (font) await pg.addInitScript((f) => document.addEventListener('DOMContentLoaded', () => { const style = document.createElement('style'); style.textContent = `.brief .t-take { font-family: ${f}; }`; document.head.append(style); }), font);
  await ctx.route('**/data/screen.json', async (r) => { await new Promise((x) => setTimeout(x, 1500)); const res = await r.fetch(); const j = JSON.parse(await res.text()); j.as_of = '2026-10-26'; /* 2 Nov 2026: pin the day to an old one so the banner test is about the banner, not about how fresh the screen the server happens to hold is (CI serves the real build, which was current on a Monday morning) */ await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
  await pg.addInitScript(() => { window.__cls = 0; window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ value: e.value, sources: e.sources.map((s) => s.node?.className ?? s.node?.nodeName ?? 'removed') }); } }).observe({ type: 'layout-shift', buffered: true }); });
  if (hint) await pg.addInitScript(() => { try { localStorage.setItem('tripwire:banner-hint', '2026-10-26'); } catch { /* none */ } });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-brief]', { timeout: 20000 });
  const y1 = await pg.evaluate(() => document.querySelector('.view').offsetTop); const ghost = await pg.locator('[data-banner-slot]').count();
  const indicesBefore = await pg.locator('.brief-ix').evaluate((e) => e.offsetTop);
  await pg.waitForSelector('.banner[role=status]', { timeout: 15000 }); await pg.waitForTimeout(400);
  const y2 = await pg.evaluate(() => document.querySelector('.view').offsetTop);
  const indicesAfter = await pg.locator('.brief-ix').evaluate((e) => e.offsetTop);
  ok(Math.abs(indicesBefore - indicesAfter) < 1, `market read (${font ?? 'system font'}): arriving breadth keeps the index cards in place (${indicesBefore} to ${indicesAfter})`);
  ok(ghost === 1 && Math.abs(y1 - y2) < 1, `banner slot (${hint ? 'remembered stale' : 'nothing remembered'}): reserved while the answer is pending, the view did not move (${y1} to ${y2})`);
  ok(/The data stops \d+ sessions before the last finished one/.test(await pg.locator('.banner[role=status]').innerText()) && (await pg.locator('[data-banner-slot]').count()) === 0, 'banner slot: the real banner is shown to the person, and the placeholder is gone');
  const shifts = await pg.evaluate(() => ({ cls: window.__cls, sources: window.__shifts }));
  ok(shifts.cls < 0.01, `delayed screen (${font ?? 'system font'}): page CLS stays below 0.01 (${shifts.cls.toFixed(4)})${shifts.cls >= 0.01 ? ' ' + JSON.stringify(shifts.sources) : ''}`); await ctx.close();
}
{ const { ctx, pg } = await mk(390, 844);   // current data: nothing is reserved once the device has seen a current answer, and no banner appears
  const day = (() => { const d = new Date(Date.now() + 330 * 60000); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  await ctx.route('**/data/screen.json', async (r) => { const res = await r.fetch(); const j = JSON.parse(await res.text()); j.as_of = day; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
  await pg.addInitScript((d) => { try { localStorage.setItem('tripwire:banner-hint', d); } catch { /* none */ } }, day);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-brief]', { timeout: 20000 }); await pg.waitForTimeout(1200);
  ok((await pg.locator('[data-banner-slot]').count()) === 0 && (await pg.locator('.banner[role=status]').count()) === 0, 'banner slot: with current data and a current answer remembered, no banner and no empty slot'); await ctx.close(); }

await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nall shell checks passed'); process.exit(fails ? 1 : 0);
