// The Paper Book and the one Record in the browser: position cards with the target ladder, the hit card, picks-through / outcomes-through, the unified Record,
// 360 px layout, 44 px targets, one h1, motion only under html.fx. Runs on a mocked ledger (the positions are all finished, so no price feed is needed).
// Usage: node apps/tripwire/tests/book.mjs [baseUrl] [shotDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { A, B, C, D, outcomes, ledger, last, openCtx } from './bookfixture.mjs';
const base = process.argv[2] ?? 'http://localhost:8851'; const shots = process.argv[3]; if (shots) mkdirSync(shots, { recursive: true });
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) bad++; };
const b = await chromium.launch();
const open = (width, led = ledger) => openCtx(b, width, led);
const noOverflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

for (const width of [320, 360, 390, 1280]) {
  const ctx = await open(width); const pg = await ctx.newPage();
  /* ---- the Book: Positions (11 Nov 2026, revamp v2: Auto and Mine are one board; a closed engine position is listed once, in Record, so the closed-card checks moved there) ---- */
  await pg.goto(`${base}/#/signals?v=auto`, { waitUntil: 'networkidle' }); await pg.waitForSelector('.pcard [data-ladder]', { timeout: 20000 });
  ok(await pg.getByRole('tab', { name: 'Positions' }).getAttribute('aria-selected') === 'true', `${width}: the old ?v=auto address opens Positions`);
  ok(await pg.locator('.pcard').count() === 1 && await pg.locator('.pcard[data-pos="' + D.id + '"]').count() === 1, `${width}: the board lists the open position once, and no closed one`);
  ok(/3 engine positions have closed/.test(await pg.locator('[data-positions]').innerText()), `${width}: and says where the closed ones are`);
  ok(await pg.locator('h1').count() === 1, `${width}: one h1 on the Book`);
  ok(await noOverflow(pg), `${width}: the Book does not scroll sideways`);
  const head = pg.locator('.pc-head').first(); const hb = await head.boundingBox();
  ok(hb.height >= 44, `${width}: the row header is a 44 px target (${Math.round(hb.height)})`);
  const dt = await pg.locator('.pcard[data-pos="' + D.id + '"]').innerText();
  ok(/DDD/.test(dt) && /Engine/i.test(dt) && /Momentum/.test(dt) && /Session \d+ of 20/.test(dt), `${width}: a row names the symbol, who took it, the engine and the session count`);
  ok(await pg.locator('[data-through]').count() === 1 && /Picks through/.test(await pg.locator('[data-through]').innerText()) && /Outcomes through/.test(await pg.locator('[data-through]').innerText()), `${width}: the Book shows picks-through and outcomes-through`);
  ok(await pg.locator('[data-sec="hits"]').count() === 1 && /T2 hit — position closed/.test(await pg.locator('[data-sec="hits"]').innerText()) && /nothing is sent to you/.test(await pg.locator('[data-sec="hits"]').innerText()), `${width}: the target-hit card is at the top of the Book`);
  ok(await pg.locator('[data-strip]').count() === 1 && /of 50 slots/i.test(await pg.locator('[data-strip]').innerText()) && /3\s*of 30/.test(await pg.locator('[data-strip]').innerText()) && /too few to judge/.test(await pg.locator('[data-strip]').innerText()), `${width}: the strip states slots used, and closed of 30 with "too few to judge"`);
  ok(await pg.evaluate(() => document.querySelector('.pcard .amt') !== null), `${width}: rupee figures carry .amt so the privacy switch hides them`);
  // expanding keeps the existing details
  await head.click(); ok(await pg.locator('.pcard .pc-more').count() === 1 && await head.getAttribute('aria-expanded') === 'true', `${width}: the row opens the existing details`);
  ok(/29 Oct/.test(await pg.locator('.pcard .pc-more [data-position-time]').innerText()), `${width}: the details carry the entry date`);
  // keyboard: focus ring on the header
  await pg.keyboard.press("Shift"); await head.focus(); const ring = await head.evaluate((e) => getComputedStyle(e).outlineStyle); ok(ring !== 'none', `${width}: the header shows a focus ring`);
  // motion: nothing animates without html.fx; with it the marker travels (transform only)
  const anim = async (on) => pg.evaluate((o) => { document.documentElement.classList.toggle('fx', o); const m = document.querySelector('.tl-marker'); return m ? getComputedStyle(m).animationName : 'no-marker'; }, on);
  ok(await anim(false) === 'none', `${width}: motion off: the marker does not animate`);
  ok(await anim(true) === 'tl-travel', `${width}: motion on (html.fx): the marker travels from the entry`);
  await pg.evaluate(() => document.documentElement.classList.remove('fx'));
  // privacy
  await pg.evaluate(() => document.documentElement.classList.add('priv')); ok(/blur/.test(await pg.locator('.pcard .amt').first().evaluate((e) => getComputedStyle(e).filter)), `${width}: privacy hides rupee P&L`);
  await pg.evaluate(() => document.documentElement.classList.remove('priv'));
  if (shots) await pg.screenshot({ path: `${shots}/after-book-${width}.png`, fullPage: false });

  /* ---- the Record ---- */
  await pg.goto(`${base}/#/signals?v=record`); await pg.waitForSelector('[data-record]', { timeout: 20000 }); await pg.waitForTimeout(300);
  const rt = await pg.locator('[data-record]').innerText();
  ok(await pg.locator('h1').count() === 1, `${width}: one h1 on the Record`);
  ok(await noOverflow(pg), `${width}: the Record does not scroll sideways`);
  // 11 Nov 2026: one headline (closed of 30 and total R) replaces the three stat tiles that repeated both; the win rate is withheld in words, never a zero
  const hl = await pg.locator('[data-record-headline]').innerText();
  ok(/^3\s*of 30 closed/.test(hl.trim()) && /\+1\.70R/.test(hl), `${width}: one headline: closed = the ledger's count, once (3 of 30), and total R (${hl.replace(/\s+/g, ' ')})`);
  ok(/Too few to judge/.test(rt) && /win rate and average R withheld until 30 close/.test(rt) && !/\d+% won/.test(rt), `${width}: win rate is withheld in words below 30 trades, never a zero`);
  ok(/Picks through/.test(rt) && /Outcomes through/.test(rt), `${width}: the Record shows picks-through and outcomes-through`);
  ok(await pg.locator('[data-record] .pcard').count() === 3, `${width}: each closed trade appears once, as a row`);
  ok(/Signals gate/.test(rt) && await pg.locator('[data-sec="gate"] .ds-gatecard').count() === 1, `${width}: the Signals gate is a labelled section inside the Record`);
  ok(/One R\./.test(rt) && /One T2\./.test(rt), `${width}: one R and one T2 definition, stated once`);
  ok(!/Nothing has closed yet/.test(rt), `${width}: no empty state when trades have closed`);
  ok(await pg.locator('[data-record-attr] .rb').count() === 3, `${width}: one R bar per closed trade`);
  ok(await pg.locator('#evidence').count() === 1 && /Evidence and method/.test(rt), `${width}: the evidence and method are a section of the Record`);
  // the closed rows (moved here from the Auto view on 11 Nov 2026: a closed position is listed once, in the Record)
  const a = pg.locator('.pcard[data-pos="' + A.id + '"]');
  const atext = await a.innerText();
  ok(/Closed/.test(atext) && /AAA/.test(atext), `${width}: row names the symbol and its state`);
  ok(await a.locator('.tl-tick').count() === 4, `${width}: the ladder draws stop, entry, T1 and T2`);
  ok(await a.locator('.tl-tick.hit').count() === 2, `${width}: both hit targets are filled`);
  ok(/30 Oct/.test(await a.locator('.tl-tick.t1').innerText()) && /½ booked at T1 · 30 Oct/.test(atext), `${width}: T1 carries its date and says half was booked`);
  ok(new RegExp(`Rest sold at T2 · ${last.slice(8).replace(/^0/, '')} `).test(atext) || /Rest sold at T2/.test(atext), `${width}: T2 says the rest was sold`);
  ok(await a.locator('.tl-marker.exit').count() === 1, `${width}: a closed position is drawn completed, the marker at its exit`);
  const lab = await a.locator('.tl-vis').getAttribute('aria-label'); ok(/Stop ₹95\.00 raised to ₹100\.10, entry ₹100\.10, T1 ₹107\.75 hit 30 Oct, T2 ₹115\.40 hit/.test(lab), `${width}: the levels are the booked ones, to the paisa (${lab.slice(0, 90)})`);
  ok(/Held 4 sessions/.test(atext), `${width}: the closed row says how long it was held`);
  await a.locator('.pc-head').click(); const timeline = await a.locator('[data-position-time]').innerText();
  ok(/Entry date/.test(timeline) && /29 Oct/.test(timeline) && /Exit date/.test(timeline) && /Sessions held · final\s+4/.test(timeline), `${width}: an opened closed row shows entry, exit and final observed holding count`);
  const bt = await pg.locator('.pcard[data-pos="' + B.id + '"]').innerText(); ok(/Stop raised to the fill/.test(bt), `${width}: after T1 the stop's move to the fill is stated`);
  ok(await pg.locator('.pcard[data-pos="' + B.id + '"] .tl-ratchet').count() === 1, `${width}: and drawn`);
  const ct = pg.locator('.pcard[data-pos="' + C.id + '"]');
  if (await ct.count()) { const t = await ct.innerText(); ok(/Reference only — predates target tracking/.test(t), `${width}: a pre-27-Oct position says in words that its targets are reference only`); ok(await ct.locator('.tl-tick.hit').count() === 0, `${width}: and claims no target`); }
  if (shots) await pg.screenshot({ path: `${shots}/after-record-${width}.png`, fullPage: false });
  await ctx.close();
}

