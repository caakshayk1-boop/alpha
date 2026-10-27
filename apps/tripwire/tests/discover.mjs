// Discover, end to end on the served build: state in the URL, Back/Forward/reload/deep links, one pipeline for two views, parity of compare and follow, the basis rule,
// keyboard funnels, 44 px targets, validation, unknown figures and no sideways overflow at six widths.
// Usage: node apps/tripwire/tests/discover.mjs [baseUrl]   (the real built screen is used; only the live feed and the RSI sheet are mocked)
import { chromium } from 'playwright';
import { STATE, mockApi, quoteOf } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
async function mk(w = 1280, h = 900, stock) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch { /* none */ } }, STATE);
  const T = await mockApi(ctx); if (stock !== undefined) T.stock = stock;
  await ctx.route('**/api/rsi*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, schema: 'tripwire-rsi/1', as_of: '2026-10-23', order: ['daily', 'weekly', 'monthly'], rows: { TCS: [55, 61, 66], INFY: [48, 52, null], RELIANCE: [50, 45, 40] } }) }));
  return { ctx, T, pg: await ctx.newPage() };
}
const ready = async (pg) => { await pg.waitForFunction(() => !document.querySelector('.routewait') && /of [\d,]+ compan/.test(document.querySelector('[data-testid=count]')?.textContent ?? ''), null, { timeout: 20000 }); await pg.waitForTimeout(250); };
const count = async (pg) => { const t = await pg.locator('[data-testid=count]').innerText(); const m = t.match(/^([\d,]+) of ([\d,]+)/); return m ? Number(m[1].replace(/,/g, '')) : -1; };
const symsOf = (pg) => pg.locator('[data-sym]').evaluateAll((e) => e.map((x) => x.getAttribute('data-sym')));
const adv = async (pg) => { if (!(await pg.locator('details.adv').evaluate((d) => d.open))) await pg.locator('.adv summary').click(); };
const open = async (pg, hash) => { await pg.goto(base + '/'); await pg.goto(base + '/#/discover' + hash); await pg.reload(); await ready(pg); };
const hashQ = (pg) => pg.evaluate(() => location.hash);

