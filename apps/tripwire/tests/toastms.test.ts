import test from 'node:test';
import assert from 'node:assert/strict';
import { toastMs } from '../src/toastms.ts';
test('a short toast keeps its 2.6 s; a long one stays longer, capped at 9 s', () => {
  assert.equal(toastMs('Saved'), 2600); assert.equal(toastMs('x'.repeat(20)), 2600);
  assert.equal(toastMs('x'.repeat(100)), 7400); assert.equal(toastMs('x'.repeat(500)), 9000);
  assert.ok(toastMs('Question saved as a new version. The earlier one is kept.') > 2600);
});
