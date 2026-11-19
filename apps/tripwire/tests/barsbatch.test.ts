import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BARS_MAX, chunk, joinBars, type BarsFeed } from '../src/data.ts';

const feed = (at: string, syms: string[], missing: string[] = []): BarsFeed => ({ ok: true, fetched_at: at, bars: Object.fromEntries(syms.map((s) => [s, { t: [1], o: [1], h: [1], l: [1], c: [1], forming: false, live: null }])), missing });

test('the Book asks for at most the Worker limit per call (19 Nov 2026: 32 symbols were refused)', () => {
  const syms = Array.from({ length: 32 }, (_, i) => `S${i}`);
  const parts = chunk(syms, BARS_MAX);
  assert.equal(BARS_MAX, 30);
  assert.deepEqual(parts.map((p) => p.length), [30, 2]);
  assert.deepEqual(parts.flat(), syms, 'nothing dropped, order kept');
  assert.deepEqual(chunk([], 30), []);
  assert.deepEqual(chunk(['A'], 30), [['A']]);
});

test('joined answers keep every symbol and every missing name, and report the stalest fetch time', () => {
  const j = joinBars([feed('2026-11-19T10:00:00Z', ['A', 'B'], ['X']), feed('2026-11-19T09:58:00Z', ['C'], ['Y'])]);
  assert.deepEqual(Object.keys(j.bars).sort(), ['A', 'B', 'C']);
  assert.deepEqual(j.missing, ['X', 'Y']);
  assert.equal(j.fetched_at, '2026-11-19T09:58:00Z');
  assert.equal(j.ok, true);
});
