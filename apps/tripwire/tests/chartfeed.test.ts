// @ts-nocheck  (the Worker is plain JavaScript)
// The price-history request. Yahoo answers `range=max&interval=1d` with MONTHLY bars for a long history (found live: TCS came back as 267 monthly bars from 2002), and daily and weekly candles cannot be built from months.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

test('chart: asks Yahoo for daily bars over an explicit date range, never range=max', async () => {
  const seen: string[] = []; const real = globalThis.fetch;
  (globalThis as any).caches = { default: { match: async () => undefined, put: async () => {} } };
  (globalThis as any).fetch = async (u: string) => { seen.push(String(u)); const t = Array.from({ length: 60 }, (_, i) => 1700000000 + i * 86400); const c = t.map((_, i) => 100 + i);
    return new Response(JSON.stringify({ chart: { result: [{ timestamp: t, indicators: { quote: [{ close: c, open: c, high: c, low: c, volume: c }] } }] } })); };
  try {
    const r = await worker.fetch(new Request('https://tripwire.test/api/chart?s=TCS', { headers: { 'cf-connecting-ip': '9.9.9.9' } }), { ASSETS: { fetch: async () => new Response('x') } }, { waitUntil: (p) => p });
    assert.equal((await r.json()).ok, true);
    const y = seen.filter((u) => u.includes('finance/chart'));
    assert.ok(y.length >= 1);
    for (const u of y) { assert.ok(!u.includes('range=max'), u); assert.match(u, /period1=\d+&period2=\d+&interval=1d/); const p1 = Number(u.match(/period1=(\d+)/)[1]), p2 = Number(u.match(/period2=(\d+)/)[1]); assert.ok(p1 <= 631152000 && p2 > Date.now() / 1000, u); }
  } finally { (globalThis as any).fetch = real; }
});
