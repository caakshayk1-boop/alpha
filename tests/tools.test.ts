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

import { stressLoss } from '../src/app/tools/math.ts';
test('§22.6: a gap below the stop and costs make the planned loss larger, never smaller', () => {
  const atStop = stressLoss(100, 500, 470, 0, 0);
  assert.equal(atStop, 3000);
  assert.ok(Math.abs(stressLoss(100, 500, 470, 8, 0) - (100 * (500 - 470 * 0.92))) < 1e-9);
  assert.ok(stressLoss(100, 500, 470, 3, 0.25) > stressLoss(100, 500, 470, 0, 0.25));
  assert.equal(stressLoss(100, 500, 470, 0, 0.25), 3000 + 125);
});

// ── T04: zero, negative and non-finite inputs, stop ≥ entry, the capital cap, terminal growth ≥ discount rate ──────────
import { cagrPlan, dcfCheck, dcfValue, impliedGrowth, positionPlan, recoveryPlan } from '../src/app/tools/math.ts';

test('T04 position: zero, negative and non-finite inputs each get their own message, never a size', () => {
  for (const [args, field] of [
    [[0, 1, 500, 470], 'capital'], [[-5, 1, 500, 470], 'capital'], [[NaN, 1, 500, 470], 'capital'], [[Infinity, 1, 500, 470], 'capital'],
    [[1e6, 0, 500, 470], 'risk'], [[1e6, -1, 500, 470], 'risk'], [[1e6, 150, 500, 470], 'risk'], [[1e6, NaN, 500, 470], 'risk'],
    [[1e6, 1, 0, 470], 'entry'], [[1e6, 1, -500, 470], 'entry'], [[1e6, 1, Infinity, 470], 'entry'],
    [[1e6, 1, 500, 0], 'stop'], [[1e6, 1, 500, -1], 'stop'], [[1e6, 1, 500, NaN], 'stop'],
  ] as const) {
    const p = positionPlan(...(args as unknown as [number, number, number, number]));
    assert.equal(p.ok, false, `${args.join(',')} must not size`);
    if (!p.ok) assert.ok(p.errors[field], `${args.join(',')}: message on ${field}`);
  }
});

test('T04 position: a stop at or above the entry is refused with a reason, not sized', () => {
  const at = positionPlan(1e6, 1, 500, 500), above = positionPlan(1e6, 1, 500, 520);
  assert.ok(!at.ok && /risks nothing/.test(at.errors.stop));
  assert.ok(!above.ok && /below the entry/.test(above.errors.stop));
});

test('T04 position: the size is capped at what the capital can buy, and the planned loss falls with it', () => {
  // ₹1L, 2% risk = ₹2,000; entry 100, stop 99.5 -> 4,000 shares by risk, but ₹1L buys only 1,000
  const p = positionPlan(100_000, 2, 100, 99.5);
  assert.ok(p.ok);
  assert.equal(p.value.byRisk, 4000);
  assert.equal(p.value.byCapital, 1000);
  assert.equal(p.value.qty, 1000);
  assert.equal(p.value.capped, true);
  near(p.value.loss, 500);
  const q = positionPlan(1_000_000, 1, 500, 470);
  assert.ok(q.ok && q.value.qty === 333 && !q.value.capped);
});

test('T04 CAGR and recovery: zero, negative and non-finite inputs have messages; results are always finite', () => {
  for (const a of [[0, 100, 5], [100, 0, 5], [-1, 100, 5], [100, 200, 0], [100, 200, -2], [NaN, 100, 5], [100, Infinity, 5]]) {
    const r = cagrPlan(a[0], a[1], a[2]);
    assert.equal(r.ok, false, a.join(','));
  }
  const ok = cagrPlan(100_000, 250_000, 5);
  assert.ok(ok.ok && Number.isFinite(ok.value.rate));
  for (const l of [0, -10, 100, 120, NaN]) assert.equal(recoveryPlan(l).ok, false, String(l));
  const r = recoveryPlan(50);
  assert.ok(r.ok && r.value === 100);
});

test('T04 reverse DCF: terminal growth at or above the discount rate is refused; the solver never returns a non-finite rate', () => {
  assert.match(dcfCheck(12, 12, 10).terminal, /below the required return/);
  assert.match(dcfCheck(8, 9, 10).terminal, /below the required return/);
  assert.ok(dcfCheck(0, 0, 10).rate);
  assert.ok(dcfCheck(12, -1, 10).terminal);
  assert.ok(dcfCheck(12, 5, 0).years && dcfCheck(12, 5, 2.5).years && dcfCheck(12, 5, NaN).years);
  assert.deepEqual(dcfCheck(12, 5, 10), {});
  assert.equal(impliedGrowth(1000, 50, 0.12, 10, 0.12), null);
  assert.equal(impliedGrowth(1000, 50, 0.1, 10, 0.12), null);
  assert.equal(impliedGrowth(1000, 0, 0.12, 10, 0.05), null);
  assert.equal(impliedGrowth(1000, -5, 0.12, 10, 0.05), null);
  assert.equal(impliedGrowth(NaN, 50, 0.12, 10, 0.05), null);
});

test('T04 reverse DCF: the solved growth reprices the stock to its price', () => {
  const g = impliedGrowth(1000, 40, 0.12, 10, 0.05);
  assert.ok(g !== null && Number.isFinite(g));
  near(dcfValue(40, 0.12, 10, g, 0.05), 1000, 1e-6);
  // zero growth for ten years then 5%: hand-checkable value of the formula at g = 0
  let s = 0; for (let t = 1; t <= 10; t++) s += 40 / 1.12 ** t;
  near(dcfValue(40, 0.12, 10, 0, 0.05), s + (40 * 1.05 / 0.07) / 1.12 ** 10);
});

test('share card: dated, says research not advice, missing scores are a dash and no composite is "unranked"', async () => {
  const { cardLines } = await import('../src/lib/sharecard.ts');
  const r = { sym: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 3012.5, r1d: -1.234, q: 82, g: null, v: 40, tech: 55, comp: null } as never;
  const L = cardLines({ r, bull: [{ text: 'a', weight: 1 }, { text: 'b', weight: 1 }, { text: 'c', weight: 1 }], bear: [], asOf: '20 Oct 2026' });
  assert.equal(L.comp, 'Composite: unranked');
  assert.match(L.scores, /Growth —/);
  assert.match(L.foot, /20 Oct 2026.*Research, not advice/);
  assert.equal(L.forPts.length, 2);
  assert.match(L.move, /^−1\.23%/);
  assert.equal(L.price, '₹3,012.50');
});
