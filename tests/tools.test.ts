// Decision tools: every figure checked against a sum worked by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cagr, evBand, expectancy, positionSize, recoveryGain, streakProb } from '../src/app/tools/math.ts';

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('position size: ₹10L, 1%, entry 500, stop 470 -> ₹10,000 budget, ₹30 a share, 333 shares', () => {
  const s = positionSize(1_000_000, 1, 500, 470);
  assert.ok(s);
  near(s.budget, 10_000);
  near(s.perShare, 30);
  assert.equal(s.qty, 333);
});

test('position size refuses a stop at or above the entry, and zero or over-100% risk', () => {
  assert.equal(positionSize(1e6, 1, 500, 500), null);
  assert.equal(positionSize(1e6, 1, 500, 520), null);
  assert.equal(positionSize(1e6, 0, 500, 470), null);
  assert.equal(positionSize(1e6, 101, 500, 470), null);
});

test('expectancy: 40% wins of 2R, losses of 1R, 0.05R costs -> +0.15R, break-even 35%', () => {
  const e = expectancy(0.4, 2, 1, 0.05);
  near(e.ev, 0.15);
  near(e.breakEven, 0.35);
});

test('streak odds match enumeration on small cases', () => {
  near(streakProb(2, 0.5, 2), 0.25);        // LL
  near(streakProb(3, 0.5, 2), 3 / 8);       // LLL, LLW, WLL
  near(streakProb(3, 0.5, 1), 7 / 8);       // anything but WWW
  near(streakProb(5, 0, 2), 0);
});

test('evBand: one coin-flip trade spans its two outcomes; a certain win collapses the band', () => {
  assert.deepEqual(evBand(1, 0.5, 2, 1, 0), { lo: -1, hi: 2 });
  assert.deepEqual(evBand(10, 1, 2, 1, 0), { lo: 20, hi: 20 });
});

test('recovery and CAGR', () => {
  near(recoveryGain(50), 100);
  near(recoveryGain(30), 42.857142857142854);
  near(cagr(100_000, 250_000, 5), (Math.pow(2.5, 0.2) - 1) * 100);
  near(cagr(100_000, 250_000, 5), 20.11, 0.01);
});
