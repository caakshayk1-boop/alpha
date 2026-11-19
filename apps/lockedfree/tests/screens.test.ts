import { test } from 'node:test';
import assert from 'node:assert/strict';
import { piotroski, magic, qualityMomentum, conservative, PIOTROSKI, type Company, type Year } from '../src/lib/screens.ts';
const yr = (fy: number, o: Partial<Year> = {}): Year => ({ fy, revenue: 1000, gross_profit: 300, net_income: 100, cfo: 120, total_assets: 1000, long_term_debt: 100, current_assets: 500, current_liabilities: 250, shares: 1e8, ebit: 150, net_fixed_assets: 400, equity: 600, total_debt: 100, cash: 50, ...o });
const good = (s: string): Company => ({ symbol: s, sector: 'Technology', mcap_cr: 5000, years: [yr(2026, { cfo: 150, net_income: 130, revenue: 1200, gross_profit: 400, current_assets: 600, long_term_debt: 80 }), yr(2025), yr(2024, { net_income: 60 })], close: 120, ma200: 100, mom_12_1: 40 });
test('Piotroski: a clean improver scores 9 and passes; each rule reports its numbers', () => {
  const r = piotroski(good('A')); assert.equal(r.score, 9); assert.equal(r.passes, true); assert.equal(r.rules.length, 9); assert.match(r.rules[2].value, /vs/);
});
test('Piotroski: 7 of 9 fails but is a near miss naming the failing rule; 8 passes', () => {
  const c = good('B'); c.years[0].shares = 1.2e8; c.years[0].cfo = 100;      // f7 and f4 fail -> 7
  assert.equal(piotroski(c).score, 7); assert.equal(piotroski(c).passes, false);
  const run = PIOTROSKI.run([c, good('A')]); assert.deepEqual(run.passed, ['A']); assert.equal(run.near_miss.length, 1); assert.equal(run.near_miss[0].symbol, 'B');
  const e = good('C'); e.years[0].shares = 1.2e8; assert.equal(piotroski(e).score, 8); assert.equal(piotroski(e).passes, true);
});
test('MISSING STAYS MISSING: a null input makes the rule not-scorable; the stock is neither passed nor refused', () => {
  const c = good('D'); delete c.years[1].gross_profit; const r = piotroski(c);
  assert.equal(r.rules[7].pass, null); assert.equal(r.rules[7].value, 'missing'); assert.equal(r.scorable, false); assert.equal(r.passes, false);
  const run = PIOTROSKI.run([c]); assert.deepEqual(run.not_scorable, ['D']); assert.equal(run.refused.length, 0); assert.equal(run.passed.length, 0);
});
test('SIT-OUT: nobody passes -> empty list, near misses still reported', () => {
  const bad = good('E'); bad.years[0].net_income = -5; const run = PIOTROSKI.run([bad]); assert.equal(run.passed.length, 0);
});
test('Magic Formula: excludes financials and small caps, ranks the rest, top 15 only, near-miss is rank 16-20', () => {
  const U: Company[] = []; for (let i = 0; i < 22; i++) U.push({ symbol: 'S' + i, sector: 'Industrials', mcap_cr: 3000, years: [yr(2026, { ebit: 100 + i * 10 })] });
  U.push({ symbol: 'BANK', sector: 'Banks', mcap_cr: 9000, years: [yr(2026, { ebit: 9999 })] }); U.push({ symbol: 'TINY', sector: 'Industrials', mcap_cr: 200, years: [yr(2026, { ebit: 9999 })] });
  const run = magic(U); assert.equal(run.passed.length, 15); assert.ok(run.passed.includes('S21')); assert.ok(!run.passed.includes('S0')); assert.ok(!run.passed.includes('BANK') && !run.passed.includes('TINY'));
  assert.equal(run.near_miss.length, 5); assert.equal(run.detail.BANK.passes, false);
});
test('Quality+Momentum needs all four; conservative needs 3 years of data or is not scorable', () => {
  const U = [good('A'), good('B'), good('C'), good('D'), good('E')]; U.forEach((c, i) => (c.mom_12_1 = i * 10));
  const r = qualityMomentum(U); assert.ok(r.passed.includes('E')); assert.ok(!r.passed.includes('A'));
  const short: Company = { ...good('F'), years: [yr(2026), yr(2025)] }; assert.deepEqual(conservative([short]).not_scorable, ['F']);
  const g = { ...good('G'), years: [yr(2026, { ebit: 400 }), yr(2025, { ebit: 400 }), yr(2024, { ebit: 400 })] }; assert.deepEqual(conservative([g]).passed, ['G']);
});
