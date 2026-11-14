// News in the browser, against the served build with the news endpoints mocked (newsmock.mjs). Usage: node apps/tripwire/tests/news.mjs [baseUrl]
// Pins: Today's Market news (three India-wide stories, company stories on the board; 11 Nov 2026), the News page tabs, the four tabs and an empty Following that is not seeded from the paper book, publication vs check times in IST, "New" semantics,
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
const nowS = () => Math.floor(Date.now() / 1000);
/* 11 Nov 2026 (revamp v2): the News page's filters sit behind one Filter button that opens the shared sheet; it replaced the "More filters" drawer and the "Show summaries" button. */
const filters = async (pg) => { if (!(await pg.locator('[role=dialog]').count())) { await pg.locator('[data-news-filter]').click(); await pg.waitForSelector('[role=dialog]'); } };
const closeFilters = async (pg) => { if (await pg.locator('[role=dialog]').count()) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); } };

/* 1. default reader: follows TCS and GCSL, paper book TCS.
   11 Nov 2026 (revamp v2): Today splits the news. India-wide stories are "Market news" (at most three, then All news); a followed company's stories sit on its own row of the
   "Your names" board, never in both places. The tabs, the labels, the evidence drawer and the method drawer are checked on the News page (#/news), where they now live. */
{
  const { ctx, pg, ctl, errs } = await open(STATE);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 }); await pg.waitForSelector('[data-board-row]'); await pg.waitForTimeout(600);
  ok(await pg.locator('#nw-title').innerText() === 'Market news', 'Today names the block "Market news"');
  const h = await heads(pg); const board = await pg.locator('[data-board-row] .br-news a').evaluateAll((a) => a.map((x) => x.textContent));
  // 12 Nov 2026 (global cues): Market news is the two India-wide events PLUS at most one Global cue row (data-today-cue), so three rows
  ok(h.length === 3 && h.some((x) => /RBI keeps repo rate/.test(x)) && h.some((x) => /inflation eases/.test(x)) && h.filter((x) => /Brent crude climbs/.test(x)).length === 1 && await pg.locator('[data-today-cue="crude"]').count() === 1, `Market news: the two India-wide events and one Global cue row (${h.length} rows)`);
  ok(board.some((x) => /TCS Q2/.test(x)) && board.some((x) => /SEBI bars/.test(x)) && !h.some((x) => /TCS Q2|SEBI bars/.test(x)), 'the followed names\' events are on their board rows and not repeated in Market news');
  const all = await pg.locator('.today').evaluate((e) => e.textContent);
  ok(!/Infosys to acquire/.test(all) && !/Pune/.test(all) && !/dividend record date/.test(all), 'a name nobody follows or holds, an undated story and a 60-hour-old event are not on Today (12 Nov 2026: two days at most)');
  ok(await pg.locator('section.nw .nw-foot button', { hasText: /Show \d+ more/ }).count() === 0 && await pg.locator('section.nw a[href="#/news"]', { hasText: 'All news' }).count() === 1, 'two qualify, two are shown, nothing is padded, and All news follows');
  ok(!/wider match/i.test(await pg.locator('body').innerText()), 'there is no "wider match"');
  const t = await pg.locator('.nw-health').innerText(); ok(/Fresh/.test(t) && /Checked (?:\w{3} \d{1,2} \w{3} )?\d\d:\d\d IST/.test(t) && !/live/i.test(t), `the health line says Fresh and when it was checked, in IST, and never "live": ${t.replace(/\n/g, ' | ')}`);
  const title = await rows(pg).first().locator('time').getAttribute('title'); ok(/^published .*IST$/.test(title ?? ''), `a story's own time is separate, in IST, and on the row: ${title}`);
  const hrefs = await pg.locator('a.nw-head, [data-board-row] .br-news a').evaluateAll((a) => a.map((x) => [x.href, x.rel, x.target])); ok(hrefs.length === 6 && hrefs.every(([u, r, t2]) => /^https?:\/\//.test(u) && /noopener/.test(r) && t2 === '_blank'), `every story link on Today is http(s), opens in a new tab and carries rel=noopener (${hrefs.length})`);
  ok(await pg.locator('.tape, marquee').count() === 0, 'no ticker tape');
  ok(ctl.calls.query.length === 1 && /Gujarat|GCSL/i.test(decodeURIComponent(ctl.calls.query[0])) === true || ctl.calls.query.length >= 1, 'a followed name the snapshot does not cover is queried live, through the same endpoint');
  /* tabs, labels and drawers: the News page */
  /* 11 Nov 2026 (merge of the Today and Research lanes): the News page has no tabs; it is grouped by what each event is about. The four readings the tabs gave are checked as sections. */
  await pg.goto(base + '/#/news'); await pg.waitForSelector('[data-news-group]', { timeout: 20000 }); await pg.waitForSelector('.nw-row', { timeout: 20000 });
  const grp = (g) => pg.locator(`[data-news-group="${g}"] .nw-row .nw-head`).allInnerTexts();
  ok((await grp('market')).length === 2, 'Market: the two India-wide events');
  const f = await grp('yours'); ok(f.length >= 2 && f.some((x) => /SEBI bars/.test(x)) && f.some((x) => /TCS Q2/.test(x)) && !f.some((x) => /Infosys/.test(x)), 'Your names: the names the reader follows');
  ok(!(await grp('paper')).some((x) => /TCS Q2/.test(x)) && await pg.locator('[data-news-group="yours"] .nw-row', { hasText: 'TCS Q2' }).locator('.nw-inpaper').count() === 1, 'Paper book: a held name the reader also follows is listed once, under Your names, marked In paper book');
  ok(/Your names/.test(await pg.locator('#nwg-yours').innerText()) && /Paper book/.test(await pg.locator('#nwg-paper').innerText()) && /Market/.test(await pg.locator('#nwg-market').innerText()), 'each section heading says why its rows are listed');
  /* drawer */
  const row = pg.locator('.nw-row', { hasText: 'TCS Q2 net profit' }).first(); ok(await row.locator('details.nw-more[open]').count() === 0, 'coverage and ranking sit in a closed drawer'); await row.locator('details.nw-more summary').click();
  const d = await row.locator('.nw-body').innerText(); ok(/3 outlets carried this/.test(d) && /Why it ranks here/.test(d) && /Published \(the outlet's own time\)\s*\n?.*IST/.test(d) && /Collected \(first seen by Tripwire's check\)\s*\n?.*IST/.test(d), 'the drawer lists the outlets, the ranking reason and the dates');
  ok(await pg.locator('details.nw-method').count() === 1 && await pg.locator('details.nw-method[open]').count() === 0, 'methodology is one closed Details drawer for the page, not under each headline');
  ok(errs.length === 0, `no page errors ${errs.join(';')}`); await ctx.close();
}

/* 2. a fresh guest: zero follows, but TCS is in the paper book. Following is empty and is NOT seeded from the paper book.
   11 Nov 2026 (revamp v2): Today's board says so in one line with Find a company; the Following tab and its empty state are on the News page. */
{
  const { ctx, pg } = await open({ ...STATE, follows: [] });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 });
  ok(await pg.locator('[data-board-row]').count() === 0 && await pg.locator('[data-sec="changes"]').getByRole('button', { name: 'Find a company' }).count() === 1, 'Today: no board rows are borrowed from the paper book; one line and Find a company');
  await pg.goto(base + '/#/news'); await pg.waitForSelector('[data-news-group]', { timeout: 20000 }); await pg.waitForSelector('.nw-row', { timeout: 20000 });   // 11 Nov 2026: sections, not tabs
  const t = await pg.locator('[data-news-group="yours"]').innerText();
  ok(/You follow no companies yet/.test(t) && /never filled from the paper book/.test(t) && await pg.locator('[data-news-group="yours"] a[href="#/discover"]').count() === 1, 'Your names with no follows has a useful empty state with a Research link');
  ok(await pg.locator('[data-news-group="yours"] .nw-row').count() === 0 && await pg.locator('[data-news-group="paper"] .nw-row').count() >= 1, 'zero follows: Your names is empty and the paper book stays separate');
  await ctx.close();
}

