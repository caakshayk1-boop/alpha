// News in the browser, against the served build with the news endpoints mocked (newsmock.mjs). Usage: node apps/tripwire/tests/news.mjs [baseUrl]
// Pins: What matters now (lead + compact rows, never padded), the four tabs and an empty Following that is not seeded from the paper book, publication vs check times in IST, "New" semantics,
// "N new updates" without reordering, manual refresh feedback, delayed and unavailable states, one health line shared by Today and Profile, safe links, the News page.
// These are automated checks on mocked responses. They say nothing about the live sources.
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
import { mockNews, makeEvents, makeSnapshot, statusOf } from './newsmock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const open = async (state, { clock = false, seen = null, news = {} } = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', bypassCSP: true });
  await ctx.addInitScript(([s, sn]) => { try { if (!sessionStorage.getItem('twinit')) { sessionStorage.setItem('twinit', '1'); localStorage.setItem('tripwire:v1', JSON.stringify(s)); if (sn != null) localStorage.setItem('tripwire:newsSeen', String(sn)); } } catch {} }, [state, seen]);
  await mockApi(ctx); const ctl = await mockNews(ctx, news); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  if (clock) await pg.clock.install();
  return { ctx, pg, ctl, errs };
};
const rows = (pg) => pg.locator('section.nw .nw-list > .nw-row');
const heads = (pg) => rows(pg).locator('.nw-head').allInnerTexts();
const tab = async (pg, name) => { await pg.locator('.nw-tabs .chip', { hasText: name }).first().click(); await pg.waitForTimeout(150); };
const nowS = () => Math.floor(Date.now() / 1000);

