// Verdict at a glance (revamp v2, 11 Nov 2026): the company hero's chips are words the page already derives, never a new score, and a chip that cannot be read is left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictChips } from '../src/verdict.ts';
import { companyRead } from '../src/research.ts';
import type { Row } from '../src/screen.ts';
import type { Company } from '../src/data.ts';

const up: Row = { sym: 'TCS', name: 'TCS', sector: 'Technology', price: 120, sma20: 115, sma50: 110, sma200: 100, r3m: 8, pe: 20, pe_pctile: 20, roce_med: 40, rev_cagr: 8, last_date: '2026-11-04', fy: '2026-03-31' };
const co = (r: Partial<Row> = {}): Company => ({ sym: 'TCS', row: { ...up, ...r, risk_top: undefined }, years: [], built_on: '2026-11-05', swot: null, risk: null });

test('four chips in a fixed order, each the same word the page derives elsewhere', () => {
  const c = co(); const v = verdictChips(c, 'HIGH', 3);
  assert.deepEqual(v.map((x) => x.id), ['trend', 'quality', 'valuation', 'flags']);
  assert.equal(v[0].v, 'Uptrend'); assert.equal(v[0].tone, 'up');
  const read = companyRead(c); assert.equal(v[1].v, read.find((x) => x.id === 'roce')!.read, 'quality is the one-minute read\'s ROCE word');
  assert.equal(v[2].v, 'Low vs own history'); assert.match(v[2].basis, /Trailing PE 20\.0/);
  assert.equal(v[3].v, 'High · 3'); assert.equal(v[3].tone, 'warn');
});
test('a chip that cannot be read is left out, never defaulted', () => {
  assert.ok(!verdictChips(co({ sma200: null }), 'LOW', 0).some((x) => x.id === 'trend'), 'no trend without its averages');
  assert.ok(!verdictChips(co({ sector: 'Financial Services' }), null, null).some((x) => x.id === 'quality' || x.id === 'flags'), 'no ROCE word for a lender, no flags without a grade');
  assert.ok(!verdictChips(co({ pe: -3 }), 'LOW', 0).some((x) => x.id === 'valuation'), 'no valuation word for a loss-maker');
  assert.equal(verdictChips(co({ pe_pctile: null }), 'LOW', 0).find((x) => x.id === 'valuation')!.v, 'No history held');
  assert.equal(verdictChips(co(), 'LOW', null).find((x) => x.id === 'flags')!.v, 'Low', 'no count when the flags are not held');
  assert.equal(verdictChips(co(), 'LOW', 0).find((x) => x.id === 'flags')!.tone, 'neutral', 'a low level is not painted as reassurance');
});
