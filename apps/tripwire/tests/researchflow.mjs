import assert from 'node:assert/strict';
import { chromium, newCtx, STATE, ohlcSeries } from './uimock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 1280]) {
    const legacy = structuredClone(STATE); legacy.entries[0].versions[0].reviewOn = null;
    const ctx = await newCtx(browser, width, ohlcSeries(300, 'TCS'), { reducedMotion: 'reduce', state: legacy });
    const pg = await ctx.newPage();
    await pg.goto(base + '/#/desk?v=journal'); await pg.getByText('Seed thesis', { exact: true }).click();
    assert.equal(await pg.locator('#t-date').inputValue(), '');
    await pg.getByRole('button', { name: 'Save as new version' }).click();
    assert.deepEqual(await pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1')).entries), legacy.entries, 'unchanged legacy thesis retains its exact history and absent review date');
    await pg.goto(base + '/#/c/TCS'); await pg.locator('[data-research-read]').waitFor();
    assert.ok(await pg.locator('[data-research-read]').getByText('One-minute read', { exact: true }).isVisible());
    if (width === 390 && process.env.TW_RESEARCH_SHOT) await pg.screenshot({ path: process.env.TW_RESEARCH_SHOT });
    await pg.getByRole('button', { name: "Ask about TCS's evidence" }).click();
    await pg.getByRole('button', { name: 'Connect to thesis v1' }).first().click();
    assert.match(await pg.locator('#t-support').inputValue(), /Steady compounder[\s\S]*Source:/);
    assert.ok((await pg.locator('#t-question').inputValue()).length > 10);
    await pg.locator('#t-review-state').selectOption('waiting');
    await pg.getByRole('button', { name: 'Skipped', exact: true }).click();
    await pg.locator('#t-decisionReason').fill('Waiting for the actual filing');
    await pg.getByRole('button', { name: 'Save as new version' }).click();
    const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1')));
    assert.equal(saved.entries[0].versions.length, 2); assert.equal(saved.entries[0].versions[0].thesis, 'Seed thesis');
    assert.equal(saved.entries[0].versions[1].reviewState, 'waiting'); assert.deepEqual(saved.paper, STATE.paper);
    assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: company overflow`);
    await pg.goto(base + '/#/desk?v=follow'); await pg.locator('[data-follow-review]').waitFor();
    assert.ok(await pg.getByText('Waiting for evidence', { exact: true }).isVisible());
    await pg.goto(base + '/#/desk?v=plans'); await pg.locator('[data-paper-snapshot]').waitFor();
    await pg.getByText('Import paper plans from CSV', { exact: true }).click();
    await pg.locator('#paper-csv').setInputFiles({ name: 'plans.csv', mimeType: 'text/csv', buffer: Buffer.from('symbol,quantity,entry,stop\nTCS,10,2500,2300\n') });
    await pg.getByRole('button', { name: 'Import as saved paper plans' }).click();
    const plans = await pg.evaluate(() => JSON.parse(localStorage.getItem('tripwire:v1')).plans);
    assert.equal(plans.length, 1); assert.equal(plans[0].status, 'saved'); assert.equal(plans[0].filledAt, undefined);
    assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: plans overflow`);
    await pg.goto(base + '/#/discover?value=cheap'); await pg.locator('.screen-feedback').waitFor();
    await pg.locator('.screen-feedback > summary').click(); await pg.locator('#screen-why').fill('TCS');
    await pg.locator('.screen-feedback').getByRole('button', { name: 'TCS', exact: true }).click();
    assert.match(await pg.locator('.screen-feedback').innerText(), /Matches this screen|Excluded from this screen/);
    assert.ok(await pg.locator('.screen-feedback').getByRole('link', { name: 'Inspect TCS evidence →' }).isVisible());
    await ctx.close(); console.log(`PASS research workflow, preservation, CSV and screen feedback at ${width}px`);
  }
} finally { await browser.close(); }