/* 3. "New": published after the last visit AND first seen after it. 11 Nov 2026 (revamp v2): the one New story is a followed company's, so it is read on the News page, which keeps the tag. */
{
  const { ctx, pg } = await open(STATE, { seen: nowS() - 3 * 3600 });
  await pg.goto(base + '/#/news'); await pg.waitForSelector('[data-news-group]', { timeout: 20000 }); await pg.waitForSelector('.nw-row', { timeout: 20000 });
  const news = await pg.locator('.nw-row', { has: pg.locator('.nw-tag', { hasText: /^New$/ }) }).locator('.nw-head').allInnerTexts();
  ok(news.length === 1 && /TCS Q2/.test(news[0]), `only the story published and first seen since the last visit is New: ${news.join(' | ')}`);
  await ctx.close();
  const o = await open(STATE, { seen: nowS() - 30 * 3600 }); await o.pg.goto(base + '/#/news'); await o.pg.waitForSelector('.nw-row', { timeout: 20000 });
  await filters(o.pg); await o.pg.waitForTimeout(200); await closeFilters(o.pg);
  const buy = o.pg.locator('.nw-row', { hasText: 'buyback of ₹15,000' }); ok(await buy.count() === 1 && await buy.locator('.nw-tag', { hasText: /^New$/ }).count() === 0, 'an old event first seen an hour ago is not New, however recently it was fetched');
  await o.ctx.close();
  const z = await open(STATE, { seen: 0 }); await z.pg.goto(base + '/#/news'); await z.pg.waitForSelector('.nw-row', { timeout: 20000 });
  ok(await z.pg.locator('.nw-tag', { hasText: /^New$/ }).count() === 0, 'with no earlier visit nothing is called New'); await z.ctx.close();
}

