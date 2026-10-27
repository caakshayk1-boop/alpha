// Shared helpers for the UI suite and the before/after screenshots: an OHLC+volume daily series and a context with the saved state and API mocks.
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
/** A daily series (weekdays only) of `n` bars ending near today, with open, high, low and volume. */
export function ohlcSeries(n = 1400, sym = 'TCS', opts = {}) {
  const t = [], c = [], o = [], h = [], l = [], v = []; const end = Math.floor(Date.now() / 1000); let d = end - n * 86400 * 1.45; let px = 100, i = 0;
  while (t.length < n) {
    d += 86400; const wd = new Date(d * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const op = px; px *= 1 + 0.0006 + Math.sin(i / 11) * 0.012; i++;
    t.push(Math.floor(d / 86400) * 86400 + 3600 * 4); c.push(+px.toFixed(2)); o.push(+op.toFixed(2)); h.push(+(Math.max(op, px) * 1.012).toFixed(2)); l.push(+(Math.min(op, px) * 0.988).toFixed(2)); v.push(100000 + (i % 40) * 5000);
  }
  return JSON.stringify({ ok: true, sym, t, c, n: opts.nifty ? c.map((x, k) => 20000 + k * 3) : null, o, h, l, v });
}
export async function newCtx(browser, width, series, extra = {}) {
  const { state, ...rest } = extra;
  const ctx = await browser.newContext({ viewport: { width, height: width >= 1000 ? 900 : 844 }, serviceWorkers: 'block', ...rest });
  await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, state ?? STATE);
  await mockApi(ctx);
  if (series) await ctx.route('**/api/chart*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: series }));
  await ctx.route('**/api/rsi*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"error":"none"}' }));
  return ctx;
}
export { chromium, STATE };
