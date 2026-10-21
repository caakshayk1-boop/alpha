// visual.mjs — the visual regression gate (Pro §32.1): Today, Screen, Company, My Desk and Weekly Reads at 360, 768 and
// 1440px in light and dark, against approved screenshots in tests/visual/baseline/. Pages run on the local Worker with the
// frozen data snapshot and clock (visual-lib.mjs), so a difference means the code changed what readers see.
//   node scripts/visual.mjs            compare; writes tests/visual/diff/*.png for any failure (CI uploads them)
//   node scripts/visual.mjs --update   approve the current rendering as the new baseline (commit the PNGs)
//   node scripts/visual.mjs --capture  re-record the data snapshot from the live feeds (rarely; then --update)
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { FIXTURES, ROUTES, WIDTHS, isData, keyOf, frozenContext, launch, loadFixtures, newFrozenPage, settle, startWorker, WATCH } from './visual-lib.mjs';

const BASE_DIR = 'tests/visual/baseline', DIFF_DIR = 'tests/visual/diff';
const update = process.argv.includes('--update'), capture = process.argv.includes('--capture');
// a pixel differs when its colour distance passes 0.1 (pixelmatch's scale); a page fails above 0.1% of its pixels
// (about 1,300 at 1440×900): enough to catch one button changing colour, which 0.5% missed at desktop widths. Two runs on
// one machine differ by 0 pixels; if a CI runner's rendering is noisier, re-approve from its own screenshots, never loosen
const PIXEL = 0.1, PAGE = 0.001;

const w = await startWorker(8800);
const browser = await launch();
try {
  if (capture) {
    const responses = {};
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((watch) => { try { localStorage.setItem('alpha-watchlist', JSON.stringify(watch)); } catch { /* none */ } }, WATCH);
    const p = await ctx.newPage();
    p.on('response', async (res) => {
      const u = new URL(res.url());
      if (u.hostname !== 'localhost' || !isData(u)) return;
      try { responses[keyOf(u)] = { status: res.status(), type: res.headers()['content-type'] ?? 'application/json', body: await res.text() }; } catch { /* body gone */ }
    });
    for (const [, path] of ROUTES) { await p.goto(w.base + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined); await p.waitForTimeout(4000); await p.mouse.wheel(0, 4000); await p.waitForTimeout(3000); }
    await ctx.close();
    mkdirSync('tests/visual', { recursive: true });
    writeFileSync(FIXTURES, gzipSync(JSON.stringify({ captured_at: new Date().toISOString(), responses })));
    console.log(`visual: captured ${Object.keys(responses).length} data responses into ${FIXTURES}`);
  } else {
    const fx = loadFixtures();
    mkdirSync(BASE_DIR, { recursive: true });
    rmSync(DIFF_DIR, { recursive: true, force: true });
    const fails = [];
    let n = 0;
    for (const [name, path] of ROUTES) for (const [width, height] of WIDTHS) for (const scheme of ['light', 'dark']) {
      const ctx = await frozenContext(browser, fx, { width, height, scheme });
      const p = await newFrozenPage(ctx, fx);
      await p.goto(w.base + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await settle(p);
      const shot = await p.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide' });
      await ctx.close();
      const file = `${name}-${width}-${scheme}.png`;
      n++;
      if (update || !existsSync(`${BASE_DIR}/${file}`)) { writeFileSync(`${BASE_DIR}/${file}`, shot); if (!update) fails.push(`${file}: no approved baseline (run with --update and commit it)`); continue; }
      const a = PNG.sync.read(readFileSync(`${BASE_DIR}/${file}`)), b = PNG.sync.read(shot);
      if (a.width !== b.width || a.height !== b.height) { fails.push(`${file}: size ${b.width}×${b.height}, baseline ${a.width}×${a.height}`); continue; }
      const diff = new PNG({ width: a.width, height: a.height });
      const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: PIXEL });
      const share = bad / (a.width * a.height);
      if (share > PAGE) {
        mkdirSync(DIFF_DIR, { recursive: true });
        writeFileSync(`${DIFF_DIR}/${file}`, PNG.sync.write(diff));
        writeFileSync(`${DIFF_DIR}/${file.replace('.png', '.actual.png')}`, shot);
        fails.push(`${file}: ${(share * 100).toFixed(2)}% of pixels differ (limit ${(PAGE * 100).toFixed(1)}%)`);
      }
    }
    console.log(`visual: ${n} screenshots (${ROUTES.length} routes × ${WIDTHS.length} widths × light and dark)${update ? ', baseline written' : ''}`);
    if (fails.length) { console.error(fails.map((f) => `FAIL  ${f}`).join('\n')); console.error(`Diffs in ${DIFF_DIR}/. If the change is intended, approve it: node scripts/visual.mjs --update`); process.exitCode = 1; }
    else if (!update) console.log('visual passed');
  }
} finally {
  await browser.close();
  w.stop();
}