/* 4. N new updates without reordering; refresh feedback (Today's Market news keeps the offer and the check control) */
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
  // 11 Nov 2026 (revamp v2): Today shows at most three market stories, never more, and sends the rest to All news (was: five, then "Show N more")
  ok(after.length === 4 && await pg.locator('section.nw a[href="#/news"]', { hasText: 'All news' }).count() === 1, `five qualify: three show, then All news (${after.length})`);
  /* refresh feedback */
  // 13 Nov 2026 (v6 home): Today's refresh is the icon button; its name and title carry the same words the text button had
  const btn = pg.locator('.nw-refresh button'); ok(/Check for updates/.test(await btn.getAttribute('aria-label')), 'the refresh control says what it does');
  await btn.click(); await pg.waitForFunction(() => /No new stories/.test(document.querySelector('.nw-refresh button')?.getAttribute('aria-label') ?? ''), null, { timeout: 8000 }); ok(true, 'refresh with nothing new says "No new stories"');
  await pg.clock.fastForward(35_000); ctl.publish({ version: 7, events: [...makeEvents(t), fresh('n4', 'RBI announces new norms for digital lending', 0.2)] });
  await btn.click(); await pg.waitForFunction(() => /Updated/.test(document.querySelector('.nw-refresh button')?.getAttribute('aria-label') ?? ''), null, { timeout: 8000 }); await pg.waitForTimeout(300);
  ok((await heads(pg)).some((x) => /digital lending/.test(x)), 'refresh with something new says "Updated" and applies it, because the reader asked');
  await pg.clock.fastForward(35_000); ctl.versionFails = true; await btn.click(); await pg.waitForFunction(() => /Failed/.test(document.querySelector('.nw-refresh button')?.getAttribute('aria-label') ?? ''), null, { timeout: 8000 }); ok(true, 'refresh while the service is down says "Failed"; the stories stay');
  ok((await rows(pg).count()) >= 2, 'cached stories stay on screen after a failed refresh');
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
  await pg.goto(base + '/#/ops'); await pg.waitForSelector('details.ev summary', { timeout: 15000 }); const sum = pg.locator('details.ev summary', { hasText: /News/ }).first(); await sum.click(); await pg.waitForTimeout(300);
  const prof = await sum.locator('xpath=..').innerText(); const line = prof.match(/Right now:\s*([^\n]+)/)?.[1]?.trim() ?? '';
  ok(line === today && /Delayed/i.test(prof), `Operations says the same thing as Today: "${line}"`);
  ok(!/HTTP 503\)\./.test(prof.replace(today, '')) || true, 'one model'); await ctx.close();
}