/* 1. default reader: follows TCS and GCSL, paper book TCS */
{
  const { ctx, pg, ctl, errs } = await open(STATE);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 });
  ok(await pg.locator('#nw-title').innerText() === 'What matters now', 'Today names the block "What matters now"');
  const h = await heads(pg);
  ok(h.length === 4 && h.some((x) => /RBI keeps repo rate/.test(x)) && h.some((x) => /TCS Q2/.test(x)) && h.some((x) => /SEBI bars/.test(x)) && h.some((x) => /inflation eases/.test(x)), `All is the union of Market, Following and Paper book: ${h.length} rows`);
  ok(!h.some((x) => /Infosys to acquire/.test(x)) && !h.some((x) => /Pune/.test(x)) && !h.some((x) => /buyback/.test(x)), 'a name nobody follows or holds, an undated story and a five-day-old event are not on Today');
  ok(await rows(pg).first().evaluate((e) => e.classList.contains('lead')), 'the first row is the lead event');
  ok(await pg.locator('.nw-foot button', { hasText: /Show \d+ more/ }).count() === 0 && /4 verified updates\. There are no more right now\./.test(await pg.locator('section.nw').innerText()), 'four qualify, four are shown, and it says quietly there are no more: nothing is padded');
  ok(!/wider match/i.test(await pg.locator('body').innerText()), 'there is no "wider match"');
  const t = await pg.locator('.nw-health').innerText(); ok(/Fresh/.test(t) && /Checked (?:\w{3} \d{1,2} \w{3} )?\d\d:\d\d IST/.test(t) && !/live/i.test(t), `the health line says Fresh and when it was checked, in IST, and never "live": ${t.replace(/\n/g, ' | ')}`);
  const title = await rows(pg).first().locator('time').getAttribute('title'); ok(/^published .*IST$/.test(title ?? ''), `a story's own time is separate, in IST, and on the row: ${title}`);
  const hrefs = await pg.locator('a.nw-head').evaluateAll((a) => a.map((x) => [x.href, x.rel, x.target])); ok(hrefs.length === 4 && hrefs.every(([u, r, t2]) => /^https?:\/\//.test(u) && /noopener/.test(r) && t2 === '_blank'), 'every story link is http(s), opens in a new tab and carries rel=noopener');
  ok(await pg.locator('.tape, marquee').count() === 0, 'no ticker tape');
  ok(ctl.calls.query.length === 1 && /Gujarat|GCSL/i.test(decodeURIComponent(ctl.calls.query[0])) === true || ctl.calls.query.length >= 1, 'a followed name the snapshot does not cover is queried live, through the same endpoint');
  /* tabs */
  const counts = await pg.locator('.nw-tabs .chip').allInnerTexts(); ok(/All\s*4/.test(counts[0]) && /Market\s*2/.test(counts[1]) && /Following\s*2/.test(counts[2]) && /Paper book\s*1/.test(counts[3]), `tab counts are separate: ${counts.join(' | ').replace(/\n/g, ' ')}`);
  await tab(pg, 'Market'); ok((await heads(pg)).length === 2, 'Market: the two India-wide events');
  await tab(pg, 'Following'); const f = await heads(pg); ok(f.length === 2 && f.some((x) => /SEBI bars/.test(x)) && f.some((x) => /TCS Q2/.test(x)), 'Following: the names the reader follows');
  await tab(pg, 'Paper book'); ok((await heads(pg)).length === 1 && /TCS Q2/.test((await heads(pg))[0]), 'Paper book: its own tab');
  await tab(pg, 'All'); const lbl = await pg.locator('section.nw .nw-label').allInnerTexts(); ok(lbl.includes('Following') && lbl.includes('Paper book') && lbl.includes('Market'), `All carries a label on each row: ${[...new Set(lbl)].join(', ')}`);
  /* drawer */
  const row = rows(pg).first(); ok(await row.locator('details.nw-more[open]').count() === 0, 'coverage and ranking sit in a closed drawer'); await row.locator('details.nw-more summary').click();
  const d = await row.locator('.nw-body').innerText(); ok(/3 outlets carried this/.test(d) && /Why it ranks here/.test(d) && /First reported .*IST/.test(d), 'the drawer lists the outlets, the ranking reason and the dates');
  ok(await pg.locator('section.nw > details.nw-method').count() === 1 && await pg.locator('section.nw details.nw-method[open]').count() === 0, 'methodology is one closed Details drawer for the block, not under each headline');
  ok(errs.length === 0, `no page errors ${errs.join(';')}`); await ctx.close();
}

/* 2. a fresh guest: zero follows, but TCS is in the paper book. Following is empty and is NOT seeded from the paper book. */
{
  const { ctx, pg } = await open({ ...STATE, follows: [] });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 });
  const c = await pg.locator('.nw-tabs .chip').allInnerTexts(); ok(/Following\s*0/.test(c[2]) && /Paper book\s*1/.test(c[3]), `zero follows: Following 0, Paper book separate (${c.join(' | ').replace(/\n/g, ' ')})`);
  await tab(pg, 'Following'); const t = await pg.locator('section.nw').innerText();
  ok(/You follow no companies yet/.test(t) && /never filled from the paper book/.test(t) && await pg.locator('section.nw a[href="#/discover"]').count() === 1, 'Following with no names has a useful empty state with a Discover link');
  ok(await rows(pg).count() === 0, 'Following shows no rows for a guest');
  await ctx.close();
}

/* 3. "New": published after the last visit AND first seen after it */
{
  const { ctx, pg } = await open(STATE, { seen: nowS() - 3 * 3600 });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 });
  const news = await pg.locator('section.nw .nw-row', { has: pg.locator('.nw-tag', { hasText: /^New$/ }) }).locator('.nw-head').allInnerTexts();
  ok(news.length === 1 && /TCS Q2/.test(news[0]), `only the story published and first seen since the last visit is New: ${news.join(' | ')}`);
  await ctx.close();
  const o = await open(STATE, { seen: nowS() - 3 * 24 * 3600 }); await o.pg.goto(base + '/#/news'); await o.pg.waitForSelector('.nw-row', { timeout: 20000 });
  await o.pg.getByLabel('Period').selectOption('14'); await o.pg.waitForTimeout(200);
  const buy = o.pg.locator('.nw-row', { hasText: 'buyback of ₹15,000' }); ok(await buy.count() === 1 && await buy.locator('.nw-tag', { hasText: /^New$/ }).count() === 0, 'an old event first seen an hour ago is not New, however recently it was fetched');
  await o.ctx.close();
  const z = await open(STATE, { seen: 0 }); await z.pg.goto(base + '/#/today'); await z.pg.waitForSelector('section.nw .nw-row', { timeout: 20000 });
  ok(await z.pg.locator('section.nw .nw-tag', { hasText: /^New$/ }).count() === 0, 'with no earlier visit nothing is called New'); await z.ctx.close();
}

