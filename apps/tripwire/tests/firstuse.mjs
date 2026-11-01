// First use and the adaptive home, in a real browser: a fresh profile finds a company, reads the case, countercase and main risk, saves a thought, sees the storage note once,
// reloads and finds the thought again in My Desk and on the company page. Skip and guest work. Nothing is auto-followed. Existing saved state loads unchanged and is "returning".
// AUTOMATED checks, not user research. Usage: node apps/tripwire/tests/firstuse.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const mk = async (state, o = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...o });
  if (state) await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch { /* none */ } }, state);
  await mockApi(ctx); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  return { ctx, pg, errs };
};
const saved = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1') ?? 'null'));
const text = async (pg) => { await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); return pg.locator('body').innerText(); };

/* ---- 1. the whole first-use path ---- */
{
  const { ctx, pg, errs } = await mk(null);
  await pg.goto(base + '/'); await pg.waitForSelector('.welcome h1');
  ok(/Start with one company/.test(await text(pg)) && await pg.getByRole('button', { name: 'Skip' }).count() === 1 && await pg.getByRole('button', { name: 'Explore as a guest' }).count() === 1, 'first use asks for one company and keeps Skip and Explore as a guest');
  ok(!/dashboard|Your path|0 of 4/i.test(await pg.locator('.welcome').innerText()), 'it is not a dashboard-first onboarding');
  await pg.getByLabel('Company name or symbol').fill('zzzqq'); ok(/No company matches/.test(await text(pg)), 'a search with no match says so');
  await pg.getByLabel('Company name or symbol').fill('tata consultancy'); await pg.waitForSelector('.wl-hits .li');
  const hit = await pg.locator('.wl-hits .li').first().innerText(); ok(/TCS/.test(hit) && /Tata Consultancy/i.test(hit), `search by name finds a real company from the screen (${hit.replace(/\n/g, ' ')})`);
  await pg.getByLabel('Company name or symbol').fill('TCS'); await pg.locator('.wl-hits .li', { hasText: 'TCS' }).first().click();
  await pg.waitForSelector('[data-first="thought"]', { timeout: 15000 });
  ok(/#\/c\/TCS\?first=1/.test(pg.url()), 'the chosen company opens on its own page');
  const st0 = await saved(pg); ok(st0.onboarded === true && st0.follows.length === 0 && st0.entries.length === 0, 'choosing a company leaves first use and follows nothing');
  const open = await pg.locator('details.ev[open]').count(); ok(open >= 2 && await pg.locator('details.ev[open] summary', { hasText: /Case|Countercase/ }).count() === 2 && /Case \(\d+\)/i.test(await text(pg)) && /Countercase \(\d+\)/i.test(await text(pg)), 'the case and the countercase are both open on the page');
  const risk = await pg.locator('[data-first-risk]').innerText(); ok(risk.trim().length > 15, `the main risk is stated in a line (${risk.slice(0, 70)})`);
  ok(!/Saved on this device only|stays on this device/.test(await pg.locator('#first-thought').innerText()), 'the storage note is not shown before anything is saved');
  ok(await pg.getByRole('button', { name: 'Save thought' }).isDisabled(), 'an empty thought cannot be saved');
  await pg.fill('#ft-thought', 'Steady cash generation; check how much of it is returned to holders'); await pg.getByRole('button', { name: 'Save thought' }).click(); await pg.waitForSelector('[data-first="saved"]');
  const note = pg.locator('[data-first="storage-note"]'); ok(await note.count() === 1 && /stays on this device/.test(await note.innerText()), 'the first save shows one line that the note stays on this device');
  ok(await note.locator('a[href="#/profile"]').count() === 1, 'the line links to Backup through the stable #/profile address');
  const st1 = await saved(pg); ok(st1.entries.length === 1 && st1.entries[0].sym === 'TCS' && st1.entries[0].versions[0].thesis.startsWith('Steady cash') && st1.entries[0].versions[0].invalidation === '' && st1.entries[0].versions[0].reviewOn === null, 'the thought is a journal entry with invalidation optional and no forced review date');
  ok(st1.follows.length === 0 && st1.storageNote === true, 'saving a thought did not follow the company');
  ok(/Saving a thought does not follow TCS/.test(await text(pg)), 'the page says saving does not follow');
  await note.locator('a').click(); await pg.waitForSelector('text=Export all (JSON)'); ok(true, 'the Backup link reaches the export in Profile');
  await pg.reload(); await pg.waitForSelector('nav.tabs'); ok(!(await pg.locator('.welcome').count()), 'a returning visitor never sees first use again');
  await pg.goto(base + '/#/desk'); await pg.waitForSelector('[data-desk="workspace"]'); const dt = await text(pg);
  ok(/Steady cash generation/.test(dt) && /Saved theses/.test(dt), 'after a reload the thought is in My Desk');
  ok(!/Following|Plans/.test(await pg.locator('.seg').innerText()) && /Journal/.test(await pg.locator('.seg').innerText()), 'My Desk offers Journal (it holds something) but not empty Following or Plans');
  await pg.goto(base + '/#/desk?v=journal'); await pg.waitForSelector('.card'); ok(/Steady cash generation/.test(await text(pg)), 'the Journal deep link shows it');
  await pg.goto(base + '/#/c/TCS?first=1'); await pg.waitForSelector('[data-first="saved"]'); const ct = await text(pg);
  ok(/Steady cash generation/.test(ct) && !(await pg.locator('[data-first="storage-note"]').count()), 'the company page shows the thought again, and the storage note does not return');
  await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('.fab-row'); ok(/Steady cash generation/.test(await text(pg)), 'and so does the normal company page, under Your thesis');
  await pg.goto(base + '/#/c/TCS?first=1'); await pg.locator('#first-thought').getByRole('button', { name: 'Follow TCS' }).click(); await pg.waitForTimeout(300);
  ok((await saved(pg)).follows.join() === 'TCS', 'following happens only when the person taps Follow');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : '')); await ctx.close();
}

