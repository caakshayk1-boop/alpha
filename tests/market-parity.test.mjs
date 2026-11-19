import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as hub from '../worker/market.js';
import * as tw from '../apps/tripwire/worker.js';

// The hub's market module is a verbatim port of Tripwire's price code; these fixtures run both copies and fail if they ever drift apart.
const now = Date.parse('2026-11-19T06:30:00Z'), sec = Math.floor(now / 1000);
const spark = { timestamp: [sec - 900, sec - 600, sec - 300], close: [100, 101.456, 102.449], chartPreviousClose: 99.5 };
const intra = { timestamp: [sec - 600, sec - 300], indicators: { quote: [{ close: [100.126, 101.004] }] }, meta: { regularMarketPrice: 101.0049, regularMarketTime: sec - 120, chartPreviousClose: 99.5 } };
const days = Array.from({ length: 45 }, (_, i) => 1700000000 + i * 86400);
const hist = { timestamp: days, indicators: { quote: [{ close: days.map((_, i) => 100 + i * 0.37), open: days.map((_, i) => 99 + i * 0.3), high: days.map((_, i) => 101 + i * 0.4), low: days.map((_, i) => 98 + i * 0.3), volume: days.map((_, i) => 1000 + i) }] } };
const nifty = { timestamp: days, indicators: { quote: [{ close: days.map((_, i) => 24000 + i * 5) }] } };

test('parseSpark, parseIntraday and parseChart give the same answers as Tripwire', () => {
  assert.deepEqual(hub.parseSpark(spark, now), tw.parseSpark(spark, now));
  assert.equal(hub.parseSpark(spark, now).live, true);
  assert.deepEqual(hub.parseIntraday(intra, now), tw.parseIntraday(intra, now));
  assert.deepEqual(hub.parseChart(hist, nifty), tw.parseChart(hist, nifty));
  assert.deepEqual(hub.parseChart({ timestamp: days.slice(0, 5), indicators: { quote: [{ close: [1, 2, 3, 4, 5] }] } }, null), tw.parseChart({ timestamp: days.slice(0, 5), indicators: { quote: [{ close: [1, 2, 3, 4, 5] }] } }, null));
  assert.equal(hub.parseSpark({ timestamp: [1], close: [null] }, now), tw.parseSpark({ timestamp: [1], close: [null] }, now));
});
test('symbol lists, macro names and market hours agree', () => {
  for (const [raw, max, min] of [['tcs,infy', 30, 1], ['B,A,a', 30, 1], ['', 30, 0], ['', 30, 1], ['TCS,<x>', 30, 1], ['A,B,C', 2, 1], ['X'.repeat(21), 30, 1]]) assert.deepEqual(hub.normSymbols(raw, max, min), tw.normSymbols(raw, max, min), JSON.stringify(raw));
  assert.deepEqual(hub.MACRO, tw.MACRO);
  for (const t of [now, now + 6 * 3600e3, Date.parse('2026-11-21T06:30:00Z')]) assert.equal(hub.marketOpenNow(t), tw.marketOpenNow(t));
});
test('the hub routes: other paths pass through, POST is refused, a bad symbol list is a 400 with no upstream call', async () => {
  const req = (path, method = 'GET') => [new Request('https://alpha.test' + path, { method }), new URL('https://alpha.test' + path)];
  assert.equal(await hub.marketRoute(...req('/v1/other'), {}), null);
  assert.equal((await hub.marketRoute(...req('/v1/market/tick?s=A', 'POST'), {})).status, 405);
  const bad = await hub.marketRoute(...req('/v1/market/tick?s=%3Cx%3E'), {}); assert.equal(bad.status, 400);
  const badChart = await hub.marketRoute(...req('/v1/market/chart?s=%3Cx%3E'), {}); assert.equal(badChart.status, 400);
});
