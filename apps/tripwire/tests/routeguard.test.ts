// pathOnly (src/route.ts): the address rewrite guard compares screens, not spellings. 12 Nov 2026 (Codex on #61): `#/discover/` is Discover to the router, so the guard must say so too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathOnly } from '../src/route.ts';

test('pathOnly drops the hash, the query and trailing slashes', () => {
  assert.equal(pathOnly('#/discover'), '/discover'); assert.equal(pathOnly('#/discover/'), '/discover'); assert.equal(pathOnly('#/discover/?q=TCS&sort=pe'), '/discover');
  assert.equal(pathOnly('/discover?q=1'), '/discover'); assert.equal(pathOnly('#/c/TCS'), '/c/TCS'); assert.equal(pathOnly('#/c/TCS/'), '/c/TCS');
  assert.equal(pathOnly('#/'), '/'); assert.equal(pathOnly(''), '/');
});
test('two spellings of one screen compare equal; two screens do not', () => {
  assert.equal(pathOnly('#/discover/'), pathOnly('/discover?sort=roce')); assert.notEqual(pathOnly('#/desk'), pathOnly('/discover'));
});
