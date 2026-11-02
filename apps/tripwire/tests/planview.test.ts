// Describing a paper plan: allocation, cash left and the modelled loss at the assumed stop are restatements of sizePlan's own outputs; sizePlan is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sizePlan } from '../src/planner.ts';
import { planCaveats, planFigures } from '../src/planview.ts';

const base = { equity: 1_000_000, cash: 400_000, riskPct: 0.5, entry: 2530, stop: 2400, maxPositionPct: 15, costRoundTripPct: 0.25 };

test('plan figures agree with sizePlan: capital, loss at the stop and costs are the same numbers', () => {
  const o = sizePlan(base); assert.ok(o.ok); if (!o.ok) return;
  const f = planFigures({ qty: o.qty, entry: base.entry, stop: base.stop }, base.equity, base.cash, base.costRoundTripPct);
  assert.equal(f.capital, o.capital); assert.equal(f.lossAtStop, o.risk); assert.equal(f.costs, o.costs); assert.equal(f.lossWithCosts, o.risk + o.costs);
  assert.equal(f.cashLeft, base.cash - o.capital); assert.ok(f.cashLeft! >= 0, 'sizePlan caps quantity by cash, so cash left is never negative');
  assert.equal(f.allocationPct, o.capital / base.equity * 100); assert.equal(f.lossAtStopPct, o.risk / base.equity * 100);
});
test('plan figures: the modelled loss at the stop never exceeds the risk budget sizePlan was given', () => {
  for (const [entry, stop, riskPct] of [[100, 95, 1], [2530, 2400, 0.5], [47.3, 44.1, 2], [15000, 14250, 0.25]] as const) {
    const o = sizePlan({ ...base, entry, stop, riskPct, cash: 5_000_000, equity: 5_000_000 }); if (!o.ok) continue;
    const f = planFigures({ qty: o.qty, entry, stop }, 5_000_000, 5_000_000, 0.25); assert.ok(f.lossAtStop <= 5_000_000 * riskPct / 100 + 1e-6);
  }
});
test('plan figures: no equity or no cost assumption gives null, never zero', () => {
  const f = planFigures({ qty: 10, entry: 100, stop: 90 }, 0, Number.NaN, null);
  assert.equal(f.allocationPct, null); assert.equal(f.lossAtStopPct, null); assert.equal(f.cashLeft, null); assert.equal(f.costs, null); assert.equal(f.lossWithCosts, null); assert.equal(f.lossAtStop, 100);
  assert.equal(planFigures({ qty: 10, entry: 100, stop: 90 }, 1000, 1000, -1).costs, null, 'a negative cost is not an assumption');
});
test('plan figures: a hand-edited plan that overspends shows a negative cash figure as it is', () => {
  assert.equal(planFigures({ qty: 100, entry: 100, stop: 90 }, 100_000, 5_000, 0.25).cashLeft, -5_000);
});
test('caveats name the gap, the cost assumption handed in, paper only, and the cash basis', () => {
  const c = planCaveats(0.25, 0.1).join(' ');
  assert.match(c, /Paper only/); assert.match(c, /gap through it/); assert.match(c, /0\.25% of capital over a round trip/); assert.match(c, /next open plus 0\.1% slippage/); assert.match(c, /whole position is bought/);
  assert.doesNotMatch(planCaveats(0.4).join(' '), /0\.25%/, 'the cost is the number given, not a constant');
  assert.doesNotMatch(c, /guarantee(s|d)? (a |an )?(profit|return|gain)|will (rise|gain|reach)/i);
});
test('planner.ts is untouched by this work: its formulas are the ones the engines were sized with', () => {
  const src = readFileSync(new URL('../src/planner.ts', import.meta.url), 'utf8');
  assert.match(src, /risk: Math\.floor\(\(i\.equity \* i\.riskPct \/ 100\) \/ rps\)/); assert.match(src, /const costs = capital \* i\.costRoundTripPct \/ 100/); assert.match(src, /if \(i\.riskPct > 5\)/);
});
