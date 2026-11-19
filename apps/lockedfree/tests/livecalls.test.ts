import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveMark } from '../src/lib/livecalls.ts';

test('an open call at its fill price shows no gross change and loses only the buy-side charges (the ledger shows CAMS at -391)', () => {
  const m = liveMark(443, 744, 744)!;
  assert.equal(m.gross, 0); assert.equal(m.grossPct, 0);
  assert.ok(Math.abs(m.net + 391) <= 1, `net ${m.net}`);
});
test('a move since entry is marked from the fill, and nets the same charges (GLAND: +1,050 gross, +662 after charges on the ledger)', () => {
  const m = liveMark(101, 3238, 3248.4)!;
  assert.ok(Math.abs(m.gross - 1050.4) < 1e-9); assert.equal(m.grossPct, 0.32);
  assert.ok(Math.abs(m.net - 662) <= 1, `net ${m.net}`);
});
test('a fall is negative, with the percentage taken from the entry', () => {
  const m = liveMark(198, 1665, 1660.4)!;
  assert.equal(m.grossPct, -0.28); assert.ok(m.gross < 0 && m.net < m.gross);
});
test('a missing or non-positive input is never read as zero', () => {
  for (const a of [[0, 100, 100], [10, 0, 100], [10, 100, 0], [10, 100, NaN], [NaN, 100, 100]] as number[][]) assert.equal(liveMark(a[0], a[1], a[2]), null);
});
