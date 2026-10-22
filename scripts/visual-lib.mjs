// visual-lib.mjs — what the visual, numeric and motion gates share: the local Worker, the frozen data snapshot and the
// frozen clock. A page under test sees exactly the data in tests/visual/fixtures.json.gz and the time it was captured at,
// so a screenshot changes only when the CODE does.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';

export const FIXTURES = 'tests/visual/fixtures.json.gz';
export const ROUTES = [['today', '/'], ['screen', '/screen/'], ['company', '/company/TCS/'], ['desk', '/desk/'], ['reads', '/reads/']];
export const WIDTHS = [[360, 780], [768, 1024], [1440, 900]];
/** A request answered from the snapshot: the site's data, never its code. */
export const isData = (u) => /^\/(data|api|c)\//.test(u.pathname) || (u.pathname.endsWith('.json') && u.pathname !== '/manifest.webmanifest');
export const keyOf = (u) => `${u.pathname}${u.search}`;
export const WATCH = ['TCS', 'INFY', 'HDFCBANK'];

export async function startWorker(port) {
  // stdio is never an unread pipe: wrangler blocks once its log fills the pipe buffer
  const srv = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(port)], { stdio: 'ignore', detached: true });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${base}/`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 1000)); }
  return { base, stop: () => { try { process.kill(-srv.pid); } catch { /* gone */ } } };
}

export function loadFixtures() {
  if (!existsSync(FIXTURES)) throw new Error(`${FIXTURES} is missing: run node scripts/visual.mjs --capture`);
  return JSON.parse(gunzipSync(readFileSync(FIXTURES)).toString('utf8'));
}

/** A browser context that sees only the snapshot, at the snapshot's time, with motion off and a fixed watchlist. */
export async function frozenContext(browser, fx, { width, height, scheme = 'light', reduced = true }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  await ctx.addInitScript(({ scheme, watch, reduced }) => {
    try {
      localStorage.setItem('alpha-theme', scheme);
      if (reduced) localStorage.setItem('alpha-motion', 'off');
      localStorage.setItem('alpha-watchlist', JSON.stringify(watch));
    } catch { /* storage blocked */ }
  }, { scheme, watch: WATCH, reduced });
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'localhost') return route.abort();                  // nothing leaves the machine
    if (u.pathname === '/sw.js') return route.fulfill({ status: 404, body: '' });      // no service worker in a gate run
    if (!isData(u)) return route.continue();
    const hit = fx.responses[keyOf(u)];
    if (!hit) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"error":"not in the snapshot"}' });
    return route.fulfill({ status: hit.status, contentType: hit.type, body: hit.body });
  });
  return ctx;
}

export async function newFrozenPage(ctx, fx) {
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date(fx.captured_at) });
  return p;
}

// the full Chromium build (not the headless shell), so CI renders text exactly as the browser the baselines were made in
export const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' });

/** Wait until the page has stopped fetching and painting: no request in flight for a while, fonts ready. */
export async function settle(p, ms = 1200) {
  await p.waitForLoadState('domcontentloaded');
  await p.evaluate(() => document.fonts?.ready);
  await p.clock.runFor(2000).catch(() => undefined);
  await p.waitForTimeout(ms);
}
