import test from 'node:test';
import assert from 'node:assert/strict';
import { bankLead, indexFacts } from '../src/indexfacts.ts';

test('an index day: change, points, range position and the gap at the open', () => {
  const f = indexFacts({ c: [24100, 24050, 24200, 24150], px: 24180, prev: 24000 })!;
  assert.equal(f.pts, 180); assert.ok(Math.abs(f.ch - 0.75) < 1e-9); assert.equal(f.lo, 24050); assert.equal(f.hi, 24200);
  assert.ok(Math.abs(f.pos! - (24180 - 24050) / 150) < 1e-9); assert.equal(f.prevPos, null);   // yesterday's close is below the whole day's range
  assert.ok(Math.abs(f.gap! - (100 / 24000) * 100) < 1e-9);
});
test('yesterday close inside the day range is placed on it', () => {
  const f = indexFacts({ c: [100, 90, 110], px: 105, prev: 100 })!; assert.equal(f.prevPos, 0.5);
});
test('a flat day has no range position rather than a divide by zero; a missing quote is null, not zero', () => {
  assert.equal(indexFacts({ c: [100, 100], px: 100, prev: 100 })!.pos, null);
  assert.equal(indexFacts(null), null); assert.equal(indexFacts({ c: [], px: 0, prev: 100 }), null);
});
test('bank lead is the difference in percentage points, null when either is missing', () => {
  assert.equal(bankLead(1.2, 0.5), 0.7); assert.equal(bankLead(null, 0.5), null);
});
