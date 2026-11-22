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

// The Nifty 500 line needs the benchmark's close on the first book day, which the first night's build did not store.
import { emptyLedger, assertAppendOnly, type Ledger } from '../src/lib/ledger.ts';
import { heroSeries } from '../src/lib/view.ts';
const withDays = (start?: Ledger['benchmark_start']): Ledger => {
  const L = emptyLedger(); L.config.capital = 1e7;
  const day = (date: string, equity: number, bench: number | null) => ({ date, screen_id: 'all', equity, committed: 330000, realised: 0, unrealised: equity, open_n: 3, benchmark_close: bench });
  L.book_days = [day('2026-11-17', -1000, null), day('2026-11-18', -2000, 23630.25)]; if (start) L.benchmark_start = start; return L;
};
test('the chart has no benchmark line without the start close, and a correct one with it', () => {
  const none = heroSeries(withDays(), 'all'); assert.equal(none[0].bench, null); assert.equal(none[1].bench, null);
  const some = heroSeries(withDays({ date: '2026-11-17', close: 23500, source: 'test' }), 'all'); assert.equal(some[0].bench, 0); assert.equal(some[1].bench, 0.55);
});
test('a start close for another date is not used as the baseline', () => {
  const wrong = heroSeries(withDays({ date: '2026-11-16', close: 23500, source: 'test' }), 'all'); assert.equal(wrong[0].bench, null);
});
test('benchmark_start may be added once, and never changed or removed after that', () => {
  const s = { date: '2026-11-17', close: 23500, source: 'test' };
  assert.deepEqual(assertAppendOnly(withDays(), withDays(s)), [], 'adding it is allowed');
  assert.deepEqual(assertAppendOnly(withDays(s), withDays(s)), [], 'unchanged is fine');
  assert.ok(assertAppendOnly(withDays(s), withDays({ ...s, close: 23600 })).some((p) => /benchmark_start was rewritten/.test(p)));
  assert.ok(assertAppendOnly(withDays(s), withDays()).some((p) => /benchmark_start was rewritten/.test(p)), 'removing it counts as rewriting');
});

// One page per call: its address is stable, and its numbers are the Calls table's numbers.
import { callSlug, callModels, headlineOf } from '../src/lib/callpage.ts';
import { ledger, markFn, prices } from '../src/lib/data.ts';
test('a call address is SYMBOL-entry-date-screen, with & made URL-safe', () => {
  assert.equal(callSlug({ symbol: 'M&M', screen_id: 'piotroski', first_listed_run: '2026-11-17', fills: [{ date: '2026-11-18' }] } as any), 'M_M-2026-11-18-piotroski');
  assert.equal(callSlug({ symbol: 'ABC', screen_id: 'magic-formula', first_listed_run: '2026-11-20', fills: [] } as any), 'ABC-2026-11-20-magic-formula', 'a pending call is addressed by the listing date');
});
test('every call in the ledger has its own address, and an open call page agrees with the Calls table to the paisa', () => {
  const L = ledger(), mark = markFn(), models = callModels(L, mark, prices);
  assert.equal(models.length, L.picks.length); assert.equal(new Set(models.map((m) => m.slug)).size, models.length, 'addresses are unique');
  for (const m of models.filter((x) => x.pick.status === 'open' && x.marks.length > 0)) {
    const last = m.marks.at(-1)!; assert.equal(m.marks[0].date, m.row.entry, `${m.slug}: the table starts on the entry day`);
    assert.equal(last.close, mark(m.pick.symbol), `${m.slug}: the last close is the ledger's mark`); assert.equal(last.gross, m.row.gross, `${m.slug}: the last result is the table's result`);
    assert.equal(last.pct, m.row.gross_pct, `${m.slug}: the last change is the table's change`);
  }
});
test('the headline always says whether it is before or after charges, and that it is paper', () => {
  const L = ledger(), m = callModels(L, markFn(), prices).find((x) => x.pick.status === 'open');
  if (!m) return; assert.match(m.headline, /^Open since \d+ \w{3} 2026 · [+−]?[\d.,]+% before charges at \d+ \w{3} 2026$/); assert.ok(m.shareLine.length <= 44, 'fits the share image');
  assert.match(headlineOf({ ...m.row, status: 'pending', entry: null } as any, { ...m.pick, status: 'pending' } as any, L.as_of), /waiting for the next open/);
});
