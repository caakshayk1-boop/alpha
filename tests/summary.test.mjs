// Run with: node --test tests/summary.test.mjs   (the text scan behind /api/summary; no network)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise } from '../worker/index.js';

const row = (o) => JSON.stringify({ sym: 'X', name: 'x', ind: 'i', sector: 'Tech', price: 100, roce: { nested: 1 } && 1, sma200: 90, r1d: 1, r1w: -3, ...o });
const feed = (rows) => `{"built_on":"2026-10-14","count":${rows.length},"breadth":{"above200":50,"advancing":1,"declining":9,"as_of":"2026-10-13"},"rows":[${rows.join(',')}]}`;

test('summarise: the day is counted on r1d, never on the week-based breadth block', () => {
  const s = summarise(feed([row({ r1d: 2, r1w: -1 }), row({ r1d: 1, r1w: -1 }), row({ r1d: -1, r1w: -1 }), row({ r1d: 0 })]));
  assert.deepEqual(s.day, { up: 2, down: 1, flat: 1, counted: 4 });
  assert.equal(s.as_of, '2026-10-13');
  assert.equal(s.built_on, '2026-10-14');
  assert.equal(s.count, 4);
});

test('summarise: 200-day share leaves out stocks with no 200-day average, NaN included', () => {
  const s = summarise(feed([row({ price: 100, sma200: 90 }), row({ price: 80, sma200: 90 }), row({ sma200: null })]).replace('"sma200":null', '"sma200":NaN'));
  assert.deepEqual(s.above200, { above: 1, withHistory: 2 });
});

test('summarise: sector medians use only that sector, sorted strongest first; a missing move is skipped', () => {
  const s = summarise(feed([row({ sector: 'A', r1d: 1 }), row({ sector: 'A', r1d: 3 }), row({ sector: 'B', r1d: -2 }), row({ sector: 'B', r1d: null }), row({ sector: null, r1d: 5 })]));
  assert.deepEqual(s.sectors, [{ name: 'A', n: 2, median: 2 }, { name: 'B', n: 1, median: -2 }]);
  assert.equal(s.day.counted, 4, 'a stock with a null sector still counts in the day');
});

test('summarise: a row with no sector key at all still counts in the day (ARTEMISMED, 13 Oct 2026)', () => {
  const s = summarise(feed([row({ r1d: 1 }), JSON.stringify({ sym: 'ARTEMISMED', name: 'a', price: 311, sma200: 270, r1d: 0 })]));
  assert.deepEqual(s.day, { up: 1, down: 0, flat: 1, counted: 2 });
  assert.deepEqual(s.above200, { above: 2, withHistory: 2 });
});
