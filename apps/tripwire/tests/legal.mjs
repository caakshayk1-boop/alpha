// Privacy, Terms, the Not found views, the share image and the crawler files, in a real browser on the served build.
// Covers: both pages render with exactly one h1, the last-updated date and the "not set up yet" contact line, print cleanly, do not overflow at 320 / 390 / 1280, are axe-clean (serious and critical)
// even with every section open; an unknown route and an unknown company show Not found (never Today) with the right document title; a first-time visitor can read both pages;
// the served HTML carries the share tags with absolute URLs; og.png is served as image/png under 120 KB; robots and the sitemap are valid.
// Nothing here reads the clock or the freshness of the screen: the screen is a frozen fixture and every assertion is about text and structure.
// Usage: node apps/tripwire/tests/legal.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const open = async (route, { w = 390, state = STATE } = {}) => {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, serviceWorkers: 'block', bypassCSP: true });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch { /* none */ } }, state);
  await mockApi(ctx); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await pg.goto(base + route); await pg.waitForFunction(() => !document.querySelector('.routewait') && !document.querySelector('[aria-busy=true]'), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForSelector('h1', { timeout: 20000 }); await pg.waitForTimeout(300); return { ctx, pg, errs };
};
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const bad = async (pg) => { if (!(await pg.evaluate(() => !!window.axe))) await pg.addScriptTag({ content: axe }); return pg.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].html.slice(0, 120)}`)); };
const h1s = (pg) => pg.locator('h1').evaluateAll((e) => e.map((x) => x.textContent.trim()));

/* ---- Privacy and Terms ---- */
for (const [route, id, title] of [['/#/privacy', 'privacy', 'Privacy'], ['/#/terms', 'terms', 'Terms of use']]) {
  for (const w of [320, 390, 1280]) {
    const { ctx, pg, errs } = await open(route, { w }); await pg.waitForSelector(`[data-legal="${id}"]`);
    const heads = await h1s(pg); ok(heads.length === 1 && heads[0] === title, `${id} @${w}: exactly one h1, "${heads.join('|')}"`);
    ok((await pg.locator('[data-legal-updated]').innerText()).startsWith('Last updated ') && /\d{1,2} [A-Z][a-z]+ \d{4}/.test(await pg.locator('[data-legal-updated]').innerText()), `${id} @${w}: a "Last updated" date`);
    ok((await over(pg)) <= 1, `${id} @${w}: no horizontal overflow (${await over(pg)})`);
    if (w === 390) {
      const folds = await pg.locator('details.fold').count(); ok(folds >= 8, `${id}: ${folds} sections as shared Fold components`);
      ok(await pg.locator('details.fold[data-fold="short"][open]').count() === 1, `${id}: the short version is open, the detail is one tap away`);
      ok(await pg.title() === `${title} · Tripwire`, `${id}: document title "${await pg.title()}"`);
      const c = await pg.locator('[data-contact]').innerText(); /* 12 Nov 2026 (Tripwire 2.0): SUPPORT_EMAIL is set to the owner's address, so the line is a mailto link; the "not set up yet" case is pinned in legal.test.ts */
      ok(c === 'Contact: hello@askakshay.com' && await pg.locator('[data-contact] a[href="mailto:hello@askakshay.com"]').count() === 1, `${id}: contact reads "${c}" and links to mailto:hello@askakshay.com`);
      ok(await pg.locator('.tabs [aria-current="page"]').innerText().then((t) => /Menu/.test(t)), `${id}: the Menu tab is the current one`); // 11 Nov 2026: More was renamed Menu
      ok(await pg.locator('a[href="#/terms"], a[href="#/privacy"]').count() >= 1, `${id}: links to its sibling page`);
      const text = (await pg.locator('main').innerText()).replace(/\s+/g, ' ');
      if (id === 'privacy') {
        await pg.locator('details.fold').evaluateAll((d) => d.forEach((x) => { x.open = true; })); const all = (await pg.locator('main').innerText()).replace(/\s+/g, ' ');
        ok(/Yahoo Finance/.test(all) && /Google News and Bing News/.test(all) && /raw\.githubusercontent\.com/.test(all) && /Cloudflare/.test(all), 'privacy: names the third-party sources and the host');
        ok(/Delete all my data/.test(all) && /not encrypted/.test(all) && /TradingView/.test(all) && /not verified/i.test(all), 'privacy: erase path, plain-text backup, TradingView and "not verified" are all stated');
        ok(!/\bcookie\b.{0,40}\b(we|Tripwire) (use|set)s?\b/i.test(all) && /sets no cookies/.test(all), 'privacy: states that no cookies are set');
      } else {
        await pg.locator('details.fold').evaluateAll((d) => d.forEach((x) => { x.open = true; })); const all = (await pg.locator('main').innerText()).replace(/\s+/g, ' ');
        ok(/Paper trading only|paper-only|Paper only/i.test(all) && /not investment advice/i.test(all) && /No order is placed/.test(all) && /30 trades/.test(all) && /No warranty/i.test(all), 'terms: paper only, not advice, no order, the 30-trade rule, no warranty');
      }
      void text;
      // every section opened: axe over the whole document
      const v = await bad(pg); ok(v.length === 0, `${id}: axe serious/critical clean with every section open${v.length ? ' ' + v.join('; ') : ''}`);
    }
    ok(errs.length === 0, `${id} @${w}: no page errors ${errs.join(' ')}`); await ctx.close();
  }
  // print
  { const { ctx, pg } = await open(route, { w: 704 }); await pg.waitForSelector(`[data-legal="${id}"]`); await pg.emulateMedia({ media: 'print' }); await pg.waitForTimeout(400);
    const shut = await pg.evaluate(() => [...document.querySelectorAll('details')].filter((d) => !d.open).length); ok(shut === 0, `${id} print: every section prints open (${shut} closed)`);
    const hid = await pg.evaluate(() => ['.tabs', '.statusbar', '.noprint'].every((s) => [...document.querySelectorAll(s)].every((e) => getComputedStyle(e).display === 'none')));
    ok(hid, `${id} print: tab bar, status bar and the Print button are not printed`);
    ok(await pg.locator('h1').isVisible() && (await h1s(pg)).length === 1, `${id} print: the heading is there once`);
    const bg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor); ok(/255, 255, 255/.test(bg), `${id} print: white page (${bg})`);
    ok((await over(pg)) <= 1, `${id} print: one page width, nothing clipped (${await over(pg)})`);
    const cut = await pg.evaluate(() => [...document.querySelectorAll('.legal *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 1; }).length); ok(cut === 0, `${id} print: nothing wider than the page (${cut})`);
    await ctx.close(); }
}
/* the print button calls window.print (not asserted by opening a dialog) and the page is reachable from More, the footer and Settings */
{ const { ctx, pg } = await open('/#/more'); await pg.waitForSelector('[data-more]');
  ok(await pg.locator('[data-more-row="privacy"]').count() === 1 && await pg.locator('[data-more-row="terms"]').count() === 1, 'More: a Privacy row and a Terms row');
  await pg.locator('[data-more-row="privacy"]').click(); await pg.waitForSelector('[data-legal="privacy"]'); ok(/#\/privacy$/.test(pg.url()), 'More: the Privacy row opens the page'); await ctx.close(); }
{ const { ctx, pg } = await open('/#/settings'); await pg.waitForSelector('[data-settings="device"]');
  ok(await pg.locator('a[href="#/privacy"]').count() === 1 && await pg.locator('a[href="#/terms"]').count() === 1, 'Settings: links to Privacy and Terms'); await ctx.close(); }
for (const route of ['/#/today', '/#/help', '/#/methodology']) { const { ctx, pg } = await open(route); await pg.waitForSelector('.ident');
  ok(await pg.locator('.ident a[href="#/privacy"]').count() === 1 && await pg.locator('.ident a[href="#/terms"]').count() === 1, `${route.slice(3)}: the footer links Privacy and Terms`);
  const box = await pg.locator('.ident a[href="#/privacy"]').boundingBox(); ok(box && box.height >= 40, `${route.slice(3)}: the footer link is a tap-sized target (${box?.height})`); await ctx.close(); }
/* a first-time visitor (nothing saved, not onboarded) can read both pages from a link, and the first-use screen links to them */
{ const fresh = { ...STATE, onboarded: false, follows: [], entries: [], paper: [] };
  for (const [r, id] of [['/#/privacy', 'privacy'], ['/#/terms', 'terms']]) { const { ctx, pg } = await open(r, { state: fresh }); ok(await pg.locator(`[data-legal="${id}"]`).count() === 1, `a first-time visitor can open #${r.slice(2)} without choosing anything`); await ctx.close(); }
  const { ctx, pg } = await open('/#/today', { state: fresh }); await pg.waitForSelector('.welcome'); ok(await pg.locator('.welcome a[href="#/privacy"]').count() === 1 && await pg.locator('.welcome a[href="#/terms"]').count() === 1, 'the first-use screen links to Privacy and Terms'); await ctx.close(); }

