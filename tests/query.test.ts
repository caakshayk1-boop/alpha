// Run with: node --test tests/   (the Screen's advanced text query)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeQuery, parseQuery } from '../src/lib/query.ts';
import type { Row } from '../src/lib/types.ts';

const row = (o: Partial<Row>) => ({ sym: 'X', name: 'X', sector: 'S', price: 100, ...o }) as Row;
const ok = (q: string) => { const r = parseQuery(q); if ('message' in r) throw new Error(r.message); return r; };

test('the example from the spec: a conjunction becomes one chip per clause', () => {
  const r = ok('roe > 14 and debt_to_equity < 0.5');
  assert.deepEqual(r.filters.map((f) => f.label), ['ROE above 14%', 'Debt/equity below 0.5']);
  assert.equal(r.combined.test(row({ roe: 20, de: 0.2 })), true);
  assert.equal(r.combined.test(row({ roe: 20, de: 0.9 })), false);
});

test('or, not and brackets keep their precedence; aliases resolve', () => {
  const r = ok('(roce >= 20 or roe >= 20) and not pe > 40');
  assert.equal(r.filters.length, 2);
  assert.equal(r.combined.test(row({ roce: 25, pe: 30 })), true);
  assert.equal(r.combined.test(row({ roe: 25, pe: 50 })), false);
  assert.equal(ok('de <= 0.3').filters[0].label, 'Debt/equity at most 0.3');
});

test('missing data never matches, not even through "not"', () => {
  const r = ok('not pe > 40');
  assert.equal(r.combined.test(row({ pe: null })), false);
  assert.equal(ok('roe > 10').combined.test(row({})), false);
});

test('errors are explained with a position, never a silently different screen', () => {
  const e = parseQuery('roic > 15');
  assert.ok('message' in e && /did you mean roce/.test(e.message) && e.at === 0);
  const e2 = parseQuery('roe > and pe < 10');
  assert.ok('message' in e2 && /needs a number/.test(e2.message));
  const e3 = parseQuery('(roe > 10');
  assert.ok('message' in e3 && /not closed/.test(e3.message));
  const e4 = parseQuery('roe > 10 pe < 5');
  assert.ok('message' in e4 && /Expected "and" or "or"/.test(e4.message));
});

test('plain English is left to the plain-English parser', () => {
  assert.equal(looksLikeQuery('large cap IT roce above 25'), false);
  assert.equal(looksLikeQuery('roe>14'), true);
});

test('conditions: one company or every watched name; missing values are not "not met"', async () => {
  const { check, parseCondition } = await import('../src/lib/conditions.ts');
  const c = parseCondition('tcs: rsi < 30');
  assert.ok(!('message' in c) && c.sym === 'TCS' && c.query === 'rsi < 30');
  const rows = [row({ sym: 'TCS', rsi: 25 }), row({ sym: 'INFY', rsi: 45 }), row({ sym: 'WIPRO' })];
  const all = parseCondition('rsi < 30');
  assert.ok(!('message' in all));
  if ('message' in all) return;
  assert.deepEqual(check(all, rows, ['TCS', 'INFY', 'WIPRO', 'GONE']).map((x) => [x.sym, x.met]), [['TCS', true], ['INFY', false], ['WIPRO', null], ['GONE', null]]);
  const bad = parseCondition('TCS: price targets > 5');
  assert.ok('message' in bad);
});

// C03/C04: strict and inclusive comparisons, at exactly the boundary, and the words on the chip that say which one ran
test('C03: at exactly 25, "≥" passes and ">" does not, and each chip names the operator that runs', async () => {
  const { chipText, condLabel, condTest, define, interpret } = await import('../src/lib/discover.ts');
  const at25 = row({ roce: 25 });
  const strict = ok('roce > 25').filters[0];
  assert.equal(strict.test(at25), false, 'roce > 25 excludes 25');
  assert.equal(chipText(strict.label), 'ROCE > 25%');
  assert.match(define(strict.label), /strictly above 25%: exactly 25% does not pass/);
  const incl = ok('roce >= 25').filters[0];
  assert.equal(incl.test(at25), true, 'roce >= 25 includes 25');
  assert.equal(chipText(incl.label), 'ROCE ≥ 25%');
  assert.match(define(incl.label), /at least 25%: exactly 25% passes/);
  // plain English "above 25" runs inclusively, so the chip says ≥, and the note says the boundary is included
  const nl = interpret('roce above 25').filters[0];
  assert.equal(nl.test(at25), true);
  assert.equal(chipText(nl.label), 'ROCE ≥ 25%');
  assert.match(nl.note ?? '', /includes 25% itself \(≥\).*roce > 25/);
  assert.equal(interpret('roce at least 25').filters[0].note, undefined, 'inclusive words need no note');
  // the manual editor: "is at least 25" reads ≥ and includes 25
  assert.equal(condLabel({ f: 'roce', op: '>=', v: '25' }), 'ROCE ≥ 25%');
  assert.equal(condTest({ f: 'roce', op: '>=', v: '25' })(at25), true);
  assert.equal(condTest({ f: 'roce', op: '>=', v: '25' })(row({ roce: null })), false, 'missing never passes');
});

