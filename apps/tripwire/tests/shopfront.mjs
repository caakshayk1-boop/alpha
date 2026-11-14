// The shopfront in a real browser: the first-visit line on Today (shows, dismisses, remembers, survives denied storage), the walkthrough open for a first visit only, the stale-data banner directly
// under the brief on Today (and still at the top elsewhere), and the footer trust line with the real contact. Nothing reads the clock: staleness is pinned by serving an old data day.
// AUTOMATED checks, not user research. Usage: node apps/tripwire/tests/shopfront.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) bad++; };
const b = await chromium.launch();
const GUEST = { ...STATE, follows: [], entries: [], paper: [], snaps: {} };
const KEY = 'tripwire:hero-dismissed';
const mk = async ({ state, width = 390, stale = false, denyHero = false, preDismissed = false }) => {
  const ctx = await b.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(({ s, pre }) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); if (pre) localStorage.setItem('tripwire:hero-dismissed', '1'); sessionStorage.setItem('seeded', '1'); } } catch {} }, { s: state, pre: preDismissed });
  if (denyHero) await ctx.addInitScript((k) => { const g = Storage.prototype.getItem, s = Storage.prototype.setItem; Storage.prototype.getItem = function (x) { if (x === k) throw new Error('SecurityError'); return g.call(this, x); }; Storage.prototype.setItem = function (x, v) { if (x === k) throw new Error('SecurityError'); return s.call(this, x, v); }; }, KEY);
  await mockApi(ctx);
  if (stale) await ctx.route('**/data/screen.json', async (r) => { const res = await r.fetch(); const j = JSON.parse(await res.text()); j.as_of = '2026-10-26'; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  return { ctx, pg, errs };
};
const settle = async (pg) => { await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(900); };
const hero = (pg) => pg.locator('[data-hero-line]');

/* ---- 1. a first visit: the line is above the fold, says who and what, and dismisses ---- */
for (const w of [390, 320]) {
  const { ctx, pg, errs } = await mk({ state: GUEST, width: w });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-hero-line]'); await settle(pg);
  const t = await hero(pg).innerText();
  ok(/Rules that fire, evidence you can check — by Akshay, CA\./.test(t) && /Paper-only research, not advice/.test(t), `${w}: first visit shows the owner's line and the paper-only sentence`);
  const box = await hero(pg).boundingBox(); ok(!!box && box.y + box.height < 844, `${w}: the line is above the fold (bottom at ${Math.round((box?.y ?? 0) + (box?.height ?? 0))} of 844)`);
  ok(await pg.locator('[data-sample] details[open]').count() === 1, `${w}: a first-time visitor finds the Sample walkthrough open`);
  const x = pg.locator('[data-hero-dismiss]'); const xb = await x.boundingBox(); ok(!!xb && xb.width >= 44 && xb.height >= 44, `${w}: the dismiss control is a 44px target`);
  ok(await pg.locator('.sheet, [role=dialog]').count() === 0, `${w}: no popup, modal or dialog`);
  await x.click(); await pg.waitForTimeout(200);
  ok(await hero(pg).count() === 0, `${w}: dismissing hides it`);
  ok(await pg.locator('[data-sample] details[open]').count() === 1, `${w}: dismissing does not fold the walkthrough the reader is looking at`);
  ok((await pg.evaluate((k) => localStorage.getItem(k), KEY)) === '1', `${w}: the dismissal is stored locally`);
  await pg.reload(); await pg.waitForSelector('[data-takeaway], [data-sec=brief]'); await settle(pg);
  ok(await hero(pg).count() === 0, `${w}: not shown again after a reload`);
  ok(await pg.locator('[data-sample]').count() === 1 && await pg.locator('[data-sample] details[open]').count() === 0, `${w}: a returning visitor keeps the walkthrough collapsed`);
  ok(errs.length === 0, `${w}: no page errors`); await ctx.close();
}

/* ---- 2. a returning visitor who dismissed it long ago never sees it ---- */
{
  const { ctx, pg } = await mk({ state: STATE, preDismissed: true }); await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-sec=brief]'); await settle(pg);
  ok(await hero(pg).count() === 0, 'a returning visitor (flag set) does not see the line'); await ctx.close();
}