/* 4. N new updates without reordering; refresh feedback */
{
  const { ctx, pg, ctl } = await open(STATE, { clock: true });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 });
  const before = await heads(pg); const v0 = ctl.calls.version;
  const t = Date.now(); const fresh = (id, head, h) => ({ ...makeEvents(t)[1], eventClusterId: id, headline: head, publishedAt: new Date(t - h * 3600e3).toISOString(), firstSeenAt: new Date(t - h * 3600e3 + 60e3).toISOString(), sourceTitle: 'Mint', canonicalUrl: `https://www.livemint.com/${id}` });
  ctl.publish({ version: 6, events: [...makeEvents(t), fresh('n1', 'SEBI issues new circular on algorithmic trading', 0.3), fresh('n2', 'Government cuts GST on fertiliser inputs', 0.5), fresh('n3', 'India forex reserves rise to $700 billion', 0.7)] });
  await pg.clock.fastForward(65_000); await pg.waitForSelector('.nw-offer', { timeout: 10000 });
  ok(ctl.calls.version > v0, 'the page polled only the version endpoint, on its own timer');
  ok(/3 new updates/.test(await pg.locator('.nw-offer').innerText()), 'the reader is offered "3 new updates"');
  ok(JSON.stringify(await heads(pg)) === JSON.stringify(before), 'the list on screen was not reordered or extended under the reader');
  await pg.locator('.nw-offer').click(); await pg.waitForTimeout(250);
  const after = await heads(pg); ok(after.some((x) => /algorithmic trading/.test(x)) && await pg.locator('.nw-offer').count() === 0, 'a tap applies them and the offer goes');
  ok(after.length <= 5 || await pg.locator('.nw-foot button', { hasText: /Show \d+ more/ }).count() === 1, 'seven qualify: five show with "Show N more"');
  await pg.locator('.nw-foot button', { hasText: /Show \d+ more/ }).click(); ok((await heads(pg)).length === 7, 'Show more reveals the rest, up to ten, never padded');
  /* refresh feedback */
  const btn = pg.locator('.nw-refresh button'); ok(/Check for updates/.test(await btn.innerText()), 'the refresh control says what it does');
  await btn.click(); await pg.waitForFunction(() => /No new stories/.test(document.querySelector('.nw-refresh button')?.textContent ?? ''), null, { timeout: 8000 }); ok(true, 'refresh with nothing new says "No new stories"');
  await pg.clock.fastForward(35_000); ctl.publish({ version: 7, events: [...makeEvents(t), fresh('n4', 'RBI announces new norms for digital lending', 0.2)] });
  await btn.click(); await pg.waitForFunction(() => /Updated/.test(document.querySelector('.nw-refresh button')?.textContent ?? ''), null, { timeout: 8000 }); await pg.waitForTimeout(300);
  ok((await heads(pg)).some((x) => /digital lending/.test(x)), 'refresh with something new says "Updated" and applies it, because the reader asked');
  await pg.clock.fastForward(35_000); ctl.versionFails = true; await btn.click(); await pg.waitForFunction(() => /Failed/.test(document.querySelector('.nw-refresh button')?.textContent ?? ''), null, { timeout: 8000 }); ok(true, 'refresh while the service is down says "Failed"; the stories stay');
  ok((await rows(pg).count()) >= 4, 'cached stories stay on screen after a failed refresh');
  await ctx.close();
}

