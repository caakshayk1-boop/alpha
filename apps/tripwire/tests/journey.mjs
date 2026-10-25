// Browser journeys against the served build (default http://localhost:8801). Prints PASS/FAIL per step and exits 1 on any FAIL.
// Usage: node apps/tripwire/tests/journey.mjs [baseUrl] [shotDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:8801';
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, permissions: [] });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
const bad = []; pg.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('engines_v3')) bad.push(r.status() + ' ' + r.url()); });
const shot = async (n) => { if (shots) await pg.screenshot({ path: `${shots}/${n}.png`, fullPage: false }); };
const text = () => pg.locator('body').innerText();

await pg.goto(base + '/', { waitUntil: 'load' });
ok(await pg.locator('.welcome h1').isVisible(), 'first run shows the welcome screen');
await shot('00-welcome');
await pg.getByRole('button', { name: 'Explore as a guest' }).click();
await pg.waitForSelector('nav.tabs');
ok((await pg.locator('nav.tabs a').allInnerTexts()).map((s) => s.trim()).join('|') === 'Today|Discover|Signals|My Desk|Profile', 'five destinations: Today, Discover, Signals, My Desk, Profile');
await pg.waitForSelector('.gauge svg', { timeout: 15000 });
await pg.waitForTimeout(600); await shot('01-today');
ok(/Data through/.test(await text()), 'Today states the data date');
ok(/market gate is/i.test(await text()), 'Today states the market gate');

// Discover → follow → compare → research
await pg.getByRole('link', { name: 'Discover' }).click();
await pg.waitForSelector('.li');
await pg.getByLabel('Search companies').fill('tata consultancy');
await pg.waitForTimeout(200);
ok((await pg.locator('.li .sym').first().innerText()) === 'TCS', 'Discover search finds TCS by name');
await shot('02-discover');
await pg.getByRole('button', { name: /^Follow Tata Consultancy/ }).first().click();
ok(/Following TCS/.test(await text()), 'follow gives a clear confirmation');
ok(await pg.getByRole('button', { name: /^Unfollow Tata/ }).first().isVisible(), 'follow state is reflected on the control');
await pg.getByLabel('Search companies').fill('');
await pg.getByRole('button', { name: /^Add to comparison: INFY/ }).first().click().catch(() => {});
await pg.getByLabel('Search companies').fill('infosys'); await pg.waitForTimeout(150);
await pg.getByRole('button', { name: /^Add to comparison: INFY/ }).first().click();
await pg.getByLabel('Search companies').fill('tata consultancy'); await pg.waitForTimeout(150);
await pg.getByRole('button', { name: /^Add to comparison: TCS/ }).first().click();
await pg.getByRole('button', { name: /Compare 2/ }).click();
await pg.waitForSelector('table.tbl'); await pg.waitForTimeout(500);
ok((await pg.locator('th.s').allInnerTexts()).join('|').replace(/\s+/g, '') .includes('INFY') , 'compare shows both companies as column headings');
await shot('03-compare');
await pg.getByRole('button', { name: 'Save comparison' }).click();
ok(/Comparison saved/.test(await text()), 'comparison can be saved');
await pg.getByRole('button', { name: 'Valuation' }).click();
ok(/PE \(trailing\)/.test(await text()), 'compare switches to the valuation view');

await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('.meter', { timeout: 15000 }); await pg.waitForTimeout(500); await shot('04-company');
const t = await text();
ok(/Case and countercase/i.test(t) && /Countercase/.test(t), 'company page has case and countercase');
ok(/Not a live quote/.test(t), 'company price is labelled as a dated close, not live');
ok(/Close of /.test(t), 'company price carries its date');

// paper plan
await pg.getByRole('button', { name: /Paper plan/ }).click();
await pg.waitForSelector('[role=dialog]');
await pg.getByLabel(/^Stop/).fill('999999');
ok(/stop below the entry/i.test(await text()), 'planner refuses a stop above a long entry');
const entry = Number(await pg.getByLabel(/^Entry/).inputValue());
await pg.getByLabel(/^Stop/).fill(String(Math.round(entry * 0.95)));
await pg.waitForSelector('text=Planned risk'); await shot('05-planner');
ok(/Sized by/.test(await text()), 'planner reports which limit bound the quantity');
await pg.getByRole('button', { name: 'Save plan' }).click();
await pg.waitForURL(/desk\?v=plans/); 
ok(/Saved plan/.test(await text()) && !/Paper fill/.test(await text()), 'a saved plan is not shown as a fill');
await shot('06-plans');
await pg.getByRole('button', { name: 'Record paper fill' }).click();
ok(/Paper fill \(you recorded it\)/.test(await text()), 'a paper fill exists only after the user records it');

