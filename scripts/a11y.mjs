// a11y.mjs — the accessibility and layout gate (Pro §32.1), run on the WORKER-served build, not next dev.
// Starts `wrangler dev --local` on ./out, then for each route at phone and desktop widths (desktop in both themes):
//   - axe-core: any serious or critical violation fails;
//   - no horizontal overflow; no page error; no "NaN", "undefined" or "[object Object]" in the visible text;
// and two keyboard flows: the search dialog keeps focus on Shift+Tab, and Escape returns focus to the page.
// Usage: npm run build && node scripts/a11y.mjs   (CI: after `npx playwright install --with-deps chromium`)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PORT = 8790;
const ROUTES = ['/', '/research/', '/desk/', '/brief/', '/markets/', '/screen/', '/map/', '/rotation/', '/engines/', '/trades/', '/reads/', '/ipo/', '/funds/', '/news/', '/compare/?s=TCS,INFY', '/tools/', '/watchlist/', '/journal/', '/calendar/', '/about/', '/privacy/', '/company/TCS/', '/nope/'];
const exe = process.env.CHROMIUM_PATH || undefined;

// stdio never 'pipe' unread: wrangler blocks once its request log fills the pipe buffer, and every page then stalls
const srv = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORT)], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-srv.pid); } catch { /* gone */ } };
process.on('exit', stop);
const base = `http://localhost:${PORT}`;
for (let i = 0; i < 90; i++) { try { if ((await fetch(`${base}/`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 1000)); }

const problems = [];
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
for (const [w, h, tag, schemes] of [[390, 844, 'phone', ['light']], [1366, 900, 'desktop', ['light', 'dark']]]) {
  for (const scheme of schemes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    await ctx.addInitScript((sc) => { try { localStorage.setItem('alpha-theme', sc); } catch { /* none */ } }, scheme);
    const p = await ctx.newPage();
    let cur = '';
    p.on('pageerror', (e) => problems.push(`${tag}/${scheme} ${cur}: page error ${e.message.slice(0, 160)}`));
    for (const r of ROUTES) {
      cur = r;
      await p.goto(base + r, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => problems.push(`${tag}/${scheme} ${r}: did not load`));
      await p.waitForTimeout(2500);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (ov > 1) problems.push(`${tag}/${scheme} ${r}: ${ov}px horizontal overflow`);
      const bad = await p.evaluate(() => ['NaN', 'undefined', 'Infinity', '[object Object]'].filter((x) => new RegExp(`(^|[^A-Za-z])${x.replace(/[[\]]/g, '\\$&')}([^A-Za-z]|$)`).test(document.body.innerText)));
      if (bad.length) problems.push(`${tag}/${scheme} ${r}: visible text contains ${bad.join(', ')}`);
      await p.addScriptTag({ content: axe });
      const v = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} (${x.nodes.length}): ${x.nodes[0]?.target?.join(' ')}`));
      for (const x of v) problems.push(`${tag}/${scheme} ${r}: axe ${x}`);
      console.log(`${tag}/${scheme} ${r}: ${v.length ? `${v.length} axe` : 'ok'}`);
    }
    // keyboard: the search dialog contains focus and Escape gives it back
    await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    await p.keyboard.press('/'); await p.waitForTimeout(400);
    for (let i = 0; i < 4; i++) await p.keyboard.press('Shift+Tab');
    if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) problems.push(`${tag}/${scheme}: focus left the search dialog on Shift+Tab`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    if (await p.evaluate(() => !!document.querySelector('.cmdk'))) problems.push(`${tag}/${scheme}: Escape did not close the search dialog`);
    await ctx.close();
  }
}
await browser.close();
stop();
console.log(`a11y: ${ROUTES.length} routes x phone, desktop light and dark`);
if (problems.length) { console.error(problems.map((x) => `FAIL  ${x}`).join('\n')); process.exit(1); }
console.log('a11y passed');
process.exit(0);
