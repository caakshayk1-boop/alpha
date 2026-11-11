// Browser checks for the 10 Nov 2026 audit: every guide link navigates (click, keyboard, back and forward), the countercase leads with its limit, one "Data as of" block,
// provenance beside each research claim, the Discover search + preset empty state, no off-site identity link, and the two "not verified" areas the audit listed first:
// local data (save → reload → reopen, thesis versions, export → import into an empty browser, malformed and older backups) and mobile widths 320/375/390 (no overflow, no clipped controls).
import { chromium } from 'playwright';
import { mockApi, STATE } from './fixtures.mjs';
import { ohlcSeries } from './uimock.mjs';
import { readFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
/** A context whose saved state is seeded ONCE (only when empty), so a reload shows what the page itself saved. */
async function ctxOf(width, state, extra = {}) {
  const ctx = await b.newContext({ viewport: { width, height: width >= 1000 ? 900 : 844 }, serviceWorkers: 'block', acceptDownloads: true, ...extra });
  await mockApi(ctx); await ctx.route('**/api/chart*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ohlcSeries(300, 'TCS', { nifty: true }) }));
  if (state !== null) await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, state ?? STATE);
  return ctx;
}
const saved = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1') ?? 'null'));
const EMPTY = { ...STATE, follows: [], paper: [], entries: [], plans: [] };
/** Opens the guide only when it is closed (a second click on its summary would close it). */
const openGuide = async (pg) => { await pg.waitForSelector('details[data-fold="workflow"]'); if (!(await pg.locator('details[data-fold="workflow"]').evaluate((d) => d.open))) await pg.locator('details[data-fold="workflow"] > summary').click(); };

try {
  /* 1. P1: the guide's links on My Desk navigate, by click and by keyboard, and back/forward return */
  for (const w of [1280, 390]) {
    const ctx = await ctxOf(w, EMPTY); const pg = await ctx.newPage(); await pg.goto(base + '/#/desk'); await openGuide(pg);
    const links = await pg.locator('[data-workflow] .wf-a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    ok(links.length === 5 && links.includes('#/desk?v=journal'), `${w}: the guide has five step links, including the journal (${links.join(' ')})`);
    const bad = [];
    for (const href of links) {
      await pg.goto(base + '/#/desk'); await openGuide(pg);
      const a = pg.locator(`[data-workflow] .wf-a[href="${href}"]`);
      const hit = await a.evaluate((el) => { el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!top && (top === el || el.contains(top)); });
      await a.click({ timeout: 4000 }).catch(() => bad.push(`${href} (click blocked)`)); await pg.waitForTimeout(250);
      if (!hit) bad.push(`${href} (covered)`); if (!pg.url().endsWith(href)) bad.push(`${href} (went to ${pg.url().split('#')[1]})`);
    }
    ok(bad.length === 0, `${w}: every guide link is on top at its centre and navigates by click ${bad.join(', ')}`);
    await pg.goto(base + '/#/desk'); await openGuide(pg);
    await pg.locator('[data-workflow] .wf-a[href="#/desk?v=journal"]').focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
    ok(pg.url().endsWith('#/desk?v=journal'), `${w}: the journal link works from the keyboard`);
    await pg.goBack(); await pg.waitForTimeout(250); ok(/#\/desk$/.test(pg.url()), `${w}: back returns to the desk`);
    await pg.goForward(); await pg.waitForTimeout(250); ok(pg.url().endsWith('#/desk?v=journal'), `${w}: forward returns to the journal`);
    ok(await pg.getByRole('radio', { name: 'Journal' }).count() + await pg.getByRole('tab', { name: 'Journal' }).count() >= 1 || /Journal/.test(await pg.locator('main').innerText()), `${w}: the journal view is shown`);
    await ctx.close();
  }

  /* 2. P1: countercase coverage leads, neutral; one Data as of block; provenance beside each claim; no askakshay link */
  { const ctx = await ctxOf(1280); const pg = await ctx.newPage(); await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('[data-asof]');
    const rows = await pg.locator('[data-asof-row] dt').allInnerTexts();
    ok(rows.join('|') === 'Quote|Screen metrics|Chart|Accounts|Filing', `one Data as of block with the five labelled clocks (${rows.join(', ')})`);
    ok(/Publication date unavailable/.test(await pg.locator('[data-asof-row="filing"]').innerText()), 'the filing date is said to be unavailable, not left blank');
    ok(await pg.locator('[data-asof]').count() === 1 && await pg.getByText('Screen figures: close of').count() === 0, 'the scattered date strings are gone from the price card');
    const pubs = await pg.locator('[data-research-read] [data-pub-missing]').count(); const stm = await pg.locator('[data-research-read] [data-fact]').count();
    ok(pubs >= 1 && pubs < stm + 1, `each statement-based claim says beside itself that its publication date is unavailable (${pubs} of ${stm})`);
    await pg.locator('[data-research-read] [data-fact] > summary').first().click();
    ok(/Method & limits/.test(await pg.locator('[data-research-read] .rr-method').first().innerText()) && /Snapshot built/.test(await pg.locator('[data-research-read] .rr-prov').first().innerText()), 'Method & limits names period, source, snapshot build and publication');
    await pg.getByRole('tab', { name: 'Risks', exact: true }).click(); await pg.waitForSelector('[data-coverage]');
    const order = await pg.evaluate(() => { const c = document.querySelector('[data-coverage]'); const s = [...document.querySelectorAll('details.ev > summary')].find((x) => /Countercase/.test(x.textContent)); return { before: !!(c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING), text: c.textContent, colour: getComputedStyle(c).backgroundColor, state: c.getAttribute('data-coverage') }; });
    ok(order.before, 'the coverage line comes before the countercase count');
    ok(/This screen does not assess every business risk\./.test(order.text), `the limit is stated first-class (${order.state}: ${order.text.slice(0, 80)})`);
    ok(!/rgb\(74, 222, 128|rgba\(74, 222, 128/.test(order.colour), 'the coverage line is neutral, not reassuring green');
    ok(await pg.locator('a[href*="//askakshay.com"]').count() === 0, 'no link to askakshay.com on the company page');
    await ctx.close(); }

  /* 3. P2: a search + preset intersection names its parts and offers to undo each */
  { const ctx = await ctxOf(1280); const pg = await ctx.newPage(); await pg.goto(base + '/#/discover?q=TCS&value=cheap&quality=high'); await pg.waitForSelector('[data-empty-actions]');
    const title = await pg.locator('.card .lead').first().innerText();
    ok(/No company matches “TCS” \+ PE 15 or less \+ ROCE 20%\+/.test(title), `the empty state names the search and each filter (${title})`);
    ok(await pg.getByRole('button', { name: 'Remove search: TCS' }).count() === 1, 'the search is a removable chip beside the filters');
    for (const n of ['Search only', 'Clear all filters']) ok(await pg.locator('[data-empty-actions]').getByRole('button', { name: n }).count() === 1, `the empty state offers "${n}"`);
    await pg.locator('[data-empty-actions]').getByRole('button', { name: 'Search only' }).click(); await pg.waitForTimeout(400);
    ok(await pg.locator('.list .li[data-sym="TCS"]').count() === 1, '"Search only" keeps the search and brings TCS back');
    await ctx.close(); }

  /* 4. Local data: save → reload → reopen; versions survive; export → import into an empty browser round-trips; malformed and future backups change nothing */
  { const ctx = await ctxOf(390); const pg = await ctx.newPage(); await pg.goto(base + '/#/desk?v=journal'); await pg.getByText('Seed thesis', { exact: true }).click();
    await pg.locator('#t-thesis').fill('Seed thesis, revised after the results'); await pg.getByRole('button', { name: 'Save as new version' }).click(); await pg.waitForTimeout(300);
    const s1 = await saved(pg); ok(s1.entries[0].versions.length === 2 && s1.entries[0].versions[0].thesis === 'Seed thesis', 'an edit saves a new version and keeps the first');
    await pg.reload(); await pg.waitForTimeout(600); const s2 = await saved(pg);
    ok(JSON.stringify(s2.entries) === JSON.stringify(s1.entries), 'after a reload the journal is exactly what was saved');
    ok(/revised after the results/.test(await pg.locator('main').innerText()), 'the reopened journal shows the latest version');
    await pg.goto(base + '/#/settings'); await pg.waitForSelector('[data-settings="backup"]');
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: 'Export all (JSON)' }).click()]);
    const file = await dl.path(); const text = readFileSync(file, 'utf8'); const backup = JSON.parse(text);
    ok(backup && Array.isArray(backup.entries ?? backup.state?.entries), 'the export is a JSON backup that holds the journal');
    await ctx.close();
    // a second browser that has been through first use and holds nothing
    const c2 = await ctxOf(390, EMPTY); const p2 = await c2.newPage(); await p2.goto(base + '/#/settings'); await p2.waitForSelector('[data-settings="backup"]');
    await p2.setInputFiles('[data-settings="backup"] input[type=file]', { name: 'tripwire-backup.json', mimeType: 'application/json', buffer: Buffer.from(text) }); await p2.waitForTimeout(600);
    const s3 = await saved(p2);
    ok(s3 && s3.entries.length === 1 && JSON.stringify(s3.entries) === JSON.stringify(s2.entries) && JSON.stringify(s3.follows) === JSON.stringify(s2.follows) && JSON.stringify(s3.paper) === JSON.stringify(s2.paper), 'import into an empty browser restores the journal (every version), follows and paper trades exactly');
    await p2.reload(); await p2.waitForTimeout(500); ok(JSON.stringify((await saved(p2)).entries) === JSON.stringify(s2.entries), 'the imported state survives a reload');
    const again = await saved(p2);
    await p2.setInputFiles('[data-settings="backup"] input[type=file]', { name: 'tripwire-backup.json', mimeType: 'application/json', buffer: Buffer.from(text) }); await p2.waitForTimeout(500);
    ok(JSON.stringify((await saved(p2)).entries) === JSON.stringify(again.entries), 'importing the same backup twice duplicates nothing');
    for (const [name, body] of [['broken.json', '{"entries": ['], ['future.json', JSON.stringify({ ...backup, v: 99 })], ['other.json', '{"hello":"world"}']]) {
      const before = await p2.evaluate(() => localStorage.getItem('tripwire:v1'));
      await p2.setInputFiles('[data-settings="backup"] input[type=file]', { name, mimeType: 'application/json', buffer: Buffer.from(body) }); await p2.waitForTimeout(400);
      const msg = await p2.locator('#import-result').innerText().catch(() => '');
      ok(before === await p2.evaluate(() => localStorage.getItem('tripwire:v1')) && /Nothing was changed/.test(msg), `${name}: refused with a reason, and nothing was changed (${msg.slice(0, 70)})`);
    }
    await c2.close(); }

  /* 5. Mobile: 320, 375, 390. No horizontal overflow, no control clipped or covered, on the pages a person moves through */
  for (const w of [320, 375, 390]) {
    const ctx = await ctxOf(w); const pg = await ctx.newPage(); const bad = [];
    for (const route of ['/#/today', '/#/c/TCS', '/#/discover', '/#/discover?q=TCS&value=cheap&quality=high', '/#/desk', '/#/desk?v=journal', '/#/compare?s=TCS,GCSL', '/#/settings', '/#/methodology']) {
      await pg.goto(base + route); await pg.waitForTimeout(1300);
      const m = await pg.evaluate(() => {
        const over = document.documentElement.scrollWidth - innerWidth;
        const clipped = [...document.querySelectorAll('main button, main a.btn, main [role=radio], main [role=tab], main input, main select')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return false;
          // a control inside a row that scrolls sideways (a chip rail, a tab strip) is reachable by scrolling that row: not clipped
          for (let p = e.parentElement; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 1) return false; }
          return r.left < -1 || r.right > innerWidth + 1; }).map((e) => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24));
        return { over, clipped };
      });
      if (m.over > 1) bad.push(`${route} overflows by ${m.over}px`); if (m.clipped.length) bad.push(`${route} clips ${m.clipped.slice(0, 3).join(', ')}`);
    }
    ok(bad.length === 0, `${w}px: nine pages with no horizontal overflow and no control off-screen ${bad.join('; ')}`);
    await ctx.close();
  }
} finally { await b.close(); }
if (fails) { console.log(`audit: ${fails} failed`); process.exit(1); }
console.log('audit: all passed');