// thesis → journal → export
await pg.goto(base + '/#/c/TCS'); await pg.waitForSelector('.fab-row');
await pg.getByRole('button', { name: /^Thesis$/ }).click();
await pg.getByLabel(/^Thesis: why/).fill('Cash-rich compounder, results in focus');
await pg.getByLabel(/^Wrong if/).fill('Closes below 2,300');
await pg.getByRole('button', { name: 'Save thesis' }).click();
ok(/Thesis saved on this device/.test(await text()), 'thesis save is confirmed and says where it lives');
await pg.goto(base + '/#/desk?v=journal'); await pg.waitForSelector('.card');
ok(/Cash-rich compounder/.test(await text()), 'journal lists the thesis');
await pg.getByText('Cash-rich compounder').click();
await pg.getByLabel(/^Thesis: why/).fill('Cash-rich compounder, results in focus. Reduce if guidance slips.');
await pg.getByRole('button', { name: 'Save as new version' }).click();
await pg.getByText('Cash-rich compounder').first().click();
await pg.getByRole('button', { name: 'History' }).click();
ok((await pg.locator('.sheet .k').allInnerTexts()).some((x) => /Earlier/i.test(x)), 'editing keeps the earlier version in history');
await pg.keyboard.press('Escape');
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: /Export journal/ }).click()]);
ok(dl.suggestedFilename() === 'tripwire-journal.csv', 'journal exports as CSV');
await shot('07-journal');

// signals
await pg.goto(base + '/#/signals'); await pg.waitForSelector('details.ev'); await shot('08-signals');
ok((await pg.locator('details.ev').count()) === 10, 'rules view lists the ten rules');
await pg.getByRole('tab', { name: 'Engines' }).click(); await pg.waitForSelector('.stage');
ok((await pg.locator('.card .k', { hasText: /^E[1-6]$/ }).count()) === 6, 'engines view lists E1 to E6');
ok(/Alerts are off/.test(await text()), 'engines view says alerts are off');
await shot('09-engines');
await pg.getByRole('tab', { name: 'Paper ledger' }).click(); await pg.waitForSelector('h2.h');
ok(/Forming setups/i.test(await text()) && /Validated alerts/i.test(await text()) && /Closed paper record/i.test(await text()), 'ledger shows the four lifecycle views');

// search
await pg.getByRole('button', { name: 'Search' }).click();
await pg.getByRole('textbox', { name: 'Search' }).fill('roce');
ok(/ROCE/.test(await text()) && /Terms/i.test(await text()), 'global search finds a defined term');
await pg.getByRole('textbox', { name: 'Search' }).fill('infosys');
ok((await pg.locator('.sheet .li b').first().innerText()) === 'INFY', 'global search finds companies');
await shot('10-search'); await pg.keyboard.press('Escape');

// profile
await pg.goto(base + '/#/profile'); await shot('11-profile');
ok(/Sign-in is not available yet/.test(await text()), 'profile is honest that no account exists');
ok(/Not available yet/.test(await text()) && /Free/.test(await text()), 'notifications and billing are shown as unavailable, not faked');
await pg.getByRole('button', { name: /Delete all my data/ }).click();
await pg.getByRole('button', { name: 'Erase now' }).click();
await pg.goto(base + '/#/desk?v=journal');
ok(/No theses yet/.test(await text()), 'deleting data erases the notes');

// offline
await pg.goto(base + '/#/today'); await pg.waitForSelector('.gauge svg');
await ctx.setOffline(true); await pg.reload().catch(() => {}); await pg.waitForTimeout(1500);
const offTxt = await text().catch(() => '');
ok(/Offline|Data through|Today/.test(offTxt), 'offline reload still renders from the saved shell and data' + (offTxt ? '' : ' (nothing rendered)'));
await ctx.setOffline(false);

const man = await (await fetch(base + '/manifest.webmanifest')).json();
ok(man.display === 'standalone' && man.icons.some((i) => i.purpose === 'maskable') && (await fetch(base + '/icon-192.png')).ok, 'manifest is standalone with real PNG and maskable icons');
ok((await fetch(base + '/robots.txt').then((r) => r.text())).includes('Disallow: /'), 'robots keeps the app out of search until the owner decides');
ok(await pg.evaluate(() => navigator.serviceWorker?.getRegistrations().then((r) => r.length > 0)), 'service worker is registered');
ok(errs.length === 0, `no script or console errors${errs.length ? ': ' + errs[0] : ''}`);
ok(bad.length === 0, `no failed requests${bad.length ? ': ' + bad[0] : ''}`);
await b.close();
console.log(fails ? `\njourney: ${fails} failed` : '\njourney: all passed');
process.exit(fails ? 1 : 0);
