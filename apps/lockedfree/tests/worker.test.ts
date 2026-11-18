import { test } from 'node:test';
import assert from 'node:assert/strict';
// worker.js imports cloudflare:workers, which Node does not have; the pure helpers are tested by loading the file with that import stubbed.
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject {}').replace(/export default \{[\s\S]*$/, '').replace(/export class Subscribers[\s\S]*?\n\}\n/, '');
const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
test('yahooSymbol: NSE equities get .NS, known indices map, anything odd is refused', () => { assert.equal(mod.yahooSymbol('TCS'), 'TCS.NS'); assert.equal(mod.yahooSymbol('M&M'), 'M&M.NS'); assert.equal(mod.yahooSymbol('NIFTY'), '^NSEI'); assert.equal(mod.yahooSymbol('../x'), null); assert.equal(mod.yahooSymbol('a b'), null); assert.equal(mod.yahooSymbol('lower'), null); });
test('parseQuote: reads price, previous close and time; a missing price is null, never zero', () => {
  const q = mod.parseQuote({ chart: { result: [{ meta: { regularMarketPrice: 101.5, chartPreviousClose: 100, regularMarketTime: 1763450000, regularMarketDayHigh: 102, regularMarketDayLow: 99 } }] } }); assert.deepEqual(q, { px: 101.5, prev: 100, t: 1763450000, hi: 102, lo: 99 });
  assert.equal(mod.parseQuote({ chart: { result: [{ meta: {} }] } }), null); assert.equal(mod.parseQuote({}), null); assert.equal(mod.parseQuote({ chart: { result: [{ meta: { regularMarketPrice: 'x' } }] } }), null);
});
test('parseChart: India dates, gaps dropped not filled', () => {
  const p = mod.parseChart({ chart: { result: [{ timestamp: [1763339400, 1763425800, 1763512200], indicators: { quote: [{ close: [100.123, null, 102] }] } }] } }); assert.equal(p.length, 2); assert.equal(p[0].c, 100.12); assert.match(p[0].t, /^\d{4}-\d{2}-\d{2}$/); assert.deepEqual(mod.parseChart({}), []);
});