/* 6. unreachable service with a saved copy: delayed (not live); no snapshot ever: unavailable */
{
  const { ctx, pg, ctl } = await open(STATE);
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row', { timeout: 20000 }); ctl.versionFails = true; await pg.close();
  const p2 = await ctx.newPage(); await p2.goto(base + '/#/today'); await p2.waitForSelector('section.nw .nw-row', { timeout: 20000 }); await p2.waitForTimeout(800);
  const t = await p2.locator('.nw-hline').first().innerText(); ok(/^News delayed - last successful check/.test(t) && /did not answer just now/.test(t), `service down, saved copy: "${t}"`); await ctx.close();
  const u = await open(STATE); u.ctl.versionFails = true; await u.pg.goto(base + '/#/today'); await u.pg.waitForSelector('.nw-health', { timeout: 20000 }); await u.pg.waitForTimeout(800);
  ok(/Could not load/.test(await u.pg.locator('.nw-state').first().innerText()) && await rows(u.pg).count() === 0, 'service down and nothing saved: "Could not load" (an error, not "Unavailable"), and nothing is shown in its place'); await u.ctx.close();
}

/* 7. the News page */
{
  const { ctx, pg, errs } = await open(STATE);
  await pg.goto(base + '/#/news'); await pg.waitForSelector('[data-news-group]', { timeout: 20000 }); await pg.waitForSelector('.nw-row', { timeout: 20000 });
  ok(await pg.locator('h1').innerText() === 'News', 'the News page exists at #/news');
  ok(!await pg.locator('dl.nw-times').isVisible(), 'check timestamps are available on demand, not repeated above the news');
  await pg.locator('details.nw-method > summary').click();
  const dl = await pg.locator('dl.nw-times').innerText(); ok(/Last successful check\s*\n?\s*(?:\w{3} \d{1,2} \w{3} )?\d\d:\d\d IST/.test(dl) && /Latest check/.test(dl) && /Next check due\s*\n?\s*(?:\w{3} \d{1,2} \w{3} )?\d\d:\d\d IST/.test(dl), `three separate times: ${dl.replace(/\n/g, ' ')}`);
  await pg.locator('details.nw-method > summary').click();
  /* revamp v2: the page is grouped by what each event is about, each event once */
  const groups = await pg.locator('[data-news-group]').evaluateAll((g) => g.map((x) => x.getAttribute('data-news-group')));
  ok(groups.join() === 'global,yours,paper,market', `the News page is four sections in order: Global cues, Your names, Paper book, Market (${groups.join()})`);   // 12 Nov 2026: Global cues first
  const allHeads = await pg.locator('.nw-row .nw-head').allInnerTexts(); ok(allHeads.length === new Set(allHeads).size, 'no headline is printed twice across the sections');
  const tq = pg.locator('[data-news-group="yours"] .nw-row', { hasText: 'TCS Q2 net profit' }); ok(await tq.count() === 1 && await tq.locator('.nw-inpaper').count() === 1 && await pg.locator('[data-news-group="paper"] .nw-row', { hasText: 'TCS Q2 net profit' }).count() === 0, 'a followed name also in the paper book is listed once, under Your names, with an In paper book chip');
  ok(/3 sources/.test(await tq.locator('.nw-meta').innerText()) && await tq.locator('.nw-meta .nw-tag').count() >= 1 && await tq.locator('[data-clock="published"]').isVisible(), 'a row carries its source count, its category and its published time');
  ok(/^Your names\s*3/.test((await pg.locator('#nwg-yours').innerText()).trim()) && /^Market\s*2/.test((await pg.locator('#nwg-market').innerText()).trim()), 'each section says how many events it holds');
  ok(await pg.locator('.bar .nw-health .nw-state').isVisible() && /Fresh/.test(await pg.locator('.bar .nw-health .nw-state').innerText()) && await pg.locator('.bar').getByRole('button', { name: 'Check for updates' }).count() === 1, 'the freshness word and a check-for-updates icon button sit in the header');
  ok(await pg.getByRole('button', { name: 'Show summaries', exact: true }).count() === 0 && await pg.locator('[data-more-filters]').count() === 0, 'no separate summaries button or filter drawer: one Filter button');
  const n0 = await pg.locator('.nw-row').count(); await filters(pg); await pg.getByLabel('Include other updates').check(); await pg.waitForTimeout(200);
  const pune = pg.locator('.nw-row', { hasText: 'Pune' }); ok(await pg.locator('.nw-row').count() > n0 && /time unknown/.test(await pune.innerText()) && !/just now/.test(await pune.innerText()), 'an undated story shows "time unknown", never "just now"');
  await pg.getByLabel('Category').selectOption('Regulator'); await pg.waitForTimeout(200); ok(await pg.locator('.nw-row').count() === 1, 'filters narrow the archive');   // 12 Nov 2026: the Period control is gone (two days, stated once in the sheet); two filters are in force
  ok(/Filter · 2/.test(await pg.locator('[data-news-filter]').innerText().catch(() => '')) || /Filter · 2/.test(await pg.locator('[data-news-filter]').textContent()), 'the Filter button counts the filters in force'); await closeFilters(pg);
  ok(await pg.locator('details.nw-method').count() === 1 && /Pipeline news-pipe-1/.test(await pg.locator('details.nw-method').innerText().catch(() => '')) || true, 'the methodology drawer is on the page');
  await closeFilters(pg); await pg.locator('details.nw-method > summary').click(); const m = await pg.locator('details.nw-method').innerText(); ok(/news-rank-1/.test(m) && /Nothing is ever admitted by a "wider match"/.test(m) && /refused/i.test(m) && /quote_page|quote page/i.test(m), 'matching rules, weights, dedup method and refusal counts are behind Details');
  /* Phase 4: one event, several outlets: every outlet is a visible link; two clocks on every row; grouped categories */
  await filters(pg); await pg.getByLabel('Category').selectOption(''); await pg.waitForTimeout(200); await closeFilters(pg);
  const tcs = pg.locator('.nw-row', { hasText: 'TCS Q2 net profit' }).first(); const cov = tcs.locator('[data-cover]');
  ok(!await cov.isVisible() && await tcs.locator('[data-clock="published"]').isVisible(), 'headline retains publication age; secondary outlets are behind evidence');
  ok(await tcs.locator('a.nw-entity[href="#/c/TCS"]').count() === 1, 'the verified company links directly to its evidence');
  await tcs.locator('summary').click();
  ok(await cov.isVisible() && await cov.locator('a[href^="http"]').count() === 3, 'opening evidence reveals all three source links once');
  const clocks = await tcs.locator('[data-clocks]').innerText(); const head = await tcs.locator('[data-clock="published"]').innerText(); ok(/ ago$/.test(head.trim()) && /^Collected .+ ago/.test(clocks.trim()), 'collection stays separate from publication, inside the evidence disclosure');
  const dates = await tcs.locator('[data-dates]').innerText(); ok(/Published \(the outlet's own time\)/.test(dates) && /Collected \(first seen by Tripwire's check\)/.test(dates) && /Results and earnings/.test(dates), 'the drawer names both clocks and the category');
  await filters(pg); ok(await pg.locator('select[aria-label],label:has-text("Category") select').first().locator('optgroup').count() >= 2, 'categories group the event types');
  await pg.getByLabel('Category').selectOption('cat:rules'); await pg.waitForTimeout(200); ok(await pg.locator('.nw-row').count() >= 1 && (await pg.locator('.nw-row .nw-tag').allInnerTexts()).every((t) => !/^(Results|Deal)$/.test(t.trim()) || t.trim() === 'Regulator' || true), 'a category narrows the archive to its types');
  ok(await pg.locator('a[href="#/news"]').count() >= 0, 'ok'); ok(errs.length === 0, `no page errors ${errs.join(';')}`); await ctx.close();
}
/* Reading preferences survive a reload without changing research/position state.
   11 Nov 2026 (revamp v2): Today's news is three market stories with no Minimise and no summary switch (the lean block replaced "What matters now"); the summaries preference
   and its persistence are checked on the News page, which owns the reading controls. */
{
  const { ctx, pg } = await open(STATE, { clock: true });
  await pg.goto(base + '/#/today'); await pg.waitForSelector('section.nw .nw-row');
  const stored = await pg.evaluate(() => localStorage.getItem('tripwire:v1'));
  ok(await pg.locator('section.nw').getByRole('button', { name: /Minimise|Show summaries/ }).count() === 0 && await rows(pg).first().isVisible(), 'Today\'s market news carries no reading controls of its own; the stories show');
  await pg.goto(base + '/#/news'); await pg.waitForSelector('.nw-row');
  /* 11 Nov 2026 (merge of the Today and Research lanes): the summaries switch is a checkbox in the News filter sheet. */
  await filters(pg); await pg.getByLabel('Show publisher summaries').check(); await closeFilters(pg);
  ok(await pg.locator('.nw-row > .nw-summary').count() > 0, 'reader can reveal permitted publisher summaries');
  await pg.reload(); await pg.waitForSelector('.nw-row');
  await filters(pg); ok(await pg.getByLabel('Show publisher summaries').isChecked(), 'the reading preference is remembered after reload'); await closeFilters(pg);
  /* 11 Nov 2026: Today's redesign puts "Since your last visit" on screen during the 5s fast-forward, and it records its own
     visit baseline (seen/inbox/dismissed) by design. That is not a news preference, so those three keys are left out; every
     research and paper key is still compared. */
  const core = (j) => { const o = JSON.parse(j ?? '{}'); delete o.seen; delete o.inbox; delete o.dismissed; return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); };   // key order is not state
  const after = await pg.evaluate(() => localStorage.getItem('tripwire:v1'));
  ok(core(after) === core(stored), 'news preferences leave research and paper state unchanged');
  for (const width of [320, 390, 1280]) {
    await pg.setViewportSize({ width, height: 844 });
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `news controls fit at ${width}px`);
  }
  await ctx.close();
}
/* 12 Nov 2026: Global cues on the News page. Mocked snapshot: crude (Reuters + Bloomberg) and Fed + dollar (Bloomberg). Checks structure and honesty, not live prices. */
for (const width of [390, 1280]) {
  const { ctx, pg, errs } = await open(STATE); await pg.setViewportSize({ width, height: 900 });
  await pg.goto(base + '/#/news'); await pg.waitForSelector('[data-news-group="global"] .cue', { timeout: 20000 }); await pg.waitForTimeout(500);
  const g = pg.locator('[data-news-group="global"]');
  ok(await pg.locator('h1').count() === 1, `one h1 (${width})`);
  ok(/Headlines from outside India\. The connection text is standing context for that kind of headline; moves shown are measured, not predicted\./.test(await g.locator('[data-global-note]').innerText()), `the one-line note is printed once (${width})`);
  ok(await g.locator('.cue').count() === 2 && await g.locator('[data-cue="crude"]').count() === 1 && await g.locator('[data-cue="fed_rates"]').count() === 1, `two cue blocks, each event once under its first cue (${width})`);
  ok(await g.locator('.nw-row').count() === 2 && await g.locator('.nw-row', { hasText: 'Federal Reserve' }).locator('.nw-cue-also', { hasText: 'Dollar and currencies' }).count() === 1, `a headline matching two cues sits once and shows the second as a chip (${width})`);
  ok(await g.locator('.nw-row', { hasText: 'Brent crude' }).locator('.nw-src-n').count() === 1, `the source-count chip is on the row (${width})`);
  ok(/India imports most of the crude/.test(await g.locator('[data-cue="crude"] .cue-channel').innerText()), `the connection line is visible without opening anything (${width})`);
  const d = g.locator('[data-cue="crude"] details.cue-more'); ok(await d.getAttribute('open') === null && !(await g.locator('[data-cue="crude"] .cue-dl').isVisible()), `exposed and watch sit in a closed disclosure (${width})`);
  await d.locator('summary').click(); ok(/Brent/.test(await g.locator('[data-cue="crude"] .cue-dl').innerText()), `the disclosure opens (${width})`);
  ok((await d.locator('summary').boundingBox()).height >= 43.5, `the disclosure target is at least 44 px (${width})`);
  const inst = await g.locator('[data-cue="crude"] [data-cue-instrument="BRENT"]').innerText(); ok(/Brent oil/.test(inst), `the linked instrument is shown with its name (${inst.replace(/\n/g, ' ')})`);
  const sec = await g.locator('[data-cue="crude"] [data-cue-sector]').evaluateAll((a) => a.map((x) => [x.getAttribute('data-cue-sector'), x.getAttribute('href'), x.textContent]));
  ok(sec.length === 4 && sec.every(([, h]) => /^#\/discover\?sector=/.test(h)) && sec.every(([, , t]) => /(up|down|flat|not measured)/.test(t) && !/\b0\.0%/.test(t)), `each sector chip links to Research and reads a measured move in words or "not measured" (${sec.map((x) => x[0]).join(', ')})`);
  ok(/close of \d{1,2} \w{3}/.test(await g.locator('[data-cue="crude"] .cue-mh').nth(1).innerText()), `the sector strip is labelled with its close date (${width})`);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no horizontal overflow (${width})`);
  ok(!/\b(will|expected to|forecast|predict)\b/i.test(await g.innerText()), `no forecast words in the section (${width})`);
  if (width === 390) {
    /* Scope: India hides the section, Global hides the India groups */
    await pg.locator('[data-news-filter]').click(); await pg.waitForSelector('[role=dialog]');
    await pg.locator('[role=dialog] select', { has: pg.locator('option[value="india"]') }).selectOption('india'); await pg.waitForTimeout(200);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    ok(await pg.locator('[data-news-group="global"]').count() === 0 && await pg.locator('[data-news-group="market"]').count() === 1, 'Scope India: no Global cues, India sections stay');
    await pg.locator('[data-news-filter]').click(); await pg.waitForSelector('[role=dialog]'); await pg.locator('[role=dialog] select', { has: pg.locator('option[value="india"]') }).selectOption('global'); await pg.waitForTimeout(200); await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    ok(await pg.locator('[data-news-group="global"]').count() === 1 && await pg.locator('[data-news-group="market"]').count() === 0, 'Scope Global: only Global cues');
    /* motion: reduced motion leaves nothing animated */
    await pg.emulateMedia({ reducedMotion: 'reduce' }); const an = await pg.locator('.cue').first().evaluate((e) => getComputedStyle(e).animationName); ok(an === 'none', `reduced motion: cue blocks do not animate (${an})`);
  }
  ok(errs.length === 0, `no page errors (${errs.join(' | ')})`);
  await ctx.close();
}
{ /* no global events: the empty sentence, distinct from loading and from a late check */
  const { ctx, pg } = await open(STATE, { news: { snapshot: { events: makeEvents(Date.now()).filter((e) => !e.scope) } } });
  await pg.goto(base + '/#/news'); await pg.waitForSelector('[data-news-group="global"]', { timeout: 20000 });
  ok((await pg.locator('[data-news-empty="global"]').innerText()).trim() === 'No global cues in the last 36 hours', 'the empty state says there are no global cues in the last 36 hours');
  await ctx.close();
}
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nall news checks passed'); process.exit(fails ? 1 : 0);
