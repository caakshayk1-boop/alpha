import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BASIS, reprice } from '../src/basis.ts';

const gcsl = { price: 726.2, from_high: -3.1, high52: 749.45, low52: 213.15, pe: 47.5, pb: 10.43, div_yield: 0.09 };
test('GCSL: a live print inside the range moves "from high" with it, and the multiples scale with the price', () => {
  const r = reprice(gcsl, 746.53); assert.equal(r.basis, 'live'); assert.equal(r.px, 746.53); assert.equal(r.fromHigh, -0.4); assert.equal(r.high52, 749.45); assert.equal(r.newHigh, false);
  assert.equal(r.pe, 48.8); assert.equal(r.pb, 10.72); assert.equal(r.divYield, 0.09); assert.equal(r.fromLow, 250.2);
});
test('a live print above the published high is a new high: from-high reads zero and the page is not given an intraday level it does not know', () => {
  const r = reprice(gcsl, 760); assert.equal(r.newHigh, true); assert.equal(r.fromHigh, 0); assert.equal(r.high52, 760);
  const l = reprice(gcsl, 200); assert.equal(l.newLow, true); assert.equal(l.fromLow, 0); assert.equal(l.low52, 200);
});
test('no live print, or an unusable one, returns the close\'s own figures untouched and says close', () => {
  for (const live of [null, 0, -5, NaN]) { const r = reprice(gcsl, live as number | null); assert.equal(r.basis, 'close'); assert.equal(r.fromHigh, -3.1); assert.equal(r.pe, 47.5); assert.equal(r.px, 726.2); }
  assert.equal(reprice({ ...gcsl, price: null }, 746).basis, 'close'); assert.equal(reprice({ ...gcsl, pe: null }, 746.53).pe, null, 'a missing multiple stays missing');
});
test('the close and the live basis agree when the print equals the close', () => {
  const a = reprice(gcsl, 726.2), b = reprice(gcsl, null); assert.equal(a.fromHigh, b.fromHigh); assert.equal(a.pe, b.pe); assert.equal(a.pb, b.pb);
});
const real = new URL('../dist/data/screen.json', import.meta.url);
test('every field the real screen publishes has a declared price and time basis, and nothing declared is missing from the feed by name', { skip: !existsSync(real) }, () => {
  const rows = JSON.parse(readFileSync(real, 'utf8')).rows as Record<string, unknown>[]; const seen = new Set<string>(); for (const r of rows) for (const k of Object.keys(r)) seen.add(k);
  const undeclared = [...seen].filter((k) => !(k in BASIS)); assert.deepEqual(undeclared, [], `figures with no declared basis: ${undeclared.join(', ')}`);
});
test('a "reprice" field really is a function of price: the declared set is exactly what reprice() returns', () => {
  const declared = Object.entries(BASIS).filter(([, b]) => b === 'reprice').map(([k]) => k).sort();
  assert.deepEqual(declared, ['div_yield', 'from_high', 'high52', 'low52', 'pb', 'pe']);
});