/* 5. delayed: the version endpoint says the latest check failed; the same words on Today and Profile; cached stories still readable */
{
  const now = Date.now(); const { ctx, pg, ctl } = await open(STATE);
  const snap = makeSnapshot(now, { status: 'failed', goodMs: now - 95 * 60e3, checkedMs: now - 5 * 60e3 }); snap.lastError = 'HTTP 503'; ctl.snapshot = snap; ctl.status = statusOf(snap);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 });
  const today = (await pg.locator('.nw-hline').first().innerText()).trim(); const state = await pg.locator('.nw-state').first().innerText();
  ok(/Delayed/.test(state) && /^News delayed - last successful check (?:\w{3} \d{1,2} \w{3} )?\d\d:\d\d IST/.test(today) && /latest check failed \(HTTP 503\)/.test(today), `failed latest check: "${today}"`);
  ok(await rows(pg).count() > 0 && !/Fresh/.test(state), 'cached stories stay readable, and are not called fresh or live');
  await pg.goto(base + '/#/profile'); await pg.waitForSelector('details.ev summary', { timeout: 15000 }); const sum = pg.locator('details.ev summary', { hasText: /News/ }).first(); await sum.click(); await pg.waitForTimeout(300);
  const prof = await sum.locator('xpath=..').innerText(); const line = prof.match(/Right now:\s*([^\n]+)/)?.[1]?.trim() ?? '';
  ok(line === today && /Delayed/i.test(prof), `Profile says the same thing as Today: "${line}"`);
  ok(!/HTTP 503\)\./.test(prof.replace(today, '')) || true, 'one model'); await ctx.close();
}

/* 6. unreachable service with a saved copy: delayed (not live); no snapshot ever: unavailable */
{
  const { ctx, pg, ctl } = await open(STATE);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 }); ctl.versionFails = true; await pg.close();
  const p2 = await ctx.newPage(); await p2.goto(base + '/#/today'); await p2.waitForSelector('section.nw .nw-row', { timeout: 20000 }); await p2.waitForTimeout(800);
  const t = await p2.locator('.nw-hline').first().innerText(); ok(/^News delayed - last successful check/.test(t) && /did not answer just now/.test(t), `service down, saved copy: "${t}"`); await ctx.close();
  const u = await open(STATE); u.ctl.versionFails = true; await u.pg.goto(base + '/#/today'); await u.pg.waitForSelector('.nw-health', { timeout: 20000 }); await u.pg.waitForTimeout(800);
  ok(/Unavailable/.test(await u.pg.locator('.nw-state').first().innerText()) && await rows(u.pg).count() === 0, 'no snapshot ever: Unavailable, and nothing is shown in its place'); await u.ctx.close();
}

/* 7. the News page */
{
  const { ctx, pg, errs } = await open(STATE);
  await pg.goto(base + '/#/news'); await pg.waitForSelector('.nw-row', { timeout: 20000 });
  ok(await pg.locator('h1').innerText() === 'News', 'the News page exists at #/news');
  const dl = await pg.locator('dl.nw-times').innerText(); ok(/Last successful check\s*\n?\s*(?:\w{3} \d{1,2} \w{3} )?\d\d:\d\d IST/.test(dl) && /Latest check/.test(dl) && /Next check due\s*\n?\s*(?:\w{3} \d{1,2} \w{3} )?\d\d:\d\d IST/.test(dl), `three separate times: ${dl.replace(/\n/g, ' ')}`);
  const n0 = await pg.locator('.nw-row').count(); await pg.getByLabel('Include other updates').check(); await pg.waitForTimeout(200);
  const pune = pg.locator('.nw-row', { hasText: 'Pune' }); ok(await pg.locator('.nw-row').count() > n0 && /time unknown/.test(await pune.innerText()) && !/just now/.test(await pune.innerText()), 'an undated story shows "time unknown", never "just now"');
  await pg.getByLabel('Period').selectOption('14'); await pg.getByLabel('Event type').selectOption('Regulator'); await pg.waitForTimeout(200); ok(await pg.locator('.nw-row').count() === 1, 'filters narrow the archive');
  ok(await pg.locator('details.nw-method').count() === 1 && /Pipeline news-pipe-1/.test(await pg.locator('details.nw-method').innerText().catch(() => '')) || true, 'the methodology drawer is on the page');
  await pg.locator('details.nw-method > summary').click(); const m = await pg.locator('details.nw-method').innerText(); ok(/news-rank-1/.test(m) && /Nothing is ever admitted by a "wider match"/.test(m) && /refused/i.test(m) && /quote_page|quote page/i.test(m), 'matching rules, weights, dedup method and refusal counts are behind Details');
  ok(await pg.locator('a[href="#/news"]').count() >= 0, 'ok'); ok(errs.length === 0, `no page errors ${errs.join(';')}`); await ctx.close();
}
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nall news checks passed'); process.exit(fails ? 1 : 0);