/* ---- 3. storage denied: still renders, shows each visit, a dismissal still hides it for the session ---- */
{
  const { ctx, pg, errs } = await mk({ state: GUEST, denyHero: true });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-hero-line]'); await settle(pg);
  ok(await hero(pg).count() === 1 && await pg.locator('[data-sec=brief]').count() === 1, 'storage denied: the page renders and the line is shown');
  await pg.locator('[data-hero-dismiss]').click(); await pg.waitForTimeout(200); ok(await hero(pg).count() === 0, 'storage denied: dismissing still hides it');
  await pg.evaluate(() => { location.hash = '#/markets'; }); await settle(pg); await pg.evaluate(() => { location.hash = '#/today'; }); await settle(pg);
  ok(await hero(pg).count() === 0, 'storage denied: it stays hidden when Today is opened again in the same session');
  await pg.reload(); await pg.waitForSelector('[data-sec=brief]'); await settle(pg);
  ok(await hero(pg).count() === 1, 'storage denied: a new visit shows it again, since nothing could be remembered');
  ok(errs.length === 0, 'storage denied: no page errors'); await ctx.close();
}

/* ---- 4. the stale-data banner: drawn once by the shell, at the top, same words ---- */
for (const w of [390, 320]) {
  const { ctx, pg } = await mk({ state: STATE, width: w, stale: true, preDismissed: true });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-stale-banner]', { timeout: 15000 }); await settle(pg);
  // 13 Nov 2026 (v6 home): the shell draws the banner ONCE, above the page, on Today too; the page body holds no copy of it
  const r = await pg.evaluate(() => { const all = document.querySelectorAll('[data-stale-banner]'); const bn = all[0]; return { n: all.length, text: bn.innerText, role: bn.getAttribute('role'), inToday: !!bn.closest('.today'), beforeView: !!(bn.compareDocumentPosition(document.querySelector('.view')) & Node.DOCUMENT_POSITION_FOLLOWING), copies: document.querySelectorAll('.today .banner').length }; });
  ok(r.n === 1 && !r.inToday && r.copies === 0, `${w}: the banner is drawn once, outside Today's body (${r.n} copies, ${r.copies} inside Today)`);
  ok(r.beforeView, `${w}: it sits at the top, before the page`);
  ok(/The data stops \d+ sessions before the last finished one\. Treat everything as old\./.test(r.text) && r.role === 'status', `${w}: wording and role unchanged: "${r.text}"`);
  await pg.goto(base + '/#/markets'); await settle(pg);
  const m = await pg.evaluate(() => { const bn = document.querySelector('.banner[role=status]'); return bn ? { top: bn.getBoundingClientRect().top, beforeView: !!(bn.compareDocumentPosition(document.querySelector('.view')) & Node.DOCUMENT_POSITION_FOLLOWING) } : null; });
  ok(!!m && m.beforeView, `${w}: on other pages the banner stays at the top, before the page`);
  await ctx.close();
}

/* ---- 5. the footer: research not advice, no SEBI registration claimed, the real contact, no invented Margin Notes link ---- */
for (const route of ['/#/today', '/#/methodology', '/#/help']) {
  const { ctx, pg } = await mk({ state: STATE, preDismissed: true }); await pg.goto(base + route); await pg.waitForSelector('[data-ident]'); await settle(pg);
  const t = await pg.locator('[data-ident]').innerText();
  ok(/paper-only research, not investment advice/.test(t) && /No SEBI registration is claimed/.test(t), `${route}: footer says research, not advice, and claims no SEBI registration`);
  const href = await pg.locator('[data-ident] a[href^="mailto:"]').getAttribute('href'); ok(href === 'mailto:hello@askakshay.com', `${route}: footer carries the real contact (${href})`);
  ok(!/margin notes/i.test(t) && (await pg.locator('[data-ident] a[href^="http"]').count()) === 0, `${route}: no Margin Notes link and no outside link`);
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} failed` : 'all passed'); process.exit(bad ? 1 : 0);
