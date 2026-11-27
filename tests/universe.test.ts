// 27 Nov 2026: the company count in page metadata is computed, never written by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { universeFacts, companiesPhrase, companiesAsOf } from '../src/lib/universe.ts';

const file = (rows: number, as_of: unknown = '2026-11-26') => JSON.stringify({ as_of, count: rows, rows: Array.from({ length: rows }, (_, i) => [`S${i}`]) });
test('the count and day come from the universe file', () => {
  const f = universeFacts(() => file(982));
  assert.deepEqual(f, { count: 982, asOf: '2026-11-26' });
  assert.equal(companiesPhrase(f), '982 companies');
  assert.equal(companiesAsOf(f), '982 companies as of 26 Nov 2026');
});
test('a count of a thousand or more uses Indian grouping', () => {
  assert.equal(companiesPhrase(universeFacts(() => file(1200))), '1,200 companies');
});
test('a missing, unreadable or implausible file falls back to the vague phrase instead of inventing a number', () => {
  for (const read of [() => { throw new Error('no file'); }, () => 'not json', () => file(12), () => JSON.stringify({ rows: 'x' })]) {
    const f = universeFacts(read); assert.equal(f.count, null); assert.equal(companiesPhrase(f), 'about 1,000 companies'); assert.equal(companiesAsOf(f), 'about 1,000 companies');
  }
});
test('a bad date is dropped, not printed', () => {
  const f = universeFacts(() => file(500, 'yesterday')); assert.equal(f.asOf, null); assert.equal(companiesAsOf(f), '500 companies');
});