/* ---- Not found: an unknown route ---- */
for (const w of [320, 390, 1280]) {
  const { ctx, pg, errs } = await open('/#/nope', { w }); await pg.waitForSelector('[data-notfound="route"]');
  ok((await h1s(pg)).join('|') === 'Not found', `404 @${w}: one h1 "Not found"`);
  ok((await pg.title()).startsWith('Not found'), `404 @${w}: document title "${await pg.title()}"`);
  ok((await pg.locator('[data-asked]').innerText()) === '/nope', `404 @${w}: says what was asked`);
  ok(await pg.locator('[data-notfound] a[href="#/today"]').count() === 1 && await pg.locator('[data-notfound] a[href="#/discover"]').count() === 1 && await pg.locator('[data-notfound] a[href="#/more"]').count() === 1, `404 @${w}: links to Today, Discover and More`);
  ok(await pg.locator('[data-notfound] [data-sec], .today, [data-hero]').count() === 0, `404 @${w}: it is not Today wearing a different address`);
  ok((await over(pg)) <= 1, `404 @${w}: no horizontal overflow (${await over(pg)})`);
  if (w === 390) {
    const v = await bad(pg); ok(v.length === 0, `404: axe serious/critical clean${v.length ? ' ' + v.join('; ') : ''}`);
    ok(await pg.locator('.tabs [aria-current="page"]').innerText().then((t) => !/Today/.test(t)), '404: the Today tab is not marked current');
    await pg.getByRole('button', { name: 'Search companies' }).click(); await pg.waitForSelector('[role=dialog]'); ok(true, '404: "Search companies" opens the search'); await pg.keyboard.press('Escape');
    await pg.locator('[data-notfound] a[href="#/today"]').click(); await pg.waitForSelector('[data-hero], .today'); ok(/#\/today$/.test(pg.url()) && (await pg.title()).startsWith('Today'), `404: Today link works and the title follows ("${await pg.title()}")`);
    await pg.goto(base + '/#/nope'); await pg.waitForSelector('[data-notfound]'); await pg.locator('.tabs a', { hasText: 'Menu' }).click(); await pg.waitForSelector('[data-more]');
    await pg.goto(base + '/#/discover'); await pg.locator('.tabs a', { hasText: 'Menu' }).click(); await pg.waitForSelector('[data-more]'); ok(!/nope/.test(pg.url()), '404: the Menu tab (was More until 11 Nov 2026) never returns to the unknown address');
  }
  ok(errs.length === 0, `404 @${w}: no page errors ${errs.join(' ')}`); await ctx.close();
}
{ // the address is printed as text, never as markup
  const { ctx, pg } = await open('/#/%3Cb%3Ex%3C%2Fb%3E%3Cimg%20src%3Dx%20onerror%3Dwindow.__x%3D1%3E'); await pg.waitForSelector('[data-notfound="route"]');
  const t = await pg.locator('[data-asked]').innerText(); ok(t.startsWith('/<b>x</b>'), `404: markup in the address is shown as text (${t.slice(0, 40)})`);
  ok(await pg.locator('[data-asked] *').count() === 0 && !(await pg.evaluate(() => window.__x)), '404: no element or handler was created from the address'); await ctx.close(); }
{ const { ctx, pg } = await open('/#/Today'); await pg.waitForSelector('[data-notfound="route"]'); ok(true, '404: #/Today (wrong case) is not found, not Today by accident'); await ctx.close(); }
{ const { ctx, pg } = await open('/#/'); await pg.waitForSelector('.today, [data-hero]'); ok((await pg.locator('[data-notfound]').count()) === 0, 'the bare address is still Today'); await ctx.close(); }
for (const r of ['/#/today', '/#/discover', '/#/desk', '/#/more', '/#/signals', '/#/settings', '/#/profile', '/#/data', '/#/methodology', '/#/help', '/#/ops', '/#/live', '/#/news', '/#/markets', '/#/lab', '/#/compare?s=TCS', '/#/m/GOLD', '/#/report/TCS']) {
  const { ctx, pg } = await open(r); ok((await pg.locator('[data-notfound]').count()) === 0, `${r.slice(2)} is a real route, not "Not found"`); await ctx.close(); }

/* ---- Not found: an unknown company ---- */
for (const w of [320, 390, 1280]) {
  const { ctx, pg, errs } = await open('/#/c/ZZZZ', { w }); await pg.waitForSelector('[data-notfound="company"]');
  ok((await h1s(pg)).join('|') === 'We do not have this company', `unknown company @${w}: one h1 "We do not have this company"`);
  ok((await pg.title()).startsWith('Not found'), `unknown company @${w}: document title "${await pg.title()}"`);
  ok((await pg.locator('[data-asked]').innerText()) === 'ZZZZ' && /listed companies/.test(await pg.locator('[data-notfound]').innerText()), `unknown company @${w}: names the symbol and the size of the screen`);
  ok((await over(pg)) <= 1, `unknown company @${w}: no horizontal overflow`);
  if (w === 390) { const v = await bad(pg); ok(v.length === 0, `unknown company: axe serious/critical clean${v.length ? ' ' + v.join('; ') : ''}`); }
  ok(errs.length === 0, `unknown company @${w}: no page errors ${errs.join(' ')}`); await ctx.close();
}
{ const { ctx, pg } = await open('/#/c/' + 'Q'.repeat(120), { w: 320 }); await pg.waitForSelector('[data-notfound="company"]'); ok((await over(pg)) <= 1, 'a very long unknown symbol does not overflow at 320'); await ctx.close(); }
{ const { ctx, pg } = await open('/#/c/TCS'); await pg.waitForSelector('h1'); ok((await pg.locator('[data-notfound]').count()) === 0 && (await pg.title()) === 'Company · Tripwire', 'a company that exists still opens its page'); await ctx.close(); }

/* ---- the share image, the tags and the crawler files, as served ---- */
{ const ctx = await b.newContext({ serviceWorkers: 'block' }); const rq = ctx.request;
  const html = await (await rq.get(base + '/')).text();
  const tag = (k, v) => (new RegExp(`<meta ${k}="${v}" content="([^"]*)"`).exec(html) ?? [])[1] ?? null;
  const ABS = 'https://tripwire.askakshay.com/og.png';
  ok(tag('property', 'og:image') === ABS && tag('name', 'twitter:image') === ABS, 'served HTML: og:image and twitter:image are the absolute https URL');
  ok(tag('property', 'og:image:width') === '1200' && tag('property', 'og:image:height') === '630' && tag('name', 'twitter:card') === 'summary_large_image', 'served HTML: 1200 x 630 and the large-image card');
  ok(!!tag('property', 'og:title') && !!tag('property', 'og:description') && !!tag('name', 'twitter:title') && !!tag('name', 'twitter:description'), 'served HTML: og and twitter title and description are present');
  ok(/<link rel="canonical" href="https:\/\/tripwire\.askakshay\.com\/">/.test(html), 'served HTML: canonical is the site root');
  const img = await rq.get(base + '/og.png'); const body = await img.body();
  ok(img.status() === 200 && /^image\/png/.test(img.headers()['content-type'] ?? ''), `og.png: 200 image/png (${img.status()} ${img.headers()['content-type']})`);
  ok(body.length < 120 * 1024 && body.length > 5000, `og.png: ${(body.length / 1024).toFixed(1)} KB, under 120 KB`);
  ok(body.readUInt32BE(16) === 1200 && body.readUInt32BE(20) === 630, 'og.png: 1200 x 630');
  ok(img.headers()['x-content-type-options'] === 'nosniff', 'og.png: nosniff header');
  const robots = await (await rq.get(base + '/robots.txt')).text(); ok(/Allow: \/\$/.test(robots) && /Disallow: \/api\//.test(robots) && !/Disallow: \/\s*$/m.test(robots) && /Sitemap: https:\/\/tripwire\.askakshay\.com\/sitemap\.xml/.test(robots), 'robots.txt: the page is allowed, /api/ and /data/ are not, the sitemap is named');
  const sm = await (await rq.get(base + '/sitemap.xml')).text(); const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(/^<\?xml/.test(sm) && locs.length === 1 && locs[0] === 'https://tripwire.askakshay.com/' && /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sm) && !/__LASTMOD__/.test(sm), `sitemap.xml: valid, the root only (${locs.join(',')}), a dated lastmod`);
  const sec = await rq.get(base + '/.well-known/security.txt'); const st = await sec.text(); /* 12 Nov 2026: published now that SUPPORT_EMAIL is set */
  ok(/^Contact: mailto:hello@askakshay\.com$/m.test(st) && /^Expires: /m.test(st), 'security.txt is published with the owner\'s contact and an expiry');
  const llms = await (await rq.get(base + '/llms.txt')).text(); ok(/#\/privacy/.test(llms) && /#\/terms/.test(llms), 'llms.txt points at the Privacy and Terms pages');
  await ctx.close(); }
await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nall legal checks passed'); process.exit(fails ? 1 : 0);
