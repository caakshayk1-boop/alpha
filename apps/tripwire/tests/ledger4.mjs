// Tripwire 2.0 ledger layout in the browser (12 Nov 2026). Acceptance §5.10 and the visible parts of §5.1, §5.5 and §5.6:
// the Book's P&L hierarchy (scope and trust, then Total P&L with Realised / Unrealised / Today, then what moved, then the table), 320 / 375 / 390 and the audited 1265 desktop,
// 200% zoom (a 1280 desktop at 200% is a 640 CSS px viewport; 320 stands for 400%), large and negative Indian-format currency that must never wrap its last digit,
// an unavailable chart that collapses, long company names. Runs on the mocked ledger of bookfixture.mjs.
// Usage: node apps/tripwire/tests/ledger4.mjs [baseUrl] [shotDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { D, ledger, openCtx } from './bookfixture.mjs';
const base = process.argv[2] ?? 'http://localhost:8971'; const shots = process.argv[3]; if (shots) mkdirSync(shots, { recursive: true });
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) bad++; };
const b = await chromium.launch();
const noOverflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const AMOUNTS = ['−₹12,34,56,789', '+₹1,23,45,67,890', '₹99,99,999', '−₹5', 'Unavailable'];

for (const width of [320, 375, 390, 640, 1265]) {
  const ctx = await openCtx(b, width, ledger); const pg = await ctx.newPage();
  await pg.goto(`${base}/#/signals?v=positions`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-strip]', { timeout: 20000 });
  const rows = await pg.evaluate(() => ['[data-scope-row]', '[data-total-pnl]', '[data-moved]', '.l4-support'].map((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }));
  ok(rows.every((y) => y != null) && rows.every((y, i) => !i || y >= rows[i - 1]) && rows[3] > rows[0], `${width}: the strip runs scope and trust, then the answer, then what moved, then the supporting figures (${rows.join(' < ')})`);
  ok(/^engine paper book$/i.test(await pg.locator('[data-scope-name]').innerText()) && !/Your paper portfolio/.test(await pg.locator('body').innerText()), `${width}: the scope is named "Engine paper book" and nothing is headed "Your paper portfolio"`);
  ok(!/not real money|Paper only/i.test(await pg.locator('[data-scope-row]').innerText()) && /Paper only/.test(await pg.locator('body').innerText()) , `${width}: the pill that repeated paper-only is gone from row 1 (the page header says it once)`);
  { const body = await pg.locator('[data-strip]').innerText(); const ex = await pg.locator('[data-exit-verification]').count(); const qu = await pg.locator('[data-quotes]').count();
    ok(!/Exit verification: complete/.test(body) && !/Quotes:/.test(body), `${width}: a healthy status is silent: no "Exit verification: complete" and no "Quotes:" row`);
    ok((!ex || /Exit checks incomplete/.test(await pg.locator('[data-exit-verification]').innerText())) && (!qu || /Quotes (delayed|unavailable)/.test(await pg.locator('[data-quotes]').innerText())), `${width}: a status chip appears only for a problem, in its own words (exit chip ${ex}, quotes chip ${qu})`);
    ok(!/snap-[0-9a-f]+/.test(body) && !/Realised is booked exits/.test(body) && await pg.locator('[data-total-note] a[href="#/info?s=pnl"]').count() === 1, `${width}: no snapshot id and no explanatory paragraph in the strip; a link says how these are calculated`); }
  { const mk = await pg.locator('[data-marks]').count(); const t = await pg.locator('[data-strip]').innerText(); ok(mk === 0 ? !/partial subtotal/.test(t) : /Marks unavailable|partial subtotal|have an R result but no rupee figure/.test(await pg.locator('[data-marks]').innerText()), `${width}: mark coverage is stated only when it is partial (${mk ? 'shown' : 'silent, nothing missing'})`); }
  const hero = await pg.evaluate(() => { const t = document.querySelector('[data-total]'); const open = document.querySelector('.bk-open b'); const sz = (e) => e ? parseFloat(getComputedStyle(e).fontSize) : 0; return { total: sz(t), open: sz(open), parts: ['[data-realised]', '[data-unrealised]', '[data-day]'].every((s) => !!document.querySelector(s)) }; });
  ok(hero.parts && hero.total > hero.open, `${width}: Total P&L (${hero.total}px) is the biggest figure, above the open-position count (${hero.open}px); Realised / Unrealised / Today sit beneath it`);
  ok(!/%/.test(await pg.locator('[data-total-pnl]').innerText()), `${width}: no performance percentage (no capital base is defined)`);
  /* large and negative Indian-format currency: injected into the real container so the real CSS decides */
  for (const text of AMOUNTS) {
    const r = await pg.evaluate((t) => { const hero = document.querySelector('[data-total-pnl]'); const el = document.createElement('b'); el.className = 'num amt l4-big'; el.style.setProperty('--ch', String(Math.max(6, t.length))); el.textContent = t; el.setAttribute('data-probe', ''); hero.appendChild(el);
      const c = hero.getBoundingClientRect(); const e = el.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(el).lineHeight) || e.height; const out = { fits: e.right <= c.right + 0.5 && el.scrollWidth <= el.clientWidth + 1, oneLine: e.height <= lh * 1.2, size: parseFloat(getComputedStyle(el).fontSize) }; el.remove(); return out; }, text);
    ok(r.fits && r.oneLine, `${width}: "${text}" stays on one line inside its box (${r.size.toFixed(1)}px)`);
  }
  ok(await noOverflow(pg), `${width}: the Positions view does not scroll sideways`);
  ok(await pg.locator('[data-pnl-table] table').count() === 1 && /lc:/.test(await pg.locator('[data-pnl-table]').innerHTML()), `${width}: the table carries each position's lifecycle id`);
  if (width === 390 || width === 1265) if (shots) await pg.screenshot({ path: `${shots}/ledger4-${width}.png`, fullPage: false });
  await ctx.close();
}
/* the Paper P&L page: its hero says what the engine book is, and an unavailable day chart is one compact line */
for (const width of [320, 390, 1265]) {
  const ctx = await openCtx(b, width, ledger); const pg = await ctx.newPage();
  await pg.goto(`${base}/#/live`, { waitUntil: 'networkidle' }).catch(() => {}); await pg.waitForTimeout(1200);
  const t = await pg.locator('body').innerText();
  ok(!/Your paper portfolio/.test(t) && /Engine paper book/.test(t), `${width}: the Paper P&L page is headed "Engine paper book"`);
  ok(/Open-trade P&L, includes booked partials/.test(t), `${width}: and its open figure is called open-trade P&L, includes booked partials`);
  ok(!/\d+ waiting\b/.test(t) && /awaiting entry/.test(t), `${width}: "waiting" is "awaiting entry"`);
  await pg.getByRole('button', { name: /Ask about the paper portfolio/i }).first().click().catch(() => {});
  ok(/What contributes to open-trade P&L\?/.test(await pg.locator('body').innerText()) && !/What changed\?/.test(await pg.locator('body').innerText()), `${width}: the question is "What contributes to open-trade P&L?", not "What changed?"`);
  const h = await pg.evaluate(() => { const e = document.querySelector('.live-chart-empty'); return e ? e.getBoundingClientRect().height : 0; });
  ok(h === 0 || h < 140, `${width}: an unavailable chart is compact (${Math.round(h)}px)`);
  if (!(await noOverflow(pg))) console.log('overflowing:', await pg.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 4).map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right))));
  ok(await noOverflow(pg), `${width}: the Paper P&L page does not scroll sideways`);
  await ctx.close();
}
await b.close(); console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