/* ---- 2. Skip and guest ---- */
for (const label of ['Skip', 'Explore as a guest']) {
  const { ctx, pg } = await mk(null); await pg.goto(base + '/'); await pg.waitForSelector('.welcome h1'); await pg.getByRole('button', { name: label, exact: true }).click(); await pg.waitForSelector('nav.tabs');
  await pg.waitForSelector('[data-sec="setup"]'); const st = await saved(pg);
  ok(st.onboarded === true && st.follows.length === 0 && st.entries.length === 0, `${label}: leaves first use with nothing followed or written`);
  ok(/Start with one company/.test(await text(pg)) && await pg.getByRole('button', { name: 'Find a company' }).count() === 1, `${label}: Today is the new-user state, one setup action`);
  await pg.reload(); await pg.waitForSelector('nav.tabs'); ok(!(await pg.locator('.welcome').count()), `${label}: not asked again after a reload`);
  await pg.goto(base + '/#/desk'); await pg.waitForSelector('[data-desk="new"]'); ok(!(await pg.locator('.seg').count()) && !/Journal|Plans|Saved|Following|Questions/.test(await pg.locator('main, body').first().innerText().then((t) => t.replace(/Find a company|Companies you follow[^.]*\./g, ''))), `${label}: My Desk is one empty state with no empty sections`);
  for (const v of ['follow', 'journal', 'plans', 'saved']) { await pg.goto(base + `/#/desk?v=${v}`); await pg.waitForTimeout(400); ok((await pg.locator('.seg [aria-selected=true]').count()) === 1, `${label}: #/desk?v=${v} still opens its view`); }
  await ctx.close();
}

/* ---- 3. a profile saved before this change loads unchanged and is returning ---- */
{
  const { ctx, pg } = await mk(STATE); await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-sec="brief"]'); await pg.waitForTimeout(1500);
  const secs = await pg.$$eval('[data-sec]', (n) => n.map((x) => x.getAttribute('data-sec')));
  ok(!(await pg.locator('.welcome').count()) && !secs.includes('setup') && secs.includes('changes'), `existing state: Today is the returning state (${secs.join(', ')})`);
  const st = await saved(pg); ok(JSON.stringify(st.entries) === JSON.stringify(STATE.entries) && JSON.stringify(st.paper) === JSON.stringify(STATE.paper) && st.follows.join() === 'TCS,GCSL' && st.plans.length === 0, 'entries, paper trades and follows are exactly as saved');
  await pg.goto(base + '/#/desk'); await pg.waitForSelector('[data-desk="workspace"]'); const t = await text(pg);
  ok(/Followed companies/.test(t) && /Saved theses/.test(t) && !/Open questions/.test(t), 'My Desk shows what is populated and hides what is not');
  await ctx.close();
}
/* ---- 4. the new screens pass axe (serious and critical), do not scroll sideways, and hold at 200% text ---- */
for (const [w, tag] of [[390, 'phone'], [1280, 'desktop']]) {
  const NEW = { ...STATE, follows: [], entries: [], paper: [], snaps: {} };
  for (const [name, st, route] of [['first use', null, '/'], ['company, first look', NEW, '/#/c/TCS?first=1'], ['new Today', NEW, '/#/today'], ['new Desk', NEW, '/#/desk']]) {
    const { ctx, pg } = await mk(st, { viewport: { width: w, height: 900 }, bypassCSP: true }); await pg.goto(base + route); await pg.waitForSelector(st ? 'nav.tabs' : '.welcome h1'); await pg.waitForTimeout(1500);
    await pg.addScriptTag({ content: axe }); const v = await pg.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((x) => ['serious', 'critical'].includes(x.impact)).map((x) => `${x.id}: ${x.nodes[0].html.slice(0, 80)}`));
    ok(v.length === 0, `${tag} ${name}: axe serious/critical clean${v.length ? ' (' + v[0] + ')' : ''}`);
    await pg.addStyleTag({ content: 'html{font-size:200% !important}' }); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `${tag} ${name}: no sideways scroll at 200% text`); await ctx.close();
  }
}
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