test('C04: every qualitative term carries a definition with its boundary', async () => {
  const { define, interpret } = await import('../src/lib/discover.ts');
  for (const q of ['low debt', 'profitable', 'oversold', 'overbought', 'uptrend', 'cheap', 'quality', 'momentum', 'beaten down', 'near 52 week high', 'cash rich', 'liquid', 'dividend', 'growth', 'large cap']) {
    const f = interpret(q).filters;
    assert.equal(f.length, 1, q);
    const d = define(f[0].label, f[0].note);
    assert.ok(!d.startsWith(`${f[0].label}:`), `${q} has its own definition: ${d}`);
  }
  assert.match(define('Debt/equity 0.3 or less'), /0\.3 counts/);
  assert.match(define('Profitable (positive net margin)'), /exactly zero does not count/);
  assert.match(define('Oversold (RSI under 30)'), /30 itself does not count/);
});

test('C06: the size-class note counts classed names with no published market cap, and dates the class', async () => {
  const { tierNote } = await import('../src/lib/discover.ts');
  const n = tierNote([row({ tier: 'large', mcap_cr: null }), row({ tier: 'mid', mcap_cr: 500 }), row({ mcap_cr: null })], '2026-10-22');
  assert.equal(n.noCap, 1);
  assert.match(n.text, /screen build of 22 Oct 2026.*1 company has a class but no published market cap/);
});

test('presets describe the conditions they apply: a range reads as a range, with its boundaries', async () => {
  const { condsText } = await import('../src/lib/discover.ts');
  assert.equal(condsText([{ f: 'pe', op: '<=', v: '15' }, { f: 'pe', op: '>=', v: '1' }, { f: 'roce', op: '>=', v: '15' }]), 'P/E 1 to 15 (both included) and ROCE ≥ 15%');
});

test('compare: no winner; a mark only for a defined, material difference; lenders not comparable (C18, C19)', async () => {
  const { SPECS, mark, summarise, lenderCaveat } = await import('../src/lib/compare.ts');
  const it = (sym: string, o: Partial<Row>) => row({ sym, sector: 'Technology', ind: 'Information Technology', ...o });
  const bank = (sym: string, o: Partial<Row>) => row({ sym, sector: 'Financial Services', ind: 'Financial Services', ...o });
  const spans = ['2023-03|2026-03', '2023-03|2026-03'];
  const roce = SPECS.find((s) => s.label === 'ROCE')!;
  assert.equal(mark(roce, [it('TCS', { roce: 52 }), it('INFY', { roce: 31 })], spans).best, 52);
  assert.equal(mark(roce, [it('TCS', { roce: 32 }), it('INFY', { roce: 31 })], spans).why, 'the gap is not material');
  const m = mark(roce, [it('TCS', { roce: 52 }), bank('HDFCBANK', { roce: 90 })], spans);
  assert.deepEqual(m.na, [false, true]);
  assert.equal(m.best, null, 'one comparable figure is not a comparison');
  assert.equal(mark(SPECS.find((s) => s.label === '1 year')!, [it('A', { r1y: 50 }), it('B', { r1y: -20 })], spans).why, 'no better direction is defined');
  const pio = SPECS.find((s) => s.label === 'Piotroski F')!;
  assert.equal(mark(pio, [it('A', { piotroski: 7, piotroski_of: 9 }), it('B', { piotroski: 3, piotroski_of: 7 })], spans).why, 'scored on different numbers of tests');
  assert.equal(mark(pio, [it('A', { piotroski: 7, piotroski_of: 9 }), bank('B', { piotroski: 3, piotroski_of: 9 })], spans).why, 'lenders are scored on inputs that do not apply to them');
  assert.equal(mark(SPECS.find((s) => s.label === 'Quality')!, [it('TCS', { q: 95 }), bank('HDFCBANK', { q: 4 })], spans).best, null, 'a bank quality score is not set against an IT company');
  const s = summarise([it('TCS', { roce: 52, comp: 80 }), it('INFY', { roce: 31, comp: 78 })], spans);
  assert.equal(s[0], 'TCS has the higher ROCE (52.0% vs 31.0%).');
  const banks = summarise([bank('HDFCBANK', { roe: 9, de: 0.8 }), bank('ICICIBANK', { roe: 15, de: 0.6 })], spans);
  assert.ok(banks.some((x) => /ICICIBANK has the higher ROE/.test(x)));
  assert.ok(banks.some((x) => /debt \/ equity.* not comparable for the two lenders/.test(x)), banks.join(' | '));
  assert.ok(!banks.some((x) => /lower debt/.test(x)), 'a lender is never marked on leverage');
  assert.match(lenderCaveat(bank('HDFCBANK', { q_conf: 0.2 })) ?? '', /do not apply to lenders and rests on 20% of its inputs/);
  assert.equal(lenderCaveat(it('TCS', {})), null);
});
