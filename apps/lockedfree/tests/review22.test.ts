// 22 Nov 2026: the numbers a reader sees must agree with each other and read as numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookQuote } from '../src/lib/quotes.ts';
import { signedPct } from '../src/lib/pricechart.ts';
import { qualityMomentum, type Company, type Year } from '../src/lib/screens.ts';

// 20 Nov 2026, 15:28 IST: the ledger closed on 20 Nov, and the last print of the day is dated 20 Nov too.
const t = Math.floor(Date.parse('2026-11-20T09:58:00Z') / 1000);
test('after the close a same-day print never moves the book: the ledger close stands (the -52,455 -> -59,815 switch)', () => {
  assert.equal(bookQuote({ px: 110, t }, '2026-11-20', false), false);
  assert.equal(bookQuote({ px: 110, t }, '2026-11-19', false), false, 'a print newer than the ledger still cannot move it while the market is shut');
});
test('during the session a print dated after the ledger close does move it; one from before it does not', () => {
  assert.equal(bookQuote({ px: 110, t }, '2026-11-19', true), true);
  assert.equal(bookQuote({ px: 110, t }, '2026-11-21', true), false);
  assert.equal(bookQuote(null, '2026-11-19', true), false); assert.equal(bookQuote({ px: NaN, t }, '2026-11-19', true), false);
});
test('a huge move reads as a number: Indian grouping, no decimals from 1,000%, two below', () => {
  assert.equal(signedPct(137150), '▲ +1,37,150%'); assert.equal(signedPct(-2500.4), '▼ −2,500%'); assert.equal(signedPct(1.5), '▲ +1.50%'); assert.equal(signedPct(-12.345, 1), '▼ −12.3%'); assert.equal(signedPct(null), '—');
});
test('rule values group digits the Indian way: ₹31,260 vs ₹26,411 cr, never ₹31260 vs ₹26411', () => {
  const yr = (fy: number, ni: number): Year => ({ fy, net_income: ni, ebit: 100, total_assets: 1000, current_liabilities: 200 });
  const c: Company = { symbol: 'X', sector: 'Technology', mcap_cr: 9000, years: [yr(2026, 31260), yr(2025, 28000), yr(2024, 26411)], close: 125000.5, ma200: 100000, mom_12_1: 30 };
  const run = qualityMomentum([c]); const rules = run.detail.X.rules;
  assert.equal(rules.find((r) => r.id === 'q2')!.value, '₹31,260 vs ₹26,411 cr');
  assert.equal(rules.find((r) => r.id === 'q4')!.value, '₹1,25,000.5 vs ₹1,00,000');
});