// An open recorded state keeps its observed count when fresh history is missing.
{
  const led = { ...ledger, picks: [D], outcomes: { [D.id]: { ...outcomes[D.id], sessions: 4 } } };
  const ctx = await open(390, led); const pg = await ctx.newPage();
  await ctx.route('**/api/bars*', (r) => r.fulfill({ status: 503, body: 'unavailable' }));
  await pg.goto(`${base}/#/signals?v=auto`); await pg.waitForSelector('.pc-head'); await pg.locator('.pc-head').first().click(); await pg.waitForSelector('[data-position-time]');   // 11 Nov 2026: the timeline opens with the row
  const t = await pg.locator('[data-position-time]').first().innerText();
  ok(/29 Oct/.test(t) && /Sessions held · recorded\s+4/.test(t), 'open card retains four observed sessions and entry date when prices are unavailable');
  ok(!/Exit date/.test(t), 'an open position is never presented with an exit date');
  await ctx.close();
}
// an empty record is honest
{
  const empty = { ...ledger, picks: [D], outcomes: { [D.id]: outcomes[D.id] } }; const ctx = await open(390, empty); const pg = await ctx.newPage();
  await pg.goto(`${base}/#/signals?v=record`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-record]', { timeout: 20000 });
  ok(/Nothing has closed yet — the first positions are still open\./.test(await pg.locator('[data-record]').innerText()), 'empty record: says plainly that nothing has closed yet');
  const hl0 = await pg.locator('[data-record-headline]').innerText(); ok(/^0\s*of 30 closed/.test(hl0.trim()) && !/R/.test(hl0) && !/\+0\.00R/.test(await pg.locator('[data-record]').innerText()), 'empty record: closed is a measured 0, and no total R is printed rather than +0.00R');   // 11 Nov 2026: one headline replaces the stat tiles
  await ctx.close();
}
// outcomes trailing picks are named
{
  const lag = { ...ledger, outcomes: Object.fromEntries(Object.entries(outcomes).map(([k, v]) => [k, { ...v, markDay: '2026-10-28' }])) }; const ctx = await open(390, lag); const pg = await ctx.newPage();
  await pg.goto(`${base}/#/signals?v=auto`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-through]', { timeout: 20000 });
  ok(/Outcomes trail the picks by \d+ session/.test(await pg.locator('[data-through]').innerText()), 'outcomes behind picks: the Book says so in words');
  await ctx.close();
}
// 11 Nov 2026: sessions with no recorded night are named in words on the Record (4 and 5 Nov 2026), and the old ?v=evidence address opens the Record at its evidence
{
  const gap = { ...ledger, days: ['2026-11-02', '2026-11-03', '2026-11-06', '2026-11-09'].map((asOf) => ({ asOf, recorded: 'x', engines: { MOM: { eligible: 700, passed: 0, picked: 0, skippedWideStop: 0 } } })) };   // a fixed stretch with the record's real gap (no night for 4 and 5 Nov 2026)
  const ctx = await open(390, gap); const pg = await ctx.newPage();
  await pg.goto(`${base}/#/signals?v=record`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-record]', { timeout: 20000 });
  const g = await pg.locator('[data-missing-nights]').innerText().catch(() => '');
  ok(/Wed 4 Nov and Thu 5 Nov 2026: not recorded/.test(g) && /nothing was filled in/.test(g), `missing nights: named in words (${g.slice(0, 120)})`);
  await pg.goto(`${base}/#/signals?v=evidence`); await pg.waitForSelector('#evidence details[open]', { timeout: 20000 });
  ok(await pg.getByRole('tab', { name: 'Record' }).getAttribute('aria-selected') === 'true', 'the old ?v=evidence address opens Record with its evidence section open');
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} FAILED` : 'book: all passed'); process.exit(bad ? 1 : 0);