/* ---- 1. the owner's reproduction: Uptrend, Table, RSI range, sort by symbol, search one name, open it, Back ---- */
{ const { ctx, pg } = await mk(); await open(pg, '');
  const total = await count(pg); ok(total > 500, `the default screen lists the whole universe (${total})`);
  await adv(pg); await pg.getByRole('button', { name: 'Uptrend', exact: true }).click(); await pg.waitForTimeout(300); const up = await count(pg); ok(up > 0 && up < total, `Uptrend narrows it (${up})`);
  await pg.getByRole('radio', { name: 'Table' }).click(); await pg.waitForSelector('.stbl'); ok((await count(pg)) === up, 'switching to the table keeps the count');
  await pg.getByRole('button', { name: 'Filter RSI (14)', exact: true }).click(); await pg.waitForSelector('[role=dialog]');
  ok((await pg.locator('#c-v').inputValue()) !== '' && (await pg.locator('#c-v2').inputValue()) !== '', 'the number boxes hold the figures in force, not an empty box with a hint behind it');
  await pg.locator('#c-v').fill('30'); await pg.locator('#c-v2').fill('56'); await pg.getByRole('button', { name: 'Add', exact: true }).click(); await pg.waitForTimeout(400);
  const n2 = await count(pg); ok(n2 > 0 && n2 < up, `RSI 30 to 56 narrows it further (${n2})`);
  await pg.locator('#d-sort').selectOption('sym'); await pg.waitForTimeout(300); const first = (await symsOf(pg))[0];
  await pg.getByLabel('Search companies').fill(first); await pg.waitForTimeout(500); ok((await count(pg)) >= 1, `search finds ${first}`); const n3 = await count(pg);
  await pg.waitForTimeout(400); const url1 = await hashQ(pg); ok(/view=table/.test(url1) && /sort=sym\.asc/.test(url1) && /c=rsi:ge:30/.test(url1) && /trend=up/.test(url1) && new RegExp(`q=${first}`).test(url1), `the address carries the whole screen (${url1})`);
  await pg.locator(`tr[data-sym="${first}"] a.symlink`).click(); await pg.waitForSelector('text=/Price|Trend|Decision/ >> visible=true', { timeout: 15000 }); ok(/#\/c\//.test(await hashQ(pg)), 'the company page opens');
  await pg.goBack(); await ready(pg);
  ok((await pg.locator('.stbl').count()) === 1 && (await pg.getByRole('radio', { name: 'Table' }).getAttribute('aria-checked')) === 'true', 'Back: still the table');
  ok((await count(pg)) === n3 && (await pg.getByLabel('Search companies').inputValue()) === first, `Back: the search and the count are kept (${first}, ${n3})`);
  ok((await pg.locator('#d-sort').inputValue()) === 'sym', 'Back: the sort is kept');
  ok((await pg.locator('.dchips .chip', { hasText: 'Uptrend' }).count()) === 1 && (await pg.locator('.dchips .chip', { hasText: 'RSI ≥ 30' }).count()) === 1 && (await pg.locator('.dchips .chip', { hasText: 'RSI ≤ 56' }).count()) === 1, 'Back: the filters and conditions are kept');
  ok((await pg.locator(`tr.sel[data-sym="${first}"]`).count()) === 1 && (await pg.evaluate(() => document.activeElement?.closest('[data-sym]')?.getAttribute('data-sym'))) === first, 'Back: the company opened is marked and has focus');
  await pg.goForward(); await pg.waitForSelector('text=/Price|Trend|Decision/ >> visible=true', { timeout: 15000 }); ok(/#\/c\//.test(await hashQ(pg)), 'Forward: the company again'); await pg.goBack(); await ready(pg); ok((await count(pg)) === n3, 'Forward then Back: the same screen');
  await pg.reload(); await ready(pg); ok((await count(pg)) === n3 && (await pg.locator('.stbl').count()) === 1 && (await pg.locator('#d-sort').inputValue()) === 'sym', 'reload: the same screen');
  await ctx.close(); }

/* ---- 2. scroll, how many rows were revealed, and the company opened, come back; so does a tab round trip ---- */
{ const { ctx, pg } = await mk(); await open(pg, '');
  await pg.getByRole('button', { name: /^Show \d+ more$/ }).click(); await pg.getByRole('button', { name: /^Show \d+ more$/ }).click().catch(() => {}); await pg.waitForTimeout(300);
  const shown = await pg.locator('[data-sym]').count(); ok(shown >= 48, `rows are revealed a page at a time, and the status says how many (${shown}): ${await pg.locator('.more [role=status]').innerText()}`);
  const target = pg.locator('[data-sym]').nth(Math.min(40, shown - 1)); const sym = await target.getAttribute('data-sym'); await target.scrollIntoViewIfNeeded(); await pg.mouse.wheel(0, 150); await pg.waitForTimeout(400);
  const y0 = await pg.evaluate(() => Math.round(scrollY)); ok(y0 > 800, `scrolled well down (${y0}px)`);
  await target.locator('a').first().click(); await pg.waitForSelector('text=/Price|Trend|Decision/ >> visible=true', { timeout: 15000 }); ok((await pg.evaluate(() => scrollY)) < 50, 'the company page starts at the top');
  await pg.goBack(); await ready(pg); await pg.waitForTimeout(500); const y1 = await pg.evaluate(() => Math.round(scrollY));
  ok(Math.abs(y1 - y0) <= 6, `Back: the scroll position is restored (${y0} then ${y1})`); ok((await pg.locator('[data-sym]').count()) === shown, 'Back: the same rows are revealed'); ok((await pg.locator(`.li.sel[data-sym="${sym}"]`).count()) === 1, `Back: ${sym} is the marked row`);
  const q = await hashQ(pg); await pg.locator('nav.tabs a[href="#/today"]').click(); await pg.waitForSelector('[data-brief]'); await pg.locator('nav.tabs a[href="#/discover"]').click(); await ready(pg); await pg.waitForTimeout(500);
  ok((await hashQ(pg)) === q, `Today then the Discover tab: the last Discover screen is back (${q})`); ok(Math.abs((await pg.evaluate(() => scrollY)) - y1) <= 6, 'and the scroll with it');
  await ctx.close(); }

/* ---- 3. deep links, old and new ---- */
{ const { ctx, pg } = await mk(); await open(pg, '?view=table&sort=pe.asc&cols=value&trend=up&c=rsi:ge:30&c=rsi:le:60&cmp=TCS,INFY');
  ok((await pg.locator('.stbl').count()) === 1 && (await pg.locator('#d-sort').inputValue()) === 'pe' && (await pg.locator('.stbl th', { hasText: 'ROCE' }).count()) === 1, 'a new-style link: table, sort, column preset');
  ok((await pg.locator('.fab-row').innerText()).includes('Compare 2') && (await pg.locator('.dchips .chip', { hasText: 'RSI ≥ 30' }).count()) === 1, 'comparison picks and conditions arrive with the link');
  const pes = await pg.locator('.stbl tbody tr').evaluateAll((rs, ix) => rs.map((r) => r.children[ix]?.textContent ?? ''), 2 + 2);
  ok(pes.length > 3, 'rows are listed'); await open(pg, '?trend=up&rsi=35-50&tier=large'); ok((await pg.locator('.dchips .chip', { hasText: 'RSI ≥ 35' }).count()) === 1 && (await pg.locator('.dchips .chip', { hasText: 'RSI ≤ 50' }).count()) === 1, 'an old link (rsi=35-50) still works');
  await open(pg, '?trend=sideways&bogus=1&sector=Nope'); ok(/not understood/.test(await pg.locator('body').innerText()) && (await count(pg)) > 500, 'an invalid link is ignored, said so, and the rest of the page still opens');
  await ctx.close(); }

/* ---- 4. one pipeline: same count and same order in both views ---- */
{ const { ctx, pg } = await mk(); let allSame = true; const detail = [];
  for (const q of ['', '?trend=up', '?trend=up&sort=name.asc', '?sector=Financial%20Services&sort=roce_med.desc', '?quality=high&sort=pe.asc', '?value=cheap&momentum=strong&sort=from_high.desc', '?c=rsi:ge:30&c=rsi:le:56&sort=rsi.desc', '?q=bank&sort=sym.desc']) {
    await open(pg, `${q}${q ? '&' : '?'}n=1000`); const c1 = await count(pg); const l = await symsOf(pg); await pg.getByRole('radio', { name: 'Table' }).click(); await pg.waitForSelector('.stbl'); const c2 = await count(pg); const t = await symsOf(pg);
    const same = c1 === c2 && l.length === t.length && l.every((s, i) => s === t[i]) && l.length === c1; if (!same) { allSame = false; detail.push(q); }
  }
  ok(allSame, `list and table: identical count and ordered symbols for eight fixtures, every row revealed ${detail.join(' ')}`);
  await open(pg, '?trend=up'); const li = (await symsOf(pg)).slice(0, 12); await pg.getByRole('radio', { name: 'Table' }).click(); await pg.waitForSelector('.stbl'); const ta = (await symsOf(pg)).slice(0, 12);
  ok(li.join() === ta.join() && /Name, A to Z \(the default\)/.test(await pg.locator('[data-testid=count]').innerText()), `Name A to Z + Uptrend starts the same in both views (${li.slice(0, 4).join(', ')}), and the sort in force is stated`);
  await pg.locator('.stbl th[aria-sort]').first().waitFor(); await pg.getByRole('button', { name: /^PRICE/ }).click(); await pg.waitForTimeout(300); const ps = await pg.locator('.stbl th[aria-sort=descending], .stbl th[aria-sort=ascending]').count(); ok(ps === 1 && (await pg.locator('#d-sort').inputValue()) === 'price', 'a column heading sets the shared sort, and exactly one heading says aria-sort');
  await pg.getByRole('radio', { name: 'List' }).click(); await pg.waitForTimeout(300); ok((await pg.locator('#d-sort').inputValue()) === 'price' && /Price/.test(await pg.locator('[data-testid=count]').innerText()), 'back to the list: the sort has not moved');
  await open(pg, '?sort=name.asc&n=1000'); const all = await symsOf(pg); const lastSym = all[all.length - 1]; await open(pg, ''); ok((await pg.locator('[data-sym]').count()) === 24, 'the default screen draws 24 rows');
  await pg.getByLabel('Search companies').fill(lastSym); await pg.waitForTimeout(500); ok((await count(pg)) >= 1 && (await symsOf(pg)).includes(lastSym), `a search finds ${lastSym}, which is beyond the first page`);
  await ctx.close(); }

/* ---- 5. compare and follow are one state across the views ---- */
{ const { ctx, pg } = await mk(); await open(pg, '?trend=up'); const [a, c] = (await symsOf(pg));
  await pg.getByRole('button', { name: `Add to comparison: ${a}` }).click(); await pg.getByRole('button', { name: `Add to comparison: ${c}` }).click();
  await pg.getByRole('radio', { name: 'Table' }).click(); await pg.waitForSelector('.stbl');
  ok((await pg.getByRole('button', { name: `Remove from comparison: ${a}` }).count()) === 1 && (await pg.getByRole('button', { name: `Remove from comparison: ${c}` }).count()) === 1 && (await pg.locator('.fab-row').innerText()).includes('Compare 2'), 'the table shows the two picked in the list');
  await pg.locator(`[data-sym="${a}"]`).getByRole("button", { name: /^Follow / }).click(); await pg.getByRole('radio', { name: 'List' }).click(); await pg.waitForTimeout(300);
  ok((await pg.locator(`[data-sym="${a}"]`).getByRole("button", { name: /^Unfollow / }).count()) === 1, 'a follow made in the table shows in the list');
  const q = await hashQ(pg); ok(/cmp=/.test(q) && !/follow|note|plan|paper/i.test(q), 'picks are in the link; follows, notes and plans are not');
  await pg.locator(`[data-sym="${a}"] a`).first().click(); await pg.waitForSelector('text=/Price|Trend|Decision/ >> visible=true', { timeout: 15000 }); await pg.goBack(); await ready(pg); ok((await pg.getByRole('button', { name: `Remove from comparison: ${a}` }).count()) === 1, 'the picks survive a visit to a company');
  await ctx.close(); }

/* ---- 6. empty result and clear all ---- */
{ const { ctx, pg } = await mk(); await open(pg, ''); const total = await count(pg); await pg.getByLabel('Search companies').fill('zzzzqqq'); await pg.waitForTimeout(500);
  ok((await count(pg)) === 0 && (await pg.getByText('No company matches').count()) === 1, 'no match: a plain empty state'); await pg.getByRole('button', { name: 'Clear all filters' }).click(); await pg.waitForTimeout(400); ok((await count(pg)) === total && (await pg.getByLabel('Search companies').inputValue()) === '', 'Clear all brings every name back');
  ok((await pg.locator('[data-testid=count]').getAttribute('aria-live')) === 'polite' && (await pg.locator('[data-testid=count]').evaluate((e) => e.getAttribute('role') ?? e.closest('[role=status]')?.getAttribute('role'))) === 'status', 'the count is a status message');
  await open(pg, '?q=zzzzqqq'); ok(!/\b1 companies\b/.test(await pg.locator('body').innerText()), 'no "1 companies"'); await ctx.close(); }

/* ---- 7. a live quote never changes who is listed or in what order ---- */
{ const url = '?sort=from_high.desc&c=from_high:ge:-25&n=1000'; const none = await mk(1280, 900, () => null); await open(none.pg, url); const s0 = await symsOf(none.pg), c0 = await count(none.pg); await none.pg.getByRole('radio', { name: 'Table' }).click(); await none.pg.waitForSelector('.stbl'); const t0 = await symsOf(none.pg);
  const wild = await mk(1280, 900, (s) => { const prev = 100 + (s.length * 37) % 400; return quoteOf(prev, prev * (s.charCodeAt(0) % 2 ? 0.55 : 1.4), s.length); }); await open(wild.pg, url); await wild.pg.waitForSelector('.ldot', { timeout: 15000 }); await wild.pg.waitForTimeout(1500);
  const s1 = await symsOf(wild.pg), c1 = await count(wild.pg); ok(c0 === c1 && s0.length === s1.length && s0.every((s, i) => s === s1[i]), `wild live prices: the same ${c0} names in the same order as with none`);
  await wild.pg.getByRole('radio', { name: 'Table' }).click(); await wild.pg.waitForSelector('.stbl'); const t1 = await symsOf(wild.pg); ok(t0.join() === t1.join() && t1.join() === s1.join(), 'and the table agrees with the list');
  ok((await wild.pg.locator('.stbl .ldot').count()) > 3 && /marks a figure worked out at today's live price/.test(await wild.pg.locator('body').innerText()) && /close of \w{3} \d+ \w{3}/.test(await wild.pg.locator('.basis').innerText()), 'live cells are marked, and the basis is stated above the results with the close date');
  await wild.pg.getByRole('button', { name: /^Columns$/ }).click(); await wild.pg.getByRole('radio', { name: /Momentum/ }).check().catch(() => {}); await wild.pg.keyboard.press('Escape');
  ok((await wild.pg.locator('.stbl .atclose').count()) > 0 || (await wild.pg.locator('.atclose').count()) > 0, 'where a live figure differs from the close the filter used, the close is printed beside it');
  const lc = await wild.pg.locator('.stbl tbody tr').first().locator('td').nth(0).innerText(); void lc;
  await wild.pg.getByRole('radio', { name: 'List' }).click(); await wild.pg.waitForTimeout(300); ok((await wild.pg.locator('.li .ldot').count()) > 3, 'the list marks live cells the same way');
  await none.ctx.close(); await wild.ctx.close(); }

/* ---- 8. keyboard funnels, targets, the view switch, the sheet ---- */
{ const { ctx, pg } = await mk(); await open(pg, '?view=table'); const f = pg.getByRole('button', { name: 'Filter RSI (14)', exact: true });
  await f.focus(); await pg.keyboard.press('Enter'); await pg.waitForSelector('[role=dialog]'); ok(/Add a condition/.test(await pg.locator('[role=dialog]').innerText()), 'a funnel opens with Enter from the keyboard');
  ok((await pg.evaluate(() => document.activeElement?.closest('[role=dialog]') !== null)), 'focus is inside the sheet'); await pg.locator('#c-v').fill('30'); await pg.locator('#c-v2').fill('56'); await pg.keyboard.press('Tab'); await pg.getByRole('button', { name: 'Add', exact: true }).focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  ok((await f.getAttribute('aria-pressed')) === 'true', 'the funnel shows it is active'); await f.focus(); await pg.keyboard.press('Space'); await pg.waitForSelector('[role=dialog]'); ok(/Edit condition/.test(await pg.locator('[role=dialog]').innerText()) && (await pg.locator('#c-v').inputValue()) === '30', 'opened again it edits that figure instead of adding another'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  ok((await pg.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Filter RSI (14)', 'Escape closes the sheet and focus returns to the funnel');
  const small = await pg.locator('.stbl .thf, .stbl .sortb').evaluateAll((e) => e.filter((x) => { const r = x.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).length); ok(small === 0, 'every funnel and every sort button in the table header is at least 44 px square');
  const grp = pg.getByRole('radiogroup', { name: 'View' }); ok((await grp.getByRole('radio').count()) === 2, 'the view switch is a radio group of two'); await pg.getByRole('radio', { name: 'Table' }).focus(); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(200);
  ok((await pg.getByRole('radio', { name: 'List' }).getAttribute('aria-checked')) === 'true' && (await pg.locator('.stbl').count()) === 0, 'an arrow key moves the choice');
  await ctx.close();
  const m = await mk(390, 844); await open(m.pg, '?view=table'); const tiny = await m.pg.locator('.dtool button, .dtool select, .dtool input, .disc .icon-btn').evaluateAll((e) => e.filter((x) => { const r = x.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5); }).map((x) => x.getAttribute('aria-label') ?? x.textContent)); ok(tiny.length === 0, `the toolbar and row buttons are 44 px targets on a phone ${tiny.join(',')}`);
  await m.ctx.close(); }

/* ---- 9. conditions: numbers read strictly, nonsense blocked inline, unknown figures a choice ---- */
{ const { ctx, pg } = await mk(); await open(pg, ''); await pg.getByRole('button', { name: '+ Condition' }).click(); await pg.waitForSelector('[role=dialog]');
  const add = pg.getByRole('button', { name: 'Add', exact: true }); await pg.locator('#c-v').fill('abc'); ok(/not a number/.test(await pg.locator('#c-e1').innerText()) && (await add.isDisabled()), 'text in a number box is refused inline');
  await pg.locator('#c-v').fill('130'); ok(/0 to 100/.test(await pg.locator('#c-e1').innerText()) && (await add.isDisabled()), 'RSI 130 is refused inline'); await pg.locator('#c-v').fill(''); ok(/Enter a number/.test(await pg.locator('#c-e1').innerText()), 'an empty box is not zero');
  await pg.locator('#c-v').fill('60'); await pg.locator('#c-v2').fill('40'); ok(/above To/.test(await pg.locator('#c-e2').innerText()) && (await add.isDisabled()), 'From above To is refused inline');
  await pg.locator('#c-m').selectOption('rsi_w'); await pg.waitForTimeout(200); ok(/of [\d,]+ have it|nightly RSI sheet/.test(await pg.locator('[role=dialog]').innerText()), 'an unavailable-for-most figure says why, inline');
  await pg.locator('#c-v').fill('40'); await pg.locator('#c-v2').fill('70'); await pg.waitForTimeout(200); const hitsOff = Number((await pg.locator('[role=dialog] [role=status] b').innerText()).trim()); await pg.getByLabel(/Also include names with no figure/).check(); await pg.waitForTimeout(200); const hitsOn = Number((await pg.locator('[role=dialog] [role=status] b').innerText()).trim());
  ok(hitsOff >= 1 && hitsOn > hitsOff + 100, `include names with no figure is an explicit choice: ${hitsOff} without, ${hitsOn} with`); await add.click(); await pg.waitForTimeout(400);
  ok((await pg.locator('.dchips .chip', { hasText: 'or no figure' }).count()) === 2 && (await count(pg)) === hitsOn, 'the chips say "or no figure", and the count agrees with the sheet'); ok(/no figure for a filter|included although they have no figure/.test(await pg.locator('.dcount').innerText()), 'the page says how many were included without a figure');
  await open(pg, '?sector=Financial%20Services'); await pg.getByRole('button', { name: 'Filters · 1' }).click(); await pg.waitForSelector('[role=dialog]'); const roce = pg.locator('.figbtn', { hasText: 'ROCE, median' }); ok((await roce.getAttribute('aria-disabled')) === 'true' && /financial sector/.test(await roce.innerText()), 'a ratio the financial sector does not have is not offered under that sector');
  await ctx.close(); }

/* ---- 10. six widths, nothing pushes the page sideways ---- */
{ const bad = []; for (const w of [360, 390, 430, 768, 1024, 1440]) { const { ctx, pg } = await mk(w, w < 700 ? 800 : 900); for (const q of ['', '?view=table&trend=up&c=rsi:ge:30&c=rsi:le:56&cols=cash']) { await open(pg, q); await pg.waitForTimeout(300); const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (over > 1) bad.push(`${w}${q ? ' table' : ' list'}: ${over}px`); } await ctx.close(); }
  ok(bad.length === 0, `360, 390, 430, 768, 1024 and 1440: no horizontal page overflow ${bad.join('; ')}`); }

/* ---- 11. the stack above the first result ---- */
{ const { ctx, pg } = await mk(1280, 900); await open(pg, '?trend=up'); const y = await pg.evaluate(() => Math.round(document.querySelector('.list .li').getBoundingClientRect().top + scrollY)); ok(y < 400, `desktop: the first result starts ${y} px down (it was about 540 px)`); await ctx.close(); }

await b.close(); console.log(fails ? `\ndiscover: ${fails} failed` : '\ndiscover: all passed'); process.exit(fails ? 1 : 0);
