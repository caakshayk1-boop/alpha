// Shared fixtures for screenshots and beta checks: one saved state and one set of API mocks, so before/after pictures differ only in the app.
import { mockTick } from './tickmock.mjs';
export const STATE = { v: 1, follows: ['TCS', 'GCSL'], plans: [], compares: [], screens: [], snaps: {}, onboarded: true, reviews: [],
  paper: [{ id: 'pp1', sym: 'TCS', engine: 'MOM', asOf: '2026-10-23', ref: 2530, stop: 2400, horizon: 20, qty: 10, takenAt: 1792000000 }],
  prefs: { motion: 'auto', haptics: false, horizon: '', experience: '', interests: [], equity: 1e6, cash: 1e6, riskPct: 0.5, maxPositionPct: 15 },
  entries: [{ id: 'x1', sym: 'TCS', created: '2026-10-01T00:00:00Z', archived: false, versions: [{ at: '2026-10-01T00:00:00Z', thesis: 'Seed thesis', support: 'Steady compounder', counter: 'Slow growth', decision: 'watch', invalidation: 'Close below 2,400', trigger: '', reviewOn: '2026-10-10' }] }] };
export const quoteOf = (prev, px, seed = 1) => { const now = Math.floor(Date.now() / 1000); return { t: Array.from({ length: 40 }, (_, i) => now - (40 - i) * 300), c: Array.from({ length: 40 }, (_, i) => +(prev + (px - prev) * (i / 39) + Math.sin(i / 3 + seed) * prev * 0.002).toFixed(2)), px, pt: now - 20, prev, live: true }; };
export async function mockApi(ctx) {
  const q = quoteOf;
  const T = await mockTick(ctx, { pulse: { NIFTY: q(22600, 22910.4, 1), BANKNIFTY: q(54287, 54830, 2), VIX: q(16.86, 16.1, 3) },
    macro: { GOLD: q(4310, 4388.6, 4), SILVER: q(52, 54.9, 5), BRENT: q(79.4, 78.1, 6), WTI: q(75.9, 74.8, 7), USDINR: q(88.2, 88.5, 8), MYRINR: q(20.1, 20.24, 9), USDMYR: q(4.4, 4.372, 10), BTC: q(67000, 69420, 11) },
    stock: (s) => q(100 + (s.length * 37) % 400, (100 + (s.length * 37) % 400) * (1 + ((s.length % 5) - 2) * 0.007), s.length), breadth: null });
  const series = (() => { const t = [], c = []; let d = Date.UTC(2014, 0, 1, 4) / 1000, px = 100; for (let i = 0; i < 3000; i++) { d += 86400; px *= 1 + 0.0004 + Math.sin(i / 17) * 0.004; t.push(d); c.push(px); } return JSON.stringify({ ok: true, sym: 'X', t, c }); })();
  await ctx.route('**/api/chart*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: series }));
  const now = Math.floor(Date.now() / 1000);
  await ctx.route('**/api/news*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched_at: 'x', q: 'q', items: [{ title: 'Sensex ends higher as banks rally; Q2 results in focus', source: 'Mint', url: 'https://example.com/a', t: now - 3600, tags: ['Results'], also: 2, sources: ['Mint'] }, { title: 'RBI keeps rates unchanged', source: 'Reuters', url: 'https://example.com/b', t: now - 7200, tags: ['Regulator'], also: 0, sources: ['Reuters'] }] }) }));
  await ctx.route('**/api/bars*', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }));
  await ctx.route('**/api/ledger*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"error":"the first nightly run has not happened yet"}' }));
  await ctx.route('**/api/factors*', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }));
  return T;
}
