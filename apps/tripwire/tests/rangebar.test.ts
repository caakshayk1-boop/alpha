// 16 Nov 2026 (3.0 Phase B): the 52-week range position, worked by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangePos, rangeWords } from '../src/rangebar.ts';
test('360ONE: price 1145 in 906.05-1236.2 sits 72% of the way ((1145-906.05)/(1236.2-906.05) = 0.7238)', () => { assert.equal(rangePos(1145, 906.05, 1236.2), 72); });
test('at the low is 0, at the high is 100, beyond is clamped', () => { assert.equal(rangePos(100, 100, 200), 0); assert.equal(rangePos(200, 100, 200), 100); assert.equal(rangePos(250, 100, 200), 100); assert.equal(rangePos(50, 100, 200), 0); });
test('a missing or flat range is null, said in words', () => { assert.equal(rangePos(null, 1, 2), null); assert.equal(rangePos(5, 5, 5), null); assert.equal(rangePos(5, undefined, 9), null); assert.match(rangeWords(null), /No 52-week range/); assert.match(rangeWords(72), /72% of the way/); });
